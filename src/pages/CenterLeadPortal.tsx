import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, LogOut, Phone, User, DollarSign, Send, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCenterUser } from '@/hooks/useCenterUser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CallbackRequestForm } from '@/components/CallbackRequestForm';
import { CenterCreateLeadModal } from '@/components/CenterCreateLeadModal';

type Lawyer = {
  id: string;
  submission_id: string;
  customer_full_name: string | null;
  phone_number: string | null;
  carrier: string | null;
  monthly_premium: number | null;
  coverage_amount: number | null;
  state: string | null;
  created_at: string;
  submission_date: string | null;
};

const CenterLeadPortal = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { centerInfo, leadVendor, loading: centerLoading } = useCenterUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [filteredLawyers, setFilteredLawyers] = useState<Lawyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !centerLoading && (!user || !centerInfo)) {
      navigate('/center-auth');
    }
  }, [user, centerInfo, authLoading, centerLoading, navigate]);

  useEffect(() => {
    if (centerInfo && leadVendor) {
      fetchLawyers();
    }
  }, [centerInfo, leadVendor]);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [lawyers, dateFilter, nameFilter]);

  const fetchLawyers = async () => {
    if (!leadVendor) return;

    try {
      // Get lawyers for this center's vendor with only the required fields
      const { data: lawyersData, error: lawyersError } = await supabase
        .from('leads')
        .select('id, submission_id, customer_full_name, phone_number, carrier, monthly_premium, coverage_amount, state, created_at, submission_date')
        .eq('lead_vendor', leadVendor)
        .order('created_at', { ascending: false });

      if (lawyersError) throw lawyersError;

      setLawyers(lawyersData || []);
    } catch (error) {
      console.error('Error fetching lawyers:', error);
      toast({
        title: "Error fetching lawyers",
        description: "Unable to load your lawyers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = lawyers;

    if (dateFilter) {
      filtered = filtered.filter(lawyer =>
        lawyer.created_at && lawyer.created_at.includes(dateFilter)
      );
    }

    if (nameFilter) {
      filtered = filtered.filter(lawyer =>
        lawyer.customer_full_name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    setFilteredLawyers(filtered);
  };

  const getLawyerStatus = (lawyer: Lawyer) => {
    return 'Available';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/center-auth');
  };

  const handleSendCallback = (lawyer: Lawyer) => {
    console.log('[DEBUG] Send Callback clicked for lawyer:', lawyer.submission_id);
    const url = `/center-callback-request?submissionId=${lawyer.submission_id}`;
    console.log('[DEBUG] Navigating to:', url);
    navigate(url);
  };

  const handleLawyerCreated = () => {
    fetchLawyers(); // Refresh the lawyers list
    toast({
      title: "Success",
      description: "Lawyer has been created and added to your portal.",
    });
  };

  // Pagination functions
  const getPaginatedLawyers = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLawyers.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(filteredLawyers.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    const total = getTotalPages();
    if (page < 1) page = 1;
    if (page > total) page = total;
    setCurrentPage(page);
  };

  const paginatedLawyers = getPaginatedLawyers();
  const totalPages = getTotalPages();

  if (authLoading || centerLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!centerInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Center user authentication required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Center Info Badge */}
        <div className="mb-6">
          <Badge variant="outline" className="flex items-center space-x-2 w-fit px-4 py-2">
            <User className="h-4 w-4" />
            <span className="font-medium">{centerInfo.center_name}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{leadVendor}</span>
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-blue-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">Total Leads</span>
              </div>
              <p className="text-2xl font-bold">{lawyers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">Active Leads</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">{lawyers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-yellow-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">This Week</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">
                {lawyers.filter(l => {
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
                <Phone className="h-4 w-4 text-purple-500" />
                <span className="text-xs sm:text-sm text-muted-foreground">Recent Leads</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold">
                {lawyers.filter(l => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return l.created_at && new Date(l.created_at) > weekAgo;
                }).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                <Label htmlFor="name-filter">Customer Name</Label>
                <Input
                  id="name-filter"
                  type="text"
                  placeholder="Search by name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads List */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <h2 className="text-lg sm:text-xl font-semibold">Your Leads ({filteredLawyers.length})</h2>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {totalPages > 1 && (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
              )}
              <Button 
                variant="outline"
                onClick={() => navigate('/center-calendar-view')}
                className="w-full sm:w-auto"
              >
                <Calendar className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Calendar View</span>
                <span className="sm:hidden">Calendar</span>
              </Button>
              <Button 
                onClick={() => setCreateLeadModalOpen(true)}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Create Lawyer</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          </div>

          {filteredLawyers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No lawyers found matching your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedLawyers.map((lawyer) => (
                <Card 
                  key={lawyer.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/leads/${lawyer.submission_id}`)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h3 className="text-lg font-semibold hover:text-blue-600 transition-colors">{lawyer.customer_full_name}</h3>
                        <Badge className="bg-blue-500 text-white w-fit">
                          {getLawyerStatus(lawyer)}
                        </Badge>
                      </div>

                      {/* Basic Lawyer Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Phone:</span> {lawyer.phone_number || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Coverage:</span> ${lawyer.coverage_amount?.toLocaleString() || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Premium:</span> ${lawyer.monthly_premium?.toLocaleString() || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span>{' '}
                          {lawyer.created_at ? format(new Date(lawyer.created_at), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </div>

                      {/* Additional Lawyer Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Carrier:</span> {lawyer.carrier || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">State:</span> {lawyer.state || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Submission Date:</span>{' '}
                          {lawyer.submission_date ? format(new Date(lawyer.submission_date), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {lawyer.created_at ? format(new Date(lawyer.created_at), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end pt-2">
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendCallback(lawyer);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 w-full lg:w-auto text-sm"
                          size="sm"
                        >
                          <Send className="h-4 w-4 mr-1 sm:mr-2" />
                          Send Callback
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mt-4 sm:mt-6">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLawyers.length)} of {filteredLawyers.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex-1 sm:flex-none text-xs sm:text-sm"
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">Prev</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex-1 sm:flex-none text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <span className="sm:hidden">Next</span>
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Lawyer Modal */}
      {leadVendor && (
        <CenterCreateLeadModal
          open={createLeadModalOpen}
          onClose={() => setCreateLeadModalOpen(false)}
          onLeadCreated={handleLawyerCreated}
          leadVendor={leadVendor}
        />
      )}

      {/* Callback Request Form Dialog - Removed, now using separate page */}
    </div>
  );
};

export default CenterLeadPortal;