import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2, Filter, Phone, User, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMarketingTeamFilterAccess } from '@/hooks/useMarketingTeamFilterAccess';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LogoLoader from '@/components/LogoLoader';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface LawyerLead {
  id: string;
  submission_id: string;
  submission_date: string | null;
  created_at: string | null;
  lawyer_full_name: string | null;
  firm_name: string | null;
  firm_address: string | null;
  firm_phone_no: string | null;
  profile_description: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone_number: string | null;
  email: string | null;
  additional_notes: string | null;
  stage_id: string | null;
  assigned_user_id?: string | null;
  entity_type?: string | null;
  profile_type?: string | null;
}

type AssigneeUser = {
  user_id: string;
  display_name: string | null;
  email: string;
};

const Retainers = () => {
  const { user, loading } = useAuth();
  const {
    marketingTeam,
    canViewTeamAssigneeFilter,
    loading: marketingFilterAccessLoading,
  } = useMarketingTeamFilterAccess(user?.id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stages: coldCallStages } = usePipelineStages('cold_call_pipeline');
  const { stages: lawyerPortalStages } = usePipelineStages('lawyer_portal');
  const { stages: submissionPortalStages } = usePipelineStages('submission_portal');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LawyerLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LawyerLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [dateRangeFilter, setDateRangeFilter] = useState<
    'all_time' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'
  >('all_time');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [lawyerSearch, setLawyerSearch] = useState('');
  const [lawFirmSearch, setLawFirmSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [assigneeById, setAssigneeById] = useState<Record<string, AssigneeUser>>({});
  const didInitAssigneeFilter = useRef(false);
  const [lawyerDropdownOpen, setLawyerDropdownOpen] = useState(false);
  const [lawFirmDropdownOpen, setLawFirmDropdownOpen] = useState(false);
  const lawyerSearchInputRef = useRef<HTMLInputElement>(null);
  const lawFirmSearchInputRef = useRef<HTMLInputElement>(null);
  const lawyerDropdownRef = useRef<HTMLDivElement>(null);
  const lawFirmDropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const stageLabelById = useMemo(() => {
    const map = new Map<string, string>();
    const allStages = [...coldCallStages, ...lawyerPortalStages, ...submissionPortalStages];
    allStages.forEach((stage) => {
      map.set(stage.id, stage.label);
      map.set(stage.key, stage.label);
    });
    return map;
  }, [coldCallStages, lawyerPortalStages, submissionPortalStages]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    
    return undefined;
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    if (didInitAssigneeFilter.current) return;
    if (marketingFilterAccessLoading) return;
    if (!canViewTeamAssigneeFilter) {
      setAssigneeFilter(user.id);
    }
    didInitAssigneeFilter.current = true;
  }, [canViewTeamAssigneeFilter, marketingFilterAccessLoading, user?.id]);

  const handleDeleteLead = useCallback(
    async (leadId: string) => {
      try {
        setDeletingId(leadId);

        const client = supabase as unknown as {
          from: (table: string) => {
            delete: () => {
              eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };

        const { error } = await client.from('lawyer_leads').delete().eq('id', leadId);
        if (error) {
          toast({
            title: 'Delete failed',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }

        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        toast({
          title: 'Deleted',
          description: 'Lead deleted successfully',
        });
      } catch (e) {
        console.error('Error deleting lead:', e);
        toast({
          title: 'Delete failed',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [toast]
  );

  const isFirmProfile = (lead: LawyerLead) => {
    const profileType = (lead.profile_type || '').trim();
    const entityType = (lead.entity_type || '').trim();
    return profileType === 'law_firm' || entityType === 'firm';
  };

  const getLeadDisplayName = (lead: LawyerLead) => {
    if (isFirmProfile(lead)) return (lead.firm_name || lead.lawyer_full_name || 'N/A').trim() || 'N/A';

    const name = (lead.lawyer_full_name || 'N/A').trim() || 'N/A';
    const firm = (lead.firm_name || 'N/A').trim() || 'N/A';
    return `${name} - ${firm}`;
  };

  const applyFilters = useCallback(() => {
    const lawyerSearchLower = lawyerSearch.trim().toLowerCase();
    const lawFirmSearchLower = lawFirmSearch.trim().toLowerCase();

    let filtered = leads;

    if (assigneeFilter !== 'all') {
      filtered = filtered.filter((lead) => (lead.assigned_user_id || '') === assigneeFilter);
    }

    const getDateBounds = (): { start: Date; endExclusive: Date } | null => {
      const now = new Date();

      if (dateRangeFilter === 'all_time') return null;

      if (dateRangeFilter === 'custom') {
        if (!customStartDate || !customEndDate) return null;
        const start = startOfDay(parseISO(customStartDate));
        let end = startOfDay(parseISO(customEndDate));
        if (end < start) end = start;
        return { start, endExclusive: addDays(end, 1) };
      }

      if (dateRangeFilter === 'this_week') {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });
        return { start: startOfDay(start), endExclusive: addDays(startOfDay(end), 1) };
      }

      if (dateRangeFilter === 'last_week') {
        const ref = subWeeks(now, 1);
        const start = startOfWeek(ref, { weekStartsOn: 1 });
        const end = endOfWeek(ref, { weekStartsOn: 1 });
        return { start: startOfDay(start), endExclusive: addDays(startOfDay(end), 1) };
      }

      if (dateRangeFilter === 'this_month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        return { start: startOfDay(start), endExclusive: addDays(startOfDay(end), 1) };
      }

      const ref = subMonths(now, 1);
      const start = startOfMonth(ref);
      const end = endOfMonth(ref);
      return { start: startOfDay(start), endExclusive: addDays(startOfDay(end), 1) };
    };

    const bounds = getDateBounds();
    if (bounds) {
      filtered = filtered.filter((lead) => {
        if (!lead.created_at) return false;
        const createdAt = new Date(lead.created_at);
        return createdAt >= bounds.start && createdAt < bounds.endExclusive;
      });
    }

    if (lawyerSearchLower) {
      filtered = filtered.filter((lead) => {
        if (isFirmProfile(lead)) return false;
        return (
          (lead.lawyer_full_name || '').toLowerCase().includes(lawyerSearchLower) ||
          (lead.phone_number || '').toLowerCase().includes(lawyerSearchLower) ||
          (lead.submission_id || '').toLowerCase().includes(lawyerSearchLower) ||
          (lead.email || '').toLowerCase().includes(lawyerSearchLower) ||
          (lead.firm_name || '').toLowerCase().includes(lawyerSearchLower)
        );
      });
    }

    if (lawFirmSearchLower) {
      filtered = filtered.filter((lead) => {
        return (
          (lead.firm_name || '').toLowerCase().includes(lawFirmSearchLower) ||
          (isFirmProfile(lead) &&
            (lead.lawyer_full_name || '').toLowerCase().includes(lawFirmSearchLower))
        );
      });
    }

    setFilteredLeads(filtered);
  }, [
    assigneeFilter,
    customEndDate,
    customStartDate,
    dateRangeFilter,
    leads,
    lawFirmSearch,
    lawyerSearch,
  ]);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); 
  }, [applyFilters]);

  type LawyerLeadsQuery = {
    order: (col: string, opts: { ascending: boolean }) => LawyerLeadsQuery;
    range: (from: number, to: number) => LawyerLeadsQuery;
    or: (filters: string) => LawyerLeadsQuery;
  };

  type LawyerLeadsClient = {
    from: (table: string) => {
      select: (cols: string, options?: { count?: 'exact' }) => LawyerLeadsQuery;
    };
  };

  const fetchLeads = useCallback(async (searchTerm?: string) => {
    try {
      // Query only the lawyer_leads table (no joins)
      const supabaseLeads = supabase as unknown as LawyerLeadsClient;
      let query = supabaseLeads
        .from('lawyer_leads')
        .select(`*`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 9999);

      if (searchTerm) {
        const term = `%${searchTerm}%`;
        query = query.or(
          [
            `lawyer_full_name.ilike.${term}`,
            `phone_number.ilike.${term}`,
            `submission_id.ilike.${term}`,
            `email.ilike.${term}`,
            `firm_name.ilike.${term}`,
          ].join(',')
        );
      }

      const { data: leadsData, error: leadsError } = await (query as unknown as Promise<{
        data: LawyerLead[] | null;
        error: unknown;
      }>);

      if (leadsError) throw leadsError;

      if (!leadsData) {
        setLeads([]);
        setIsLoading(false);
        return;
      }

      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        title: "Error fetching leads",
        description: "Unable to load your leads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user, fetchLeads]);

  useEffect(() => {
    const loadAssignees = async () => {
      const ids = Array.from(new Set(leads.map((l) => (l.assigned_user_id || '').trim()).filter(Boolean)));
      if (ids.length === 0) {
        setAssigneeById({});
        return;
      }

      try {
        const sb = supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              in: (column: string, values: string[]) => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };

        const { data, error } = await sb
          .from('app_users')
          .select('user_id,display_name,email')
          .in('user_id', ids);

        if (error) throw error;

        const rows = (data as AssigneeUser[] | null) ?? [];
        const next: Record<string, AssigneeUser> = {};
        rows.forEach((r) => {
          if (r?.user_id) next[r.user_id] = r;
        });
        setAssigneeById(next);
      } catch (e) {
        console.warn('Failed to fetch assignee users', e);
        setAssigneeById({});
      }
    };

    void loadAssignees();
  }, [leads]);

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // No analytics-related functions

  const getLeadStatus = (lead: LawyerLead) => {
    if (lead.stage_id && stageLabelById.has(lead.stage_id)) {
      return stageLabelById.get(lead.stage_id) as string;
    }

    return 'Unassigned';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Unassigned':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-success text-success-foreground';
    }
  };

  // Pagination functions
  const getPaginatedLeads = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLeads.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredLeads.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
  const total = getTotalPages();
  if (page < 1) page = 1;
  if (page > total) page = total;
  setCurrentPage(page);
  };

  const paginatedLeads = getPaginatedLeads();
  const totalPages = getTotalPages();

  if (loading) {
    return <LogoLoader page label="Loading retainers..." />;
  }

  if (isLoading && leads.length === 0) {
    return <LogoLoader page label="Loading leads..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-filter">Date</Label>
                <div className="space-y-2">
                  <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v as typeof dateRangeFilter)}>
                    <SelectTrigger id="date-filter">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_time">All Time</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="last_week">Last Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>

                  {dateRangeFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customStartDate}
                        max={customEndDate || undefined}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                      />
                      <Input
                        type="date"
                        value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lawyer-search">Search Lawyer</Label>
                <div className="relative" ref={lawyerDropdownRef}>
                  <Input
                    id="lawyer-search"
                    ref={lawyerSearchInputRef}
                    type="text"
                    placeholder="Search by name, phone, email, or firm..."
                    value={lawyerSearch}
                    onChange={(e) => {
                      setLawyerSearch(e.target.value);
                      setLawyerDropdownOpen(true);
                    }}
                    onFocus={() => setLawyerDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setLawyerDropdownOpen(false), 200);
                    }}
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {lawyerSearch ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setLawyerSearch(''); setLawyerDropdownOpen(false); }}
                        className="h-6 w-6 p-0 hover:bg-transparent"
                      >
                        <span className="text-muted-foreground hover:text-foreground">✕</span>
                      </Button>
                    ) : null}
                  </div>
                  {lawyerDropdownOpen && (() => {
                    const query = lawyerSearch.trim().toLowerCase();
                    const suggestions = (query ? leads : leads)
                      .filter((lead) => !isFirmProfile(lead))
                      .filter((lead) => {
                        if (!query) return true;
                        return (
                          (lead.lawyer_full_name || '').toLowerCase().includes(query) ||
                          (lead.phone_number || '').toLowerCase().includes(query) ||
                          (lead.email || '').toLowerCase().includes(query) ||
                          (lead.firm_name || '').toLowerCase().includes(query)
                        );
                      });
                    const displayItems = suggestions.slice(0, 50);
                    if (displayItems.length === 0) return null;
                    return (
                      <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                        {displayItems.map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setLawyerSearch((lead.lawyer_full_name || '').trim());
                              setLawyerDropdownOpen(false);
                            }}
                          >
                            <span className="truncate font-medium">{(lead.lawyer_full_name || 'N/A').trim() || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{lead.firm_name || ''}</span>
                          </button>
                        ))}
                        {suggestions.length > 50 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                            {suggestions.length - 50} more results...
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="law-firm-search">Search Law Firm</Label>
                <div className="relative" ref={lawFirmDropdownRef}>
                  <Input
                    id="law-firm-search"
                    ref={lawFirmSearchInputRef}
                    type="text"
                    placeholder="Search law firms..."
                    value={lawFirmSearch}
                    onChange={(e) => {
                      setLawFirmSearch(e.target.value);
                      setLawFirmDropdownOpen(true);
                    }}
                    onFocus={() => setLawFirmDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setLawFirmDropdownOpen(false), 200);
                    }}
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {lawFirmSearch ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setLawFirmSearch(''); setLawFirmDropdownOpen(false); }}
                        className="h-6 w-6 p-0 hover:bg-transparent"
                      >
                        <span className="text-muted-foreground hover:text-foreground">✕</span>
                      </Button>
                    ) : null}
                  </div>
                  {lawFirmDropdownOpen && (() => {
                    const query = lawFirmSearch.trim().toLowerCase();
                    const suggestions = (query ? leads : leads)
                      .filter((lead) => isFirmProfile(lead))
                      .filter((lead) => {
                        const firmName = (lead.firm_name || lead.lawyer_full_name || '').toLowerCase();
                        if (!query) return true;
                        return (
                          firmName.includes(query) ||
                          (lead.firm_phone_no || '').toLowerCase().includes(query) ||
                          (lead.email || '').toLowerCase().includes(query)
                        );
                      });
                    const displayItems = suggestions.slice(0, 50);
                    if (displayItems.length === 0) return null;
                    return (
                      <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                        {displayItems.map((lead) => {
                          const firmName = (lead.firm_name || lead.lawyer_full_name || 'N/A').trim() || 'N/A';
                          return (
                            <button
                              key={lead.id}
                              type="button"
                              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setLawFirmSearch(firmName);
                                setLawFirmDropdownOpen(false);
                              }}
                            >
                              <span className="truncate font-medium">{firmName}</span>
                            </button>
                          );
                        })}
                        {suggestions.length > 50 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                            {suggestions.length - 50} more results...
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignee-filter">Assignee</Label>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger id="assignee-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leads</SelectItem>
                    {user?.id ? <SelectItem value={user.id}>My Leads</SelectItem> : null}
                    {marketingTeam
                      .filter((m) => m.user_id !== user?.id)
                      .map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Quick Actions</h3>
                <p className="text-sm text-muted-foreground">Create new leads or manage existing entries</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/add-law-firm')}
                  className="flex items-center space-x-2"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Add Law Firm</span>
                </Button>
                <Button
                  onClick={() => navigate('/add-lead')}
                  className="flex items-center space-x-2"
                >
                  <Phone className="h-4 w-4" />
                  <span>New Lawyer</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Lawyers List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Total Lawyers ({filteredLeads.length})</h2>
              {totalPages > 1 && (
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
              )}
            </div>

              {filteredLeads.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No leads found matching your filters.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {paginatedLeads.map((lead) => (
                    <Card 
                      key={lead.id} 
                      className="group hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/lead-detail/${lead.id}`)}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-3 flex-1">
                            <div
                              className="flex items-center space-x-3 select-none group"
                            >
                              <div
                                className="text-lg font-semibold group-hover:underline text-left"
                              >
                                {getLeadDisplayName(lead)}
                              </div>
                              <Badge className={`${getStatusColor(getLeadStatus(lead))} pointer-events-none`}>
                                {getLeadStatus(lead)}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(lead.id); }}
                                className="ml-2 flex items-center gap-1"
                                aria-expanded={!!expandedCards[lead.id]}
                                title={expandedCards[lead.id] ? 'Hide details' : 'Show details'}
                              >
                                {expandedCards[lead.id] ? (
                                  <>
                                    <ChevronUp className="h-4 w-4" />
                                    <span className="hidden sm:inline text-sm text-muted-foreground">Hide</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4" />
                                    <span className="hidden sm:inline text-sm text-muted-foreground">Lawyer Details</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            {/* Basic Lead Info (simplified) */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Phone:</span> {lead.phone_number || 'N/A'}
                              </div>
                              <div>
                                <span className="font-medium">Email:</span> {lead.email || 'N/A'}
                              </div>
                              <div>
                                <span className="font-medium">Assigned to:</span>{' '}
                                {lead.assigned_user_id
                                  ? ((assigneeById[lead.assigned_user_id]?.display_name || '').trim() ||
                                      assigneeById[lead.assigned_user_id]?.email ||
                                      lead.assigned_user_id)
                                  : 'Unassigned'}
                              </div>
                              <div>
                                <span className="font-medium">City / State:</span> {lead.city || 'N/A'}{lead.city && lead.state ? `, ${lead.state}` : ''}
                              </div>
                              <div>
                                <span className="font-medium">Submitted:</span> {lead.submission_date ? format(new Date(lead.submission_date), 'MMM dd, yyyy') : 'N/A'}
                              </div>
                            
                            </div>

                            {/* Firm / Profile Details (collapsible) */}
                            {expandedCards[lead.id] && (
                              <div className="border-t pt-3">
                                <h4 className="font-medium text-sm mb-2">Firm & Profile Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div><span className="font-medium">Firm Name:</span> {lead.firm_name || 'N/A'}</div>
                                  <div><span className="font-medium">Firm Phone:</span> {lead.firm_phone_no || 'N/A'}</div>
                                  <div className="md:col-span-2"><span className="font-medium">Firm Address:</span> {lead.firm_address || 'N/A'}</div>
                                  <div className="md:col-span-2"><span className="font-medium">Street Address:</span> {lead.street_address || 'N/A'}</div>
                                  <div><span className="font-medium">ZIP Code:</span> {lead.zip_code || 'N/A'}</div>
                                  <div className="md:col-span-2"><span className="font-medium">Profile Description:</span> {lead.profile_description || 'N/A'}</div>
                                  <div className="md:col-span-2"><span className="font-medium">Notes:</span> {lead.additional_notes || 'N/A'}</div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {canViewTeamAssigneeFilter && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="Delete lead"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the lead.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleDeleteLead(lead.id);
                                      }}
                                      disabled={deletingId === lead.id}
                                      className="bg-red-500 hover:bg-red-600"
                                    >
                                      {deletingId === lead.id ? 'Deleting…' : 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {/* Compact page list: show first, last, current +/- neighbors with ellipses */}
                          {(() => {
                            const maxButtons = 7;
                            const total = totalPages;
                            const current = currentPage;
                            const pages: Array<number | string> = [];

                            if (total <= maxButtons) {
                              for (let i = 1; i <= total; i++) pages.push(i);
                            } else {
                              const side = 1;
                              const left = Math.max(2, current - side);
                              const right = Math.min(total - 1, current + side);

                              pages.push(1);
                              if (left > 2) pages.push('left-ellipsis');

                              for (let p = left; p <= right; p++) pages.push(p);

                              if (right < total - 1) pages.push('right-ellipsis');
                              pages.push(total);
                            }

                            return pages.map((p, idx) => {
                              if (typeof p === 'string') {
                                return (
                                  <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">…</span>
                                );
                              }

                              return (
                                <Button
                                  key={`page-${p}`}
                                  variant={current === p ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handlePageChange(Number(p))}
                                  className="w-8 h-8 p-0"
                                >
                                  {p}
                                </Button>
                              );
                            });
                          })()}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
    </div>
  );
};

export default Retainers;
