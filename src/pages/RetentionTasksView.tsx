import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Clock, Eye, Search, Filter, MessageSquare, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  notes: string | null;
}

interface Comment {
  id: string;
  user_name: string;
  comment: string;
  created_at: string;
}

const RetentionTasksView = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AppFixTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTaskType, setFilterTaskType] = useState<string>("all");
  const [filterAssignedTo, setFilterAssignedTo] = useState<string>("all");
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  
  // Comments modal state
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AppFixTask | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  
  const { toast } = useToast();

  const fetchTasks = async () => {
    try {
      setLoading(true);

      // Get current user's display name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const displayName = profile?.display_name || '';
      setUserDisplayName(displayName);

      // Fetch tasks created by this user
      const { data: tasksData, error } = await supabase
        .from('app_fix_tasks' as any)
        .select('*')
        .eq('created_by_name', displayName)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        toast({
          title: "Error",
          description: "Failed to fetch tasks",
          variant: "destructive",
        });
        return;
      }

      setTasks((tasksData as any) || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleViewTask = (task: AppFixTask) => {
    navigate(`/task/${task.id}`);
  };

  const handleViewComments = async (task: AppFixTask) => {
    setSelectedTask(task);
    setCommentsModalOpen(true);
    setLoadingComments(true);

    try {
      const { data, error } = await supabase
        .from('app_fix_task_comments' as any)
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setComments((data as any) || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch comments",
        variant: "destructive",
      });
    } finally {
      setLoadingComments(false);
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
        return 'Banking Info';
      case 'carrier_requirement':
        return 'Carrier Requirement';
      case 'updated_banking_info':
        return 'Banking Update';
      default:
        return fixType;
    }
  };

  // Filter tasks based on search and filters
  const filterTasks = (taskList: AppFixTask[]) => {
    return taskList.filter(task => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        task.customer_name?.toLowerCase().includes(searchLower) ||
        task.submission_id.toLowerCase().includes(searchLower);

      const matchesTaskType = filterTaskType === 'all' || task.fix_type === filterTaskType;

      const matchesAssignedTo = filterAssignedTo === 'all' || 
        task.assigned_to_name?.toLowerCase() === filterAssignedTo.toLowerCase();

      return matchesSearch && matchesTaskType && matchesAssignedTo;
    });
  };

  // Get unique assigned agent names for filter dropdown
  const uniqueAssignedAgents = Array.from(new Set(
    tasks.map(t => t.assigned_to_name).filter(Boolean)
  )).sort();

  const allFilteredTasks = filterTasks(tasks);
  const pendingTasks = filterTasks(tasks.filter(t => t.status === 'pending' || t.status === 'in_progress'));
  const completedTasks = filterTasks(tasks.filter(t => t.status === 'completed'));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-lg">Loading Tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">
                View and track tasks you've created for licensed agents
              </p>
            </div>
            <Button variant="outline" onClick={fetchTasks}>
              <Loader2 className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Customer name or Submission ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Task Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="taskType">Task Type</Label>
                  <Select value={filterTaskType} onValueChange={setFilterTaskType}>
                    <SelectTrigger id="taskType">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="banking_info">Banking Info</SelectItem>
                      <SelectItem value="carrier_requirement">Carrier Requirement</SelectItem>
                      <SelectItem value="updated_banking_info">Banking Update (Legacy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned To Filter */}
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <Select value={filterAssignedTo} onValueChange={setFilterAssignedTo}>
                    <SelectTrigger id="assignedTo">
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Licensed Agents</SelectItem>
                      {uniqueAssignedAgents.map((agent) => (
                        <SelectItem key={agent} value={agent || 'unknown'}>
                          {agent || 'Unknown Agent'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters */}
              {(searchTerm || filterTaskType !== 'all' || filterAssignedTo !== 'all') && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterTaskType("all");
                      setFilterAssignedTo("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="all">
                All ({allFilteredTasks.length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({pendingTasks.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <TaskTable 
                tasks={allFilteredTasks}
                getStatusBadge={getStatusBadge}
                getFixTypeLabel={getFixTypeLabel}
                handleViewTask={handleViewTask}
                handleViewComments={handleViewComments}
              />
            </TabsContent>

            <TabsContent value="pending" className="mt-6">
              <TaskTable 
                tasks={pendingTasks}
                getStatusBadge={getStatusBadge}
                getFixTypeLabel={getFixTypeLabel}
                handleViewTask={handleViewTask}
                handleViewComments={handleViewComments}
                emptyMessage="No pending tasks"
              />
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              <TaskTable 
                tasks={completedTasks}
                getStatusBadge={getStatusBadge}
                getFixTypeLabel={getFixTypeLabel}
                handleViewTask={handleViewTask}
                handleViewComments={handleViewComments}
                emptyMessage="No completed tasks"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Comments Modal */}
      <Dialog open={commentsModalOpen} onOpenChange={setCommentsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Task Comments
            </DialogTitle>
            {selectedTask && (
              <DialogDescription>
                <div className="mt-2 space-y-1">
                  <p><strong>Customer:</strong> {selectedTask.customer_name || 'N/A'}</p>
                  <p><strong>Submission ID:</strong> {selectedTask.submission_id}</p>
                  <p><strong>Task Type:</strong> {getFixTypeLabel(selectedTask.fix_type)}</p>
                  <p><strong>Assigned To:</strong> {selectedTask.assigned_to_name || 'N/A'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <strong>Status:</strong> {getStatusBadge(selectedTask.status)}
                  </div>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-4">
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No comments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
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
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Reusable table component
interface TaskTableProps {
  tasks: AppFixTask[];
  getStatusBadge: (status: string) => JSX.Element;
  getFixTypeLabel: (fixType: string) => string;
  handleViewTask: (task: AppFixTask) => void;
  handleViewComments: (task: AppFixTask) => void;
  emptyMessage?: string;
}

const TaskTable = ({ 
  tasks, 
  getStatusBadge, 
  getFixTypeLabel, 
  handleViewTask, 
  handleViewComments,
  emptyMessage = "No tasks found"
}: TaskTableProps) => {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-lg">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Submission ID</TableHead>
                <TableHead>Task Type</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    {task.customer_name || 'N/A'}
                  </TableCell>
                  <TableCell>{task.submission_id}</TableCell>
                  <TableCell>{getFixTypeLabel(task.fix_type)}</TableCell>
                  <TableCell>{task.assigned_to_name || 'N/A'}</TableCell>
                  <TableCell>
                    {format(new Date(task.created_at), 'MM/dd/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewComments(task)}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Comments
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RetentionTasksView;
