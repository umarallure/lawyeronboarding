import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, Phone, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { usePipelineStages } from '@/hooks/usePipelineStages';

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
}

const Retainers = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { stages: portalStages } = usePipelineStages('cold_call_pipeline');
  const [leads, setLeads] = useState<LawyerLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LawyerLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  // Track which lead cards are expanded (show accident details)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [vendorOptions, setVendorOptions] = useState<string[]>(['all']);
  const [nameFilter, setNameFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const stageLabelById = useMemo(() => {
    const map = new Map<string, string>();
    portalStages.forEach((stage) => {
      map.set(stage.id, stage.label);
    });
    return map;
  }, [portalStages]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    
    return undefined;
  }, [user, loading, navigate]);

  const fetchVendors = useCallback(async () => {
    try {
      const supabaseLeads = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            not: (col: string, op: string, val: unknown) => Promise<{
              data: { firm_name: string | null }[] | null;
              error: unknown;
            }>;
          };
        };
      };

      const { data, error } = await supabaseLeads
        .from('lawyer_leads')
        .select('firm_name')
        .not('firm_name', 'is', null);

      if (error) throw error;

      const vendors = new Set<string>();
      const rows = (Array.isArray(data) ? data : []) as { firm_name: string | null }[];
      rows.forEach((row) => {
        const vendor = (row.firm_name || '').trim();
        if (vendor) vendors.add(vendor);
      });

      setVendorOptions(['all', ...Array.from(vendors)]);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      // Keep existing options (all) on error to avoid blocking UI
    }
  }, []);

  const applyFilters = useCallback(() => {
    const searchLower = nameFilter.trim().toLowerCase();

    let filtered = leads;

    if (dateFilter) {
      filtered = filtered.filter((lead) => lead.created_at?.startsWith(dateFilter));
    }

    if (vendorFilter !== 'all') {
      const targetVendor = vendorFilter.toLowerCase();
      filtered = filtered.filter((lead) => (lead.firm_name || '').toLowerCase() === targetVendor);
    }

    if (searchLower) {
      filtered = filtered.filter((lead) => {
        return (
          (lead.lawyer_full_name || '').toLowerCase().includes(searchLower) ||
          (lead.phone_number || '').toLowerCase().includes(searchLower) ||
          (lead.submission_id || '').toLowerCase().includes(searchLower) ||
          (lead.email || '').toLowerCase().includes(searchLower) ||
          (lead.firm_name || '').toLowerCase().includes(searchLower)
        );
      });
    }

    setFilteredLeads(filtered);
  }, [dateFilter, vendorFilter, nameFilter, leads]);

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
      fetchVendors();
    }
  }, [user, fetchLeads, fetchVendors]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      fetchLeads(nameFilter.trim() || undefined).finally(() => setIsSearching(false));
      setCurrentPage(1); 
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nameFilter, fetchLeads]);

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading retainers...</p>
        </div>
      </div>
    );
  }

  if (isLoading && leads.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading leads...</p>
        </div>
      </div>
    );
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-filter">Date</Label>
                <Input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-filter">Vendor</Label>
                <Select value={vendorFilter} onValueChange={setVendorFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorOptions.map((vendor) => (
                      <SelectItem key={vendor} value={vendor}>
                        {vendor === 'all' ? 'All Vendors' : vendor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name-filter">Search Leads</Label>
                <div className="relative">
                  <Input
                    id="name-filter"
                    type="text"
                    placeholder="Search by name, phone, submission ID, or email..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    ) : nameFilter ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNameFilter('')}
                        className="h-6 w-6 p-0 hover:bg-transparent"
                      >
                        <span className="text-muted-foreground hover:text-foreground">✕</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
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
              <Button 
                onClick={() => navigate('/new-callback')}
                className="flex items-center space-x-2"
              >
                <Phone className="h-4 w-4" />
                <span>New Lead</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
            {/* Leads List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Total Leads</h2>
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
                    <Card key={lead.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-3 flex-1">
                            <div
                              className="flex items-center space-x-3 cursor-pointer select-none group"
                              onClick={() => toggleExpand(lead.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(lead.id); } }}
                            >
                              <button
                                type="button"
                                className="text-lg font-semibold group-hover:underline text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(lead.lawyer_full_name || 'N/A') + ' - ' + (lead.firm_name || 'N/A')}
                              </button>
                              <Badge className={getStatusColor(getLeadStatus(lead))}>
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
                                    <span className="hidden sm:inline text-sm text-muted-foreground">Accident Details</span>
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            {/* Basic Lead Info (simplified) */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                              <div>
                                <span className="font-medium">Phone:</span> {lead.phone_number || 'N/A'}
                              </div>
                              <div>
                                <span className="font-medium">Email:</span> {lead.email || 'N/A'}
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
