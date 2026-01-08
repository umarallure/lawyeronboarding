import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  MessageSquare, 
  Send,
  User,
  Calendar,
  FileText,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";

interface AppFixTask {
  id: string;
  submission_id: string;
  customer_name: string | null;
  fix_type: string;
  status: string;
  created_by_name: string | null;
  assigned_to_name: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

interface BankingUpdate {
  bank_account_owner: string;
  bank_institution_name: string;
  routing_number: string;
  account_number: string;
  account_type: string;
  new_draft_date: string;
  banking_info_source: string;
  policy_action: string;
  additional_notes: string | null;
}

interface CarrierRequirement {
  carrier: string;
  requirement_type: string;
  requirement_details: string;
  additional_notes: string | null;
}

interface Comment {
  id: string;
  user_name: string;
  comment: string;
  created_at: string;
}

const TaskDetailView = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<AppFixTask | null>(null);
  const [bankingDetails, setBankingDetails] = useState<BankingUpdate | null>(null);
  const [carrierDetails, setCarrierDetails] = useState<CarrierRequirement | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [taskStatus, setTaskStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Existing bank details from lead table
  const [existingBankDetails, setExistingBankDetails] = useState<{
    bank_name: string | null;
    routing_number: string | null;
    account_number: string | null;
    account_type: string | null;
    account_owner: string | null;
  } | null>(null);
  const [loadingExistingData, setLoadingExistingData] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetails();
      fetchComments();
    }
  }, [taskId]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);

      // Fetch task
      const { data: taskData, error: taskError } = await supabase
        .from('app_fix_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) {
        throw taskError;
      }

      setTask(taskData);
      setTaskStatus(taskData.status);

      // Fetch type-specific details
      if (taskData.fix_type === 'banking_info' || taskData.fix_type === 'updated_banking_info') {
        const { data: bankingData, error: bankingError } = await supabase
          .from('app_fix_banking_updates')
          .select('*')
          .eq('task_id', taskId)
          .single();

        if (bankingError && bankingError.code !== 'PGRST116') {
          throw bankingError;
        }

        setBankingDetails(bankingData);
        
        // Fetch existing bank details from leads table
        if (taskData.submission_id) {
          setLoadingExistingData(true);
          const { data: leadData } = await supabase
            .from('leads')
            .select('institution_name, beneficiary_routing, beneficiary_account, account_type, customer_full_name')
            .eq('submission_id', taskData.submission_id)
            .single();

          if (leadData) {
            setExistingBankDetails({
              bank_name: leadData.institution_name,
              routing_number: leadData.beneficiary_routing?.trim(),
              account_number: leadData.beneficiary_account,
              account_type: leadData.account_type,
              account_owner: leadData.customer_full_name
            });
          }
          setLoadingExistingData(false);
        }
      } else if (taskData.fix_type === 'carrier_requirement') {
        const { data: carrierData, error: carrierError } = await supabase
          .from('app_fix_carrier_requirements')
          .select('*')
          .eq('task_id', taskId)
          .single();

        if (carrierError && carrierError.code !== 'PGRST116') {
          throw carrierError;
        }

        setCarrierDetails(carrierData);
      }

    } catch (error) {
      console.error("Error fetching task:", error);
      toast({
        title: "Error",
        description: "Failed to fetch task details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('app_fix_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Validation Error",
        description: "Comment cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setSubmittingComment(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const userName = profile?.display_name || 'Unknown User';

      const { error } = await supabase
        .from('app_fix_task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          user_name: userName,
          comment: newComment.trim()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Comment added successfully",
      });

      setNewComment("");
      fetchComments();

    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (taskStatus === task?.status && !statusNotes.trim()) {
      toast({
        title: "No Changes",
        description: "Please update the status or add notes",
        variant: "destructive",
      });
      return;
    }

    setUpdatingStatus(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const updateData: any = {
        status: taskStatus
      };

      if (taskStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user.id;
      }

      if (statusNotes.trim()) {
        const currentNotes = task?.notes || '';
        const timestamp = format(new Date(), 'MM/dd/yyyy HH:mm');
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();
        const userName = profile?.display_name || 'Unknown User';
        
        updateData.notes = `${currentNotes}\n[${timestamp}] ${userName}: ${statusNotes.trim()}`;
      }

      const { error } = await supabase
        .from('app_fix_tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) {
        throw error;
      }

      // If status changed, add a comment automatically
      if (taskStatus !== task?.status) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();
        const userName = profile?.display_name || 'Unknown User';

        await supabase
          .from('app_fix_task_comments')
          .insert({
            task_id: taskId,
            user_id: user.id,
            user_name: userName,
            comment: `Status updated to: ${taskStatus}${statusNotes.trim() ? `\n${statusNotes.trim()}` : ''}`
          });
      }

      // If task is being marked as completed, send notifications and update daily deal flow
      if (taskStatus === 'completed' && task?.status !== 'completed') {
        await handleTaskCompletion();
      }

      toast({
        title: "Success",
        description: "Task updated successfully",
      });

      setStatusNotes("");
      fetchTaskDetails();
      fetchComments();

    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleTaskCompletion = async () => {
    try {
      if (!task) return;

      // Fetch lead data for notifications and daily deal flow
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("submission_id", task.submission_id)
        .single();

      if (leadError || !leadData) {
        console.error("Error fetching lead data:", leadError);
        return;
      }

      // 1. Send center notification about the completed fix
      try {
        const fixDescription = task.fix_type === 'banking_info' || task.fix_type === 'updated_banking_info'
          ? `Banking information has been updated${bankingDetails ? ` - New draft date: ${format(new Date(bankingDetails.new_draft_date), 'MM/dd/yyyy')}` : ''}`
          : task.fix_type === 'carrier_requirement'
          ? `Carrier requirement has been fulfilled${carrierDetails ? ` - ${carrierDetails.carrier}` : ''}`
          : 'Application fix has been completed';

        const notificationData = {
          submissionId: task.submission_id,
          leadData: {
            customer_full_name: leadData.customer_full_name,
            phone_number: leadData.phone_number,
            email: leadData.email,
            lead_vendor: leadData.lead_vendor
          },
          callResult: {
            application_submitted: false,
            status: 'App Fix Completed',
            notes: `Task completed by Licensed Agent: ${fixDescription}${statusNotes.trim() ? `\n\nNotes: ${statusNotes.trim()}` : ''}`,
            buffer_agent: task.created_by_name || 'N/A',
            agent_who_took_call: task.assigned_to_name || 'N/A',
            lead_vendor: leadData.lead_vendor || 'N/A',
            fix_type: task.fix_type
          }
        };

        console.log("Sending center notification for completed task");
        
        const { error: centerError } = await supabase.functions.invoke('center-notification', {
          body: notificationData
        });

        if (centerError) {
          console.error("Error sending center notification:", centerError);
        } else {
          console.log("Center notification sent successfully");
        }
      } catch (centerError) {
        console.error("Center notification failed:", centerError);
        // Don't fail the entire process
      }

      // 2. Update daily deal flow entry
      try {
        console.log('Updating daily_deal_flow for completed task');

        // Determine the appropriate status and notes based on fix type
        let dailyDealStatus = 'Pending Approval'; // Default status after fix
        let dailyDealNotes = '';
        
        if (task.fix_type === 'banking_info' || task.fix_type === 'updated_banking_info') {
          dailyDealStatus = 'Pending Failed Payment Fix';
          dailyDealNotes = `Banking information updated by ${task.assigned_to_name || 'Licensed Agent'}`;
          if (bankingDetails) {
            dailyDealNotes += `\nNew Draft Date: ${format(new Date(bankingDetails.new_draft_date), 'MM/dd/yyyy')}`;
            dailyDealNotes += `\nNew Bank: ${bankingDetails.bank_institution_name}`;
            dailyDealNotes += `\nAccount Type: ${bankingDetails.account_type}`;
          }
        } else if (task.fix_type === 'carrier_requirement') {
          dailyDealStatus = 'Pending Approval';
          dailyDealNotes = `Carrier requirement fulfilled by ${task.assigned_to_name || 'Licensed Agent'}`;
          if (carrierDetails) {
            dailyDealNotes += `\nCarrier: ${carrierDetails.carrier}`;
            dailyDealNotes += `\nRequirement: ${carrierDetails.requirement_type}`;
          }
        }

        if (statusNotes.trim()) {
          dailyDealNotes += `\n\nCompletion Notes: ${statusNotes.trim()}`;
        }

        const { data: updateResult, error: updateError } = await supabase.functions.invoke('update-daily-deal-flow-entry', {
          body: {
            submission_id: task.submission_id,
            call_source: 'First Time Transfer', // Required parameter for edge function
            status: dailyDealStatus,
            notes: dailyDealNotes,
            buffer_agent: task.created_by_name || 'N/A',
            agent: task.assigned_to_name || 'N/A',
            licensed_agent_account: task.assigned_to_name || 'N/A',
            call_result: 'App Fix Completed',
            application_submitted: false, // This is a fix, not a new submission
            // Include relevant banking info if it's a banking fix
            ...(task.fix_type === 'banking_info' || task.fix_type === 'updated_banking_info') && bankingDetails ? {
              draft_date: format(new Date(bankingDetails.new_draft_date), "yyyy-MM-dd")
            } : {}
          }
        });

        if (updateError) {
          console.error('Error updating daily deal flow:', updateError);
        } else {
          console.log('Daily deal flow updated successfully:', updateResult);
        }
      } catch (syncError) {
        console.error('Sync to daily_deal_flow failed:', syncError);
        // Don't fail the entire process
      }

    } catch (error) {
      console.error("Error in task completion handler:", error);
      // Don't fail the main task update
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          In Progress
        </Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFixTypeLabel = (fixType: string) => {
    switch (fixType) {
      case 'banking_info':
      case 'updated_banking_info':
        return 'Banking Information Update';
      case 'carrier_requirement':
        return 'Carrier Requirement';
      default:
        return fixType;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading Task Details...</span>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-lg text-muted-foreground">Task not found</p>
              <Button onClick={() => navigate('/licensed-agent-inbox')} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inbox
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/licensed-agent-inbox')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inbox
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Task Details (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {getFixTypeLabel(task.fix_type)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Task ID: {task.id.slice(0, 8)}...
                    </p>
                  </div>
                  {getStatusBadge(task.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Submission ID
                    </p>
                    <p className="text-sm font-semibold mt-1">{task.submission_id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Customer
                    </p>
                    <p className="text-sm font-semibold mt-1">{task.customer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Created By
                    </p>
                    <p className="text-sm font-semibold mt-1">{task.created_by_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Assigned To
                    </p>
                    <p className="text-sm font-semibold mt-1">{task.assigned_to_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created
                    </p>
                    <p className="text-sm mt-1">{format(new Date(task.created_at), 'MM/dd/yyyy HH:mm')}</p>
                  </div>
                  {task.completed_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Completed
                      </p>
                      <p className="text-sm mt-1">{format(new Date(task.completed_at), 'MM/dd/yyyy HH:mm')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Type-Specific Details */}
            {bankingDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Banking Information Update</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current Banking Details */}
                  {loadingExistingData ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading current bank details...</span>
                    </div>
                  ) : existingBankDetails ? (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Current Bank Account Details (Before Update)
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="font-medium text-blue-700">Bank Name:</p>
                          <p className="text-blue-900">{existingBankDetails.bank_name || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700">Account Owner:</p>
                          <p className="text-blue-900">{existingBankDetails.account_owner || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700">Routing Number:</p>
                          <p className="text-blue-900 font-mono">{existingBankDetails.routing_number || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700">Account Number:</p>
                          <p className="text-blue-900 font-mono">{existingBankDetails.account_number || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700">Account Type:</p>
                          <p className="text-blue-900 capitalize">{existingBankDetails.account_type || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Arrow indicator if both exist */}
                  {existingBankDetails && (
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <ArrowRight className="h-5 w-5" />
                        <span>Updated To</span>
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  )}

                  {/* New Banking Details */}
                  <div className={existingBankDetails ? "p-4 bg-green-50 border border-green-200 rounded-lg" : ""}>
                    {existingBankDetails && (
                      <p className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        New Bank Account Details (Requested Update)
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Account Owner</p>
                      <p className="text-sm font-semibold mt-1">{bankingDetails.bank_account_owner}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Bank Name</p>
                      <p className="text-sm font-semibold mt-1">{bankingDetails.bank_institution_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Routing Number</p>
                      <p className="text-sm font-mono mt-1">{bankingDetails.routing_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Account Number</p>
                      <p className="text-sm font-mono mt-1">{bankingDetails.account_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Account Type</p>
                      <p className="text-sm capitalize mt-1">{bankingDetails.account_type}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">New Draft Date</p>
                      <p className="text-sm font-semibold mt-1">
                        {format(new Date(bankingDetails.new_draft_date), 'MM/dd/yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Info Source</p>
                      <p className="text-sm capitalize mt-1">{bankingDetails.banking_info_source.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Policy Action</p>
                      <p className="text-sm capitalize mt-1">{bankingDetails.policy_action}</p>
                    </div>
                    {bankingDetails.additional_notes && (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Additional Notes</p>
                        <p className="text-sm mt-1 p-2 bg-muted rounded">
                          {bankingDetails.additional_notes}
                        </p>
                      </div>
                    )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {carrierDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Carrier Requirement Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Carrier</p>
                        <p className="text-sm font-semibold mt-1">{carrierDetails.carrier}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Requirement Type</p>
                        <p className="text-sm font-semibold mt-1">{carrierDetails.requirement_type}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Requirement Details</p>
                      <p className="text-sm mt-1 p-3 bg-muted rounded">
                        {carrierDetails.requirement_details}
                      </p>
                    </div>
                    {carrierDetails.additional_notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Additional Notes</p>
                        <p className="text-sm mt-1 p-2 bg-muted rounded">
                          {carrierDetails.additional_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments ({comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Comments List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {comment.user_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), 'MM/dd/yyyy HH:mm')}
                          </p>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                <Separator />

                {/* Add Comment */}
                <div className="space-y-2">
                  <Label htmlFor="newComment">Add Comment</Label>
                  <Textarea
                    id="newComment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    rows={3}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={submittingComment || !newComment.trim()}
                    className="w-full"
                  >
                    {submittingComment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Add Comment
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Status Update (1/3 width) */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Update Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="taskStatus">Status</Label>
                  <Select value={taskStatus} onValueChange={setTaskStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="statusNotes">Additional Notes</Label>
                  <Textarea
                    id="statusNotes"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Add notes about this update..."
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus}
                  className="w-full"
                >
                  {updatingStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Update Task
                    </>
                  )}
                </Button>

                {task.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">Task History</p>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted p-2 rounded max-h-48 overflow-y-auto">
                        {task.notes}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailView;
