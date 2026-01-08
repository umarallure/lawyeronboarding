import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Filter, Phone, User, DollarSign, TrendingUp, AlertCircle, CheckCircle2, Clock, BarChart3, FileText, Building2, Activity, ShieldCheck, Shield, Award } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLicensedAgent } from '@/hooks/useLicensedAgent';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchBoardItems, isMondayApiConfigured, ParsedPolicyItem } from '@/lib/mondayApi';
import { MultiSelect } from '@/components/ui/multi-select';

type CommissionLead = {
  id: string;
  submission_id: string;
  insured_name: string | null;
  client_phone_number: string | null;
  carrier: string | null;
  monthly_premium: number | null;
  face_amount: number | null;
  status: string;
  licensed_agent_account: string;
  buffer_agent: string | null;
  agent: string | null;
  product_type: string | null;
  draft_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const CommissionPortal = () => {
  const { user, loading: authLoading } = useAuth();
  const { licensedAgentInfo, displayName, loading: licensedLoading } = useLicensedAgent();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Helper function to get column value by ID
  const getColumnValue = (item: ParsedPolicyItem, columnId: string): string => {
    const column = item.column_values?.find(col => col.id === columnId);
    return column?.text || '';
  };

  // Helper to get premium as number
  const getPremium = (item: ParsedPolicyItem): number => {
    const premiumText = getColumnValue(item, 'numbers');
    return premiumText ? parseFloat(premiumText.replace(/[^0-9.-]+/g, '')) || 0 : 0;
  };

  // Helper to get policy type (GI or Non GI)
  const getPolicyType = (item: ParsedPolicyItem): string => {
    return getColumnValue(item, 'text_mkxdrsg2');
  };

  // State for writing leads (from Supabase)
  const [leads, setLeads] = useState<CommissionLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<CommissionLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // State for actual placements (from Monday.com)
  const [placements, setPlacements] = useState<ParsedPolicyItem[]>([]);
  const [filteredPlacements, setFilteredPlacements] = useState<ParsedPolicyItem[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('placements'); // Default to placements view
  const [placementsPage, setPlacementsPage] = useState(1);
  const [placementsPerPage] = useState(20);
  
  // Filters for placements
  const [placementStatusFilter, setPlacementStatusFilter] = useState<string[]>(['Issued Paid', 'Pending', 'Issued Not Paid']);
  const [placementStartDate, setPlacementStartDate] = useState('');
  const [placementEndDate, setPlacementEndDate] = useState('');
  const [placementFrequencyFilter, setPlacementFrequencyFilter] = useState('all');

  // Map user email to sales agent name for filtering
  const getSalesAgentName = (): string | undefined => {
    if (!user?.email) return undefined;
    
    const emailToAgentMap: Record<string, string> = {
      'isaac.r@heritageinsurance.io': 'Isaac Reed',
      'benjamin.w@unlimitedinsurance.io	': 'Benjamin Wunder',
      'lydia.s@unlimitedinsurance.io': 'Lydia Sutton',
      'noah@unlimitedinsurance.io': 'Noah Brock',
      'tatumn.s@heritageinsurance.io': 'Trinity Queen'

      // Add more mappings here as needed
    };
    
    return emailToAgentMap[user.email.toLowerCase()];
  };

  useEffect(() => {
    if (!authLoading && !licensedLoading && (!user || !licensedAgentInfo)) {
      navigate('/auth');
    }
  }, [user, licensedAgentInfo, authLoading, licensedLoading, navigate]);

  useEffect(() => {
    if (licensedAgentInfo && displayName) {
      fetchLeads();
      fetchPlacements();
    }
  }, [licensedAgentInfo, displayName]);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [leads, startDateFilter, endDateFilter, nameFilter, carrierFilter, productFilter]);

  // Apply placement filters
  useEffect(() => {
    applyPlacementFilters();
    setPlacementsPage(1); // Reset to first page when filters change
  }, [placements, placementStatusFilter, placementStartDate, placementEndDate, placementFrequencyFilter]);

  const fetchLeads = async () => {
    if (!displayName) return;

    try {
      // Get leads from daily_deal_flow where licensed_agent_account matches display name and status is 'Pending Approval'
      const { data: leadsData, error: leadsError } = await supabase
        .from('daily_deal_flow')
        .select('*')
        .eq('licensed_agent_account', displayName)
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching commission leads:', error);
      toast({
        title: "Error fetching leads",
        description: "Unable to load your commission leads. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlacements = async () => {
    if (!displayName) return;

    setPlacementsLoading(true);

    try {
      // Check if Monday.com API is configured
      if (!isMondayApiConfigured()) {
        console.warn('Monday.com API token not configured');
        toast({
          title: "Configuration Required",
          description: "Monday.com API token is not configured. Please add VITE_MONDAY_API_TOKEN to your environment variables.",
          variant: "default",
        });
        setPlacements([]);
        return;
      }

      // Get sales agent name based on logged-in user's email
      const salesAgentName = getSalesAgentName();
      console.log(`[Commission Portal] Fetching policy placements${salesAgentName ? ` for agent: ${salesAgentName}` : ''}...`);
      
      // Fetch items from Monday.com board - filter by agent if mapped
      const items = await fetchBoardItems(salesAgentName);
      console.log(`[Commission Portal] Fetched ${items.length} policy items`);

      setPlacements(items);
      setFilteredPlacements(items); // Initialize filtered list
      
      toast({
        title: "Placements Loaded",
        description: `Loaded ${items.length} policy placements from Monday.com`,
      });
    } catch (error) {
      console.error('Error fetching Monday.com placements:', error);
      toast({
        title: "Error fetching placements",
        description: "Unable to load policy placements from Monday.com. Please try again.",
        variant: "destructive",
      });
      setPlacements([]);
    } finally {
      setPlacementsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = leads;

    // Date range filter
    if (startDateFilter) {
      filtered = filtered.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = new Date(lead.created_at);
        const startDate = new Date(startDateFilter);
        return leadDate >= startDate;
      });
    }

    if (endDateFilter) {
      filtered = filtered.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = new Date(lead.created_at);
        const endDate = new Date(endDateFilter);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return leadDate <= endDate;
      });
    }

    // Name filter
    if (nameFilter) {
      filtered = filtered.filter(lead =>
        lead.insured_name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Carrier filter
    if (carrierFilter && carrierFilter !== 'all') {
      filtered = filtered.filter(lead => lead.carrier === carrierFilter);
    }

    // Product type filter
    if (productFilter && productFilter !== 'all') {
      filtered = filtered.filter(lead => lead.product_type === productFilter);
    }

    setFilteredLeads(filtered);
  };

  const applyPlacementFilters = () => {
    let filtered = placements;

    // Status filter (Issue Status - column 'status')
    if (placementStatusFilter.length > 0) {
      filtered = filtered.filter(p => {
        const status = getColumnValue(p, 'status');
        return placementStatusFilter.includes(status);
      });
    }

    // Frequency filter (based on Issue Date - date_mkq1d86z)
    if (placementFrequencyFilter && placementFrequencyFilter !== 'all') {
      const now = new Date();
      
      filtered = filtered.filter(p => {
        const dateStr = getColumnValue(p, 'date_mkq1d86z');
        if (!dateStr) return false;
        const placementDate = new Date(dateStr);
        
        switch (placementFrequencyFilter) {
          case '24hours': {
            // Last 24 hours
            const dayAgo = new Date(now);
            dayAgo.setHours(now.getHours() - 24);
            return placementDate >= dayAgo && placementDate <= now;
          }
          case '7days': {
            // Last 7 days
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            return placementDate >= weekAgo && placementDate <= now;
          }
          case '30days': {
            // Last 30 days
            const monthAgo = new Date(now);
            monthAgo.setDate(now.getDate() - 30);
            return placementDate >= monthAgo && placementDate <= now;
          }
          case '6months': {
            // Last 6 months
            const sixMonthsAgo = new Date(now);
            sixMonthsAgo.setMonth(now.getMonth() - 6);
            return placementDate >= sixMonthsAgo && placementDate <= now;
          }
          default:
            return true;
        }
      });
    }

    // Date range filter (using Issue Date - date_mkq1d86z)
    if (placementStartDate) {
      filtered = filtered.filter(p => {
        const dateStr = getColumnValue(p, 'date_mkq1d86z');
        if (!dateStr) return false;
        const placementDate = new Date(dateStr);
        const startDate = new Date(placementStartDate);
        return placementDate >= startDate;
      });
    }

    if (placementEndDate) {
      filtered = filtered.filter(p => {
        const dateStr = getColumnValue(p, 'date_mkq1d86z');
        if (!dateStr) return false;
        const placementDate = new Date(dateStr);
        const endDate = new Date(placementEndDate);
        endDate.setHours(23, 59, 59, 999);
        return placementDate <= endDate;
      });
    }

    setFilteredPlacements(filtered);
  };

  const getLeadStatus = (lead: CommissionLead) => {
    return lead.status || 'Available';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending Approval': return 'bg-yellow-500 text-white';
      case 'Approved': return 'bg-green-500 text-white';
      default: return 'bg-blue-500 text-white';
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

  // Pagination functions for placements
  const getPaginatedPlacements = () => {
    const startIndex = (placementsPage - 1) * placementsPerPage;
    const endIndex = startIndex + placementsPerPage;
    return filteredPlacements.slice(startIndex, endIndex);
  };

  const getPlacementsTotalPages = () => {
    return Math.ceil(filteredPlacements.length / placementsPerPage);
  };

  const handlePlacementsPageChange = (page: number) => {
    const total = getPlacementsTotalPages();
    if (page < 1) page = 1;
    if (page > total) page = total;
    setPlacementsPage(page);
  };

  const paginatedLeads = getPaginatedLeads();
  const totalPages = getTotalPages();
  const paginatedPlacements = getPaginatedPlacements();
  const placementsTotalPages = getPlacementsTotalPages();

  if (authLoading || licensedLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your commission portal...</p>
        </div>
      </div>
    );
  }

  if (!licensedAgentInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Licensed agent authentication required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Display Name Badge */}
        <div className="mb-6 flex items-center justify-between">
          <Badge variant="outline" className="flex items-center space-x-1 w-fit">
            <User className="h-3 w-3" />
            <span>{displayName}</span>
          </Badge>
          
          {/* Quick Stats Summary */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Writing Leads:</span>
              <span className="font-semibold">{leads.length}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Building2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Placements:</span>
              <span className="font-semibold">{placements.length}</span>
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="placements" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Actual Placements</span>
            </TabsTrigger>
            <TabsTrigger value="writing" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Writing Leads</span>
            </TabsTrigger>
          </TabsList>

          {/* Actual Placements Tab - Main Section */}
          <TabsContent value="placements" className="space-y-6">
            {/* Filters Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="placement-status-filter">Issue Status</Label>
                    <MultiSelect
                      options={placements.length > 0 ? Array.from(
                        new Set(
                          placements
                            .map(p => getColumnValue(p, 'status'))
                            .filter(status => status && status.trim() !== '')
                        )
                      ).sort() : []}
                      selected={placementStatusFilter}
                      onChange={setPlacementStatusFilter}
                      placeholder="Select statuses (multi-select)"
                      className="w-full"
                    />
                  </div>

                  {/* Frequency Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="placement-frequency-filter">Time Period</Label>
                    <Select value={placementFrequencyFilter} onValueChange={setPlacementFrequencyFilter}>
                      <SelectTrigger id="placement-frequency-filter">
                        <SelectValue placeholder="All Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="24hours">Last 24 Hours</SelectItem>
                        <SelectItem value="7days">Last 7 Days</SelectItem>
                        <SelectItem value="30days">Last 30 Days</SelectItem>
                        <SelectItem value="6months">Last 6 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Start Date Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="placement-start-date">Issue Date From</Label>
                    <Input
                      id="placement-start-date"
                      type="date"
                      value={placementStartDate}
                      onChange={(e) => setPlacementStartDate(e.target.value)}
                    />
                  </div>

                  {/* End Date Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="placement-end-date">Issue Date To</Label>
                    <Input
                      id="placement-end-date"
                      type="date"
                      value={placementEndDate}
                      onChange={(e) => setPlacementEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(placementStatusFilter.length > 0 || placementFrequencyFilter !== 'all' || placementStartDate || placementEndDate) && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPlacementStatusFilter([]);
                        setPlacementFrequencyFilter('all');
                        setPlacementStartDate('');
                        setPlacementEndDate('');
                      }}
                    >
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-green-600" />
                  <span>Policy Placements on Carriers</span>
                  <Badge variant="outline" className="ml-2">
                    {filteredPlacements.length} Total{getSalesAgentName() ? ` for ${getSalesAgentName()}` : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {placementsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading placements from Monday.com...</p>
                  </div>
                ) : !isMondayApiConfigured() ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                    <p className="font-semibold mb-1">Monday.com API Not Configured</p>
                    <p className="text-sm text-muted-foreground">
                      Please add your Monday.com API token to environment variables as VITE_MONDAY_API_TOKEN
                    </p>
                  </div>
                ) : filteredPlacements.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No policy placements found{getSalesAgentName() ? ` for ${getSalesAgentName()}` : ''}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Placements Stats - Row 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <Activity className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Total Placements</span>
                          </div>
                          <div className="text-3xl font-bold text-blue-600">{filteredPlacements.length}</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Total GI</span>
                          </div>
                          <div className="text-3xl font-bold text-blue-600">
                            {filteredPlacements.filter(p => getPolicyType(p) === 'GI').length}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <Shield className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-muted-foreground">Total Non-GI</span>
                          </div>
                          <div className="text-3xl font-bold text-orange-600">
                            {filteredPlacements.filter(p => getPolicyType(p) === 'Non GI').length}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-center space-x-2 mb-3">
                            <BarChart3 className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium text-muted-foreground">GI vs Non-GI Distribution</span>
                          </div>
                          {(() => {
                            const giCount = filteredPlacements.filter(p => getPolicyType(p) === 'GI').length;
                            const nonGiCount = filteredPlacements.filter(p => getPolicyType(p) === 'Non GI').length;
                            const total = giCount + nonGiCount;
                            const giPercentage = total > 0 ? Math.round((giCount / total) * 100) : 0;
                            const nonGiPercentage = total > 0 ? Math.round((nonGiCount / total) * 100) : 0;

                            // SVG donut chart parameters
                            const size = 110;
                            const strokeWidth = 12;
                            const radius = (size - strokeWidth) / 2;
                            const circumference = 2 * Math.PI * radius;
                            const giArcLength = (circumference * giPercentage) / 100;
                            const nonGiArcLength = (circumference * nonGiPercentage) / 100;

                            return (
                              <div className="flex items-center justify-center space-x-5">
                                {/* GI Stats - Left Side */}
                                <div className="flex flex-col items-end space-y-1">
                                  <div className="flex items-center space-x-1.5 mb-0.5">
                                    <span className="text-xs font-semibold text-blue-700">GI</span>
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                  </div>
                                  <span className="text-3xl font-bold text-blue-600">{giPercentage}%</span>
                                  <span className="text-sm text-muted-foreground font-medium">({giCount})</span>
                                </div>
                                
                                {/* Two-color Circular Progress */}
                                <div className="relative flex items-center justify-center">
                                  <svg width={size} height={size} className="transform -rotate-90">
                                    {/* Non-GI segment (Orange) - starts at 0 */}
                                    <circle
                                      cx={size / 2}
                                      cy={size / 2}
                                      r={radius}
                                      fill="none"
                                      stroke="#f97316"
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={`${nonGiArcLength} ${circumference}`}
                                      strokeLinecap="round"
                                      className="transition-all duration-300"
                                    />
                                    {/* GI segment (Blue) - continues from Non-GI */}
                                    <circle
                                      cx={size / 2}
                                      cy={size / 2}
                                      r={radius}
                                      fill="none"
                                      stroke="#3b82f6"
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={`${giArcLength} ${circumference}`}
                                      strokeDashoffset={-nonGiArcLength}
                                      strokeLinecap="round"
                                      className="transition-all duration-300"
                                    />
                                  </svg>
                                </div>
                                
                                {/* Non-GI Stats - Right Side */}
                                <div className="flex flex-col items-start space-y-1">
                                  <div className="flex items-center space-x-1.5 mb-0.5">
                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                    <span className="text-xs font-semibold text-orange-900">Non-GI</span>
                                  </div>
                                  <span className="text-3xl font-bold text-orange-600">{nonGiPercentage}%</span>
                                  <span className="text-sm text-muted-foreground font-medium">({nonGiCount})</span>
                                </div>
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Placements Stats - Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-muted-foreground">Avg Premium</span>
                          </div>
                          <div className="text-3xl font-bold text-blue-600">
                            ${filteredPlacements.length > 0 ? Math.round(filteredPlacements.reduce((sum, p) => sum + getPremium(p), 0) / filteredPlacements.length).toLocaleString() : '0'}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="md:col-span-1">
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <Award className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-muted-foreground">Avg Placement per Week</span>
                          </div>
                          <div className="text-3xl font-bold text-orange-600">
                            {(() => {
                              if (filteredPlacements.length === 0) return '0';

                              // Get all valid issue dates
                              const validDates = filteredPlacements
                                .map(p => getColumnValue(p, 'date_mkq1d86z'))
                                .filter(dateStr => dateStr && dateStr.trim() !== '')
                                .map(dateStr => new Date(dateStr))
                                .filter(date => !isNaN(date.getTime()))
                                .sort((a, b) => a.getTime() - b.getTime());

                              if (validDates.length === 0) return '0';

                              const earliestDate = validDates[0];
                              const latestDate = validDates[validDates.length - 1];

                              // Calculate weeks between earliest and latest date
                              const timeDiff = latestDate.getTime() - earliestDate.getTime();
                              const weeksDiff = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24 * 7))); // Minimum 1 week

                              return (filteredPlacements.length / weeksDiff).toFixed(1);
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Placements List */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Policy Placements</h3>
                        {placementsTotalPages > 1 && (
                          <div className="text-sm text-muted-foreground">
                            Page {placementsPage} of {placementsTotalPages}
                          </div>
                        )}
                      </div>
                      {paginatedPlacements.map((item) => {
                        const carrier = getColumnValue(item, 'color_mknkq2qd'); // Carrier (GTL, etc.)
                        const policyStatus = getColumnValue(item, 'color_mkp5sj20'); // Policy Status (Not Yet payed, etc.)
                        const premium = getPremium(item); // Premium from 'numbers' column
                        const policyNumber = getColumnValue(item, 'text_mkpx3j6w'); // Policy Number (GTL6186318)
                        const issueStatus = getColumnValue(item, 'status'); // Issue Status (Issued Not Paid, etc.)
                        const salesAgent = getColumnValue(item, 'color_mkq0rkaw'); // Sales Agent (Isaac Reed)
                        const effectiveDate = getColumnValue(item, 'text_mkq196kp'); // Effective Date (text field)
                        const issueDate = getColumnValue(item, 'date_mkq1d86z'); // Issue Date
                        const leadSource = getColumnValue(item, 'dropdown_mkq2x0kx'); // Lead Source (Zupax Marketing)
                        const phone = getColumnValue(item, 'text_mkq268v3'); // Phone Number
                        const applicationDate = getColumnValue(item, 'date1'); // Application Date
                        const policyType = getPolicyType(item); // Policy Type (GI or Non GI)

                        return (
                        <Card key={item.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="font-semibold text-lg">{item.name}</h4>
                                    {issueStatus && (
                                      <Badge variant="outline" className="text-xs">
                                        {issueStatus}
                                      </Badge>
                                    )}
                                    {policyStatus && (
                                      <Badge variant="outline" className="text-xs bg-yellow-50">
                                        {policyStatus}
                                      </Badge>
                                    )}
                                    {policyType && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          policyType === 'GI' ? 'border-blue-500 text-blue-700 bg-blue-50' : 
                                          policyType === 'Non GI' ? 'border-orange-500 text-orange-700 bg-orange-50' : ''
                                        }`}
                                      >
                                        {policyType}
                                      </Badge>
                                    )}
                                  </div>
                                  {premium > 0 && (
                                    <div className="text-right">
                                      <div className="text-xs text-muted-foreground">Premium</div>
                                      <div className="text-lg font-bold text-green-600">
                                        ${premium.toLocaleString()}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Main Policy Details */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                                  {carrier && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Carrier:</span>
                                      <span className="ml-1 font-medium">{carrier}</span>
                                    </div>
                                  )}
                                  {policyNumber && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Policy #:</span>
                                      <span className="ml-1 font-medium">{policyNumber}</span>
                                    </div>
                                  )}
                                  {salesAgent && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Sales Agent:</span>
                                      <span className="ml-1 font-medium">{salesAgent}</span>
                                    </div>
                                  )}
                                  {leadSource && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Lead Source:</span>
                                      <span className="ml-1 font-medium">{leadSource}</span>
                                    </div>
                                  )}
                                  {applicationDate && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">App Date:</span>
                                      <span className="ml-1 font-medium">{applicationDate}</span>
                                    </div>
                                  )}
                                  {issueDate && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Issue Date:</span>
                                      <span className="ml-1 font-medium">{issueDate}</span>
                                    </div>
                                  )}
                                  {effectiveDate && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Effective:</span>
                                      <span className="ml-1 font-medium">{effectiveDate}</span>
                                    </div>
                                  )}
                                  {phone && (
                                    <div className="text-sm">
                                      <Phone className="h-3 w-3 inline mr-1 text-muted-foreground" />
                                      <span className="font-medium">{phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                      })}

                      {/* Pagination Controls */}
                      {placementsTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t">
                          <div className="text-sm text-muted-foreground">
                            Showing {((placementsPage - 1) * placementsPerPage) + 1} to {Math.min(placementsPage * placementsPerPage, filteredPlacements.length)} of {filteredPlacements.length} placements
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePlacementsPageChange(placementsPage - 1)}
                              disabled={placementsPage === 1}
                            >
                              Previous
                            </Button>
                            <div className="flex items-center gap-1">
                              {/* Compact page list: show first, last, current +/- neighbors with ellipses */}
                              {(() => {
                                const maxButtons = 7; // total buttons to show including first/last
                                const total = placementsTotalPages;
                                const current = placementsPage;
                                const pages: Array<number | string> = [];

                                if (total <= maxButtons) {
                                  for (let i = 1; i <= total; i++) pages.push(i);
                                } else {
                                  const side = 1; // neighbors on each side of current
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
                                      <span key={p + idx} className="px-2 text-sm text-muted-foreground">…</span>
                                    );
                                  }

                                  return (
                                    <Button
                                      key={p}
                                      variant={current === p ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => handlePlacementsPageChange(Number(p))}
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
                              onClick={() => handlePlacementsPageChange(placementsPage + 1)}
                              disabled={placementsPage === placementsTotalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Writing Leads Tab - Original Content */}
          <TabsContent value="writing" className="space-y-6">
        {/* Stats - 5 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">All Time APP</span>
              </div>
              <p className="text-2xl font-bold">{leads.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                <span className="text-sm text-muted-foreground">This Month APP</span>
              </div>
              <p className="text-2xl font-bold">
                {leads.filter(l => {
                  if (!l.created_at) return false;
                  const leadDate = new Date(l.created_at);
                  const now = new Date();
                  return leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">This Week APP</span>
              </div>
              <p className="text-2xl font-bold">
                {leads.filter(l => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return l.created_at && new Date(l.created_at) > weekAgo;
                }).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Today APP</span>
              </div>
              <p className="text-2xl font-bold">
                {leads.filter(l => {
                  if (!l.created_at) return false;
                  const leadDate = new Date(l.created_at);
                  const today = new Date();
                  return leadDate.toDateString() === today.toDateString();
                }).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-indigo-500" />
                <span className="text-sm text-muted-foreground">Daily Avg APP This Week</span>
              </div>
              <p className="text-2xl font-bold">
                {(() => {
                  const weekLeads = leads.filter(l => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return l.created_at && new Date(l.created_at) > weekAgo;
                  });
                  return (weekLeads.length / 7).toFixed(1);
                })()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Graphs - 2 Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Graph 1: APP Distribution by Carrier */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">APP by Carrier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const carrierData = leads.reduce((acc, lead) => {
                    const carrier = lead.carrier || 'Unknown';
                    if (!acc[carrier]) {
                      acc[carrier] = { count: 0, premium: 0 };
                    }
                    acc[carrier].count++;
                    acc[carrier].premium += lead.monthly_premium || 0;
                    return acc;
                  }, {} as Record<string, { count: number; premium: number }>);

                  const sortedCarriers = Object.entries(carrierData)
                    .sort((a, b) => b[1].premium - a[1].premium)
                    .slice(0, 5);

                  const maxPremium = sortedCarriers[0]?.[1].premium || 1;

                  return sortedCarriers.map(([carrier, data]) => (
                    <div key={carrier} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{carrier}</span>
                        <span className="text-muted-foreground">${data.premium.toLocaleString()} ({data.count})</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${(data.premium / maxPremium) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
                {leads.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Graph 2: APP Over Time (Weekdays Only) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total APP (Last 7 Weekdays)</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Get last 7 weekdays (excluding Saturday and Sunday)
                const last7Weekdays = [];
                let daysAdded = 0;
                let dayOffset = 0;
                
                while (daysAdded < 7) {
                  const date = new Date();
                  date.setDate(date.getDate() - dayOffset);
                  date.setHours(0, 0, 0, 0);
                  
                  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
                  if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
                    last7Weekdays.unshift(date);
                    daysAdded++;
                  }
                  dayOffset++;
                }

                const dailyData = last7Weekdays.map(date => {
                  const count = leads.filter(l => {
                    if (!l.created_at) return false;
                    const leadDate = new Date(l.created_at);
                    leadDate.setHours(0, 0, 0, 0);
                    return leadDate.getTime() === date.getTime();
                  }).length;

                  return {
                    date: format(date, 'MMM d'),
                    fullDate: format(date, 'MMM dd, yyyy'),
                    count,
                    dailyTarget: 10,
                    weeklyAvg: 8
                  };
                });

                if (leads.length === 0) {
                  return (
                    <div className="flex items-center justify-center" style={{ height: 300 }}>
                      <p className="text-center text-muted-foreground">No data available</p>
                    </div>
                  );
                }

                return (
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={dailyData}
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                          minTickGap={30}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          className="text-muted-foreground"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number, name: string) => {
                            if (name === 'count') return [value, 'Submissions'];
                            if (name === 'dailyTarget') return [value, 'Daily Target'];
                            if (name === 'weeklyAvg') return [value, 'Weekly Avg'];
                            return [value, name];
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '12px' }}
                          formatter={(value: string) => {
                            if (value === 'count') return 'Actual';
                            if (value === 'dailyTarget') return 'Daily Target (10)';
                            if (value === 'weeklyAvg') return 'Weekly Avg (8)';
                            return value;
                          }}
                        />
                        
                        {/* Target lines */}
                        <ReferenceLine 
                          y={10} 
                          stroke="#22c55e" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ value: '', position: 'insideTopRight' }}
                        />
                        <ReferenceLine 
                          y={8} 
                          stroke="#f97316" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ value: '', position: 'insideTopRight' }}
                        />
                        
                        {/* Data line */}
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                          name="count"
                        />
                        
                        {/* Hidden lines for legend */}
                        <Line 
                          type="monotone" 
                          dataKey="dailyTarget" 
                          stroke="#22c55e" 
                          strokeWidth={0}
                          dot={false}
                          legendType="line"
                          strokeDasharray="5 5"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weeklyAvg" 
                          stroke="#f97316" 
                          strokeWidth={0}
                          dot={false}
                          legendType="line"
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    
                    {/* Stats below graph */}
                    <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Daily</p>
                        <p className="text-lg font-bold">
                          {dailyData.length > 0 ? (dailyData.reduce((sum, d) => sum + d.count, 0) / 7).toFixed(1) : '0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Days Above Target</p>
                        <p className="text-lg font-bold text-green-600">
                          {dailyData.filter(d => d.count >= 10).length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Target Achievement</p>
                        <p className="text-lg font-bold text-blue-600">
                          {dailyData.length > 0 ? Math.round((dailyData.reduce((sum, d) => sum + d.count, 0) / (7 * 10)) * 100) : '0'}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CommissionPortal;