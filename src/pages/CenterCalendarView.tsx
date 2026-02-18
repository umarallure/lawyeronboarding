import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCenterUser } from '@/hooks/useCenterUser';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, User, Phone, DollarSign, Edit } from 'lucide-react';
import { CenterCalendarComponent } from '@/components/CenterCalendarComponent';
import { PlacementStatusModal } from '@/components/PlacementStatusModal';

type Lawyer = {
  id: string;
  submission_id: string;
  customer_full_name: string | null;
  phone_number: string | null;
  carrier: string | null;
  monthly_premium: number | null;
  coverage_amount: number | null;
  face_amount?: number | null;
  state: string | null;
  created_at: string;
  draft_date: string | null;
  submission_date: string | null;
  status?: string | null;
  placement_status?: string | null;
};

const carrierOptions = [
  "All Carriers",
  "Liberty",
  "SBLI",
  "Corebridge",
  "MOH",
  "Transamerica",
  "RNA",
  "AMAM",
  "GTL",
  "Aetna",
  "Americo",
  "CICA",
  "N/A"
];

const placementStatusOptions = [
  "All Statuses",
  "Good Standing",
  "Not Placed",
  "Pending Failed Payment Fix",
  "FDPF Pending Reason",
  "FDPF Insufficient Funds",
  "FDPF Incorrect Banking Info",
  "FDPF Unauthorized Draft"
];

const CenterCalendarView = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { centerInfo, leadVendor, loading: centerLoading } = useCenterUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filteredLawyers, setFilteredLawyers] = useState<Lawyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCarrier, setSelectedCarrier] = useState<string>("All Carriers");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null);

  useEffect(() => {
    console.log('[CenterCalendarView] Auth/Center check:', {
      authLoading,
      centerLoading,
      hasUser: !!user,
      hasCenterInfo: !!centerInfo,
      leadVendor
    });
    if (!authLoading && !centerLoading && (!user || !centerInfo)) {
      console.log('[CenterCalendarView] Redirecting to center-auth');
      navigate('/center-auth');
    }
  }, [user, centerInfo, authLoading, centerLoading, navigate]);

  useEffect(() => {
    if (centerInfo && leadVendor) {
      fetchLawyers();
    }
  }, [centerInfo, leadVendor]);

  useEffect(() => {
    if (selectedDate) {
      filterLawyersByDate(selectedDate);
    }
  }, [selectedDate, lawyers, selectedCarrier]);

  const fetchLawyers = async () => {
    if (!leadVendor) return;

    try {
      const { data: lawyersData, error: lawyersError } = await supabase
        .from('leads')
        .select('id, submission_id, customer_full_name, phone_number, carrier, monthly_premium, coverage_amount, state, created_at, draft_date, submission_date')
        .eq('lead_vendor', leadVendor)
        .order('draft_date', { ascending: false });

      if (lawyersError) throw lawyersError;

      // Get status, face_amount, and draft_date from daily_deal_flow for each lawyer
      const lawyersWithStatus = await Promise.all(
        (lawyersData || []).map(async (lawyer) => {
          const { data: dealFlowData } = await supabase
            .from('daily_deal_flow')
            .select('status, draft_date, face_amount, carrier, placement_status')
            .eq('submission_id', lawyer.submission_id)
            .maybeSingle();

          return {
            ...lawyer,
            status: dealFlowData?.status || null,
            // Use draft_date from daily_deal_flow if available, otherwise use lawyers table
            draft_date: dealFlowData?.draft_date || lawyer.draft_date,
            // Use face_amount from daily_deal_flow if available, otherwise use coverage_amount from lawyers
            face_amount: dealFlowData?.face_amount || null,
            // Use carrier from daily_deal_flow if available, otherwise use lawyers table
            carrier: dealFlowData?.carrier || lawyer.carrier,
            // Get placement_status from daily_deal_flow
            placement_status: dealFlowData?.placement_status || null,
          };
        })
      );

      setLawyers(lawyersWithStatus);
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

  const filterLawyersByDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const filtered = lawyers.filter(lawyer => {
      if (!lawyer.draft_date) return false;
      try {
        // Parse date string directly without timezone conversion
        let lawyerDraftDate: string;
        if (typeof lawyer.draft_date === 'string' && lawyer.draft_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format, use directly
          lawyerDraftDate = lawyer.draft_date;
        } else {
          // Parse and format
          lawyerDraftDate = format(new Date(lawyer.draft_date), 'yyyy-MM-dd');
        }
        const matchesDate = lawyerDraftDate === dateString;
        
        // Apply carrier filter
        if (selectedCarrier === "All Carriers") {
          return matchesDate;
        }
        return matchesDate && lawyer.carrier === selectedCarrier;
      } catch (error) {
        // Skip lawyers with invalid draft_date
        return false;
      }
    });
    setFilteredLawyers(filtered);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  const handleSendCallback = (lawyer: Lawyer) => {
    navigate(`/center-callback-request?submissionId=${lawyer.submission_id}`);
  };

  const handleEditPlacementStatus = (lawyer: Lawyer) => {
    setSelectedLawyer(lawyer);
    setModalOpen(true);
  };

  const handleSavePlacementStatus = async (newStatus: string) => {
    if (!selectedLawyer) return;

    try {
      const { error } = await supabase
        .from('daily_deal_flow')
        .update({ placement_status: newStatus })
        .eq('submission_id', selectedLawyer.submission_id);

      if (error) throw error;

      toast({
        title: "Status Updated",
        description: "Placement status has been updated successfully.",
      });

      // Refresh lawyers to show updated status
      fetchLawyers();
    } catch (error) {
      console.error('Error updating placement status:', error);
      toast({
        title: "Error",
        description: "Failed to update placement status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getLawyerCountForDate = (date: Date): number => {
    const dateString = format(date, 'yyyy-MM-dd');
    return lawyers.filter(lawyer => {
      if (!lawyer.draft_date) return false;
      try {
        // Parse date string directly without timezone conversion
        let lawyerDraftDate: string;
        if (typeof lawyer.draft_date === 'string' && lawyer.draft_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format, use directly
          lawyerDraftDate = lawyer.draft_date;
        } else {
          // Parse and format
          lawyerDraftDate = format(new Date(lawyer.draft_date), 'yyyy-MM-dd');
        }
        return lawyerDraftDate === dateString;
      } catch (error) {
        // Skip lawyers with invalid draft_date
        return false;
      }
    }).length;
  };

  if (authLoading || centerLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading calendar...</p>
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Center Info Badge */}
        <div className="mb-4 sm:mb-6">
          <Badge variant="outline" className="flex items-center space-x-2 w-fit px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm">
            <User className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="font-medium">{centerInfo.center_name}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{leadVendor}</span>
          </Badge>
        </div>

        {/* Main Layout: Calendar + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar Section - Left/Main */}
          <div className="lg:col-span-2">
            {/* Carrier Filter */}
            <Card className="mb-4">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-2">
                  <Label htmlFor="carrier-filter">Filter by Carrier</Label>
                  <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                    <SelectTrigger id="carrier-filter">
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {carrierOptions.map((carrier) => (
                        <SelectItem key={carrier} value={carrier}>
                          {carrier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>Select Draft Date</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <CenterCalendarComponent
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  getLeadCountForDate={getLawyerCountForDate}
                  leads={lawyers}
                />
              </CardContent>
            </Card>

            {/* Stats Below Calendar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-blue-500" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Total Lawyers</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{lawyers.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-green-500" />
                    <span className="text-xs sm:text-sm text-muted-foreground">With Draft Date</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">
                    {lawyers.filter(l => l.draft_date).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Selected Date</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{filteredLawyers.length}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar - Right */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-4">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">
                  {selectedDate ? (
                    <>
                      Lawyers for {format(selectedDate, 'MMM dd, yyyy')}
                      <span className="ml-2 text-xs sm:text-sm font-normal text-muted-foreground">
                        ({filteredLawyers.length})
                      </span>
                    </>
                  ) : (
                    'Select a date'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {!selectedDate ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Please select a date from the calendar</p>
                  </div>
) : filteredLawyers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No lawyers scheduled for this date</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredLawyers.map((lawyer) => (
                      <Card key={lawyer.id} className="border hover:shadow-md transition-shadow">
                        <CardContent className="p-2.5 sm:p-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-xs sm:text-sm line-clamp-1 flex-1">
                                {lawyer.customer_full_name || 'Unknown'}
                              </h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditPlacementStatus(lawyer)}
                                className="h-6 w-6 sm:h-7 sm:w-7 p-0 shrink-0"
                              >
                                <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                              </Button>
                            </div>

                            <div className="space-y-0.5 text-[10px] sm:text-xs text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                <span className="break-all">{lawyer.phone_number || 'N/A'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                <span>
                                  ${lawyer.face_amount?.toLocaleString() || lawyer.coverage_amount?.toLocaleString() || 'N/A'}
                                </span>
                              </div>
                              {lawyer.carrier && (
                                <div className="flex items-center space-x-1">
                                  <span className="font-medium">Carrier:</span>
                                  <span>{lawyer.carrier}</span>
                                </div>
                              )}
                              {lawyer.state && (
                                <div className="flex items-center space-x-1">
                                  <span className="font-medium">State:</span>
                                  <span>{lawyer.state}</span>
                                </div>
                              )}
                              {lawyer.placement_status && (
                                <div className="flex items-center space-x-1">
                                  <Badge 
                                    variant={
                                      lawyer.placement_status === 'Good Standing' ? 'default' :
                                      lawyer.placement_status === 'Not Placed' ? 'destructive' :
                                      'secondary'
                                    }
                                    className="text-[10px] sm:text-xs px-1.5 py-0.5"
                                  >
                                    {lawyer.placement_status}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Placement Status Modal */}
      {selectedLawyer && (
        <PlacementStatusModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          currentStatus={selectedLawyer.placement_status || null}
          leadName={selectedLawyer.customer_full_name || 'Unknown'}
          onSave={handleSavePlacementStatus}
        />
      )}
    </div>
  );
};

export default CenterCalendarView;
