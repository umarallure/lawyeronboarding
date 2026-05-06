import { type DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatAgentLabelFromEmail } from "@/lib/agentOptions";
import { getOnboardingTaskRoleFlags } from "@/lib/userPermissions";
import { cn } from "@/lib/utils";

import { TaskCalendar } from "./components/TaskCalendar";
import { TaskDetailsSheet } from "./components/TaskDetailsSheet";
import { TaskFormDialog } from "./components/TaskFormDialog";
import {
  TASK_DEADLINE_FILTER_OPTIONS,
  TASK_PORTAL_VALUE,
  TASK_PRIORITY_META,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_META,
  TASK_STATUS_OPTIONS,
  TASK_TAG_OPTIONS,
  formatTaskDate,
  formatTaskTag,
  getRelativeDeadlineLabel,
  isTaskOpen,
  matchesDeadlineFilter,
  sortTasks,
  toDateKey,
} from "./taskManagementUtils";
import type {
  OnboardingTask,
  OnboardingTaskNote,
  TaskAssigneeOption,
  TaskDeadlineFilter,
  TaskFormValues,
  TaskLawyerOption,
  TaskPriority,
  TaskStatus,
} from "./types";

type QueryResult<T> = Promise<{ data: T | null; error: unknown }>;

type TaskManagementDbClient = {
  from(table: "closer_tasks"): {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending: boolean }) => QueryResult<OnboardingTask[]>;
      };
    };
    update: (values: Partial<OnboardingTask>) => {
      eq: (column: string, value: string) => QueryResult<null>;
    };
    insert: (values: Partial<OnboardingTask>) => {
      select: (columns: string) => {
        single: () => QueryResult<OnboardingTask>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => QueryResult<null>;
    };
  };
  from(table: "closer_task_notes"): {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending: boolean }) => QueryResult<OnboardingTaskNote[]>;
      };
    };
    insert: (values: {
      task_id: string;
      author_user_id: string;
      author_name: string;
      content: string;
    }) => QueryResult<null>;
  };
};

type AppUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  is_super_admin?: boolean | null;
};

type AttorneyProfileRow = {
  user_id: string;
  full_name?: string | null;
  display_name?: string | null;
  firm_name?: string | null;
  primary_email?: string | null;
};

const taskDb = supabase as unknown as TaskManagementDbClient;

const safeTrimmedValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const dedupeAssignees = (options: TaskAssigneeOption[]) => {
  const map = new Map<string, TaskAssigneeOption>();
  options.forEach((option) => {
    if (!map.has(option.key)) {
      map.set(option.key, option);
    }
  });
  return Array.from(map.values()).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
};

const buildAssigneeLabel = (row: AppUserRow) => {
  const direct = (row.display_name || "").trim();
  if (direct) return direct;
  const email = (row.email || "").trim();
  if (email) {
    return formatAgentLabelFromEmail(email) || email;
  }
  return row.user_id;
};

const fetchAdminAssigneeOptions = async (): Promise<TaskAssigneeOption[]> => {
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        or: (filter: string) => Promise<{ data: AppUserRow[] | null; error: { message?: string } | null }>;
      };
    };
  };

  const { data, error } = await client
    .from("app_users")
    .select("user_id,email,display_name,role,is_super_admin")
    .or("role.eq.admin,role.eq.super_admin,is_super_admin.eq.true");

  if (error || !data) {
    return [];
  }

  const options: TaskAssigneeOption[] = data
    .filter((row) => row.user_id)
    .map((row) => ({ key: row.user_id, label: buildAssigneeLabel(row) }));

  return dedupeAssignees(options);
};

const escapeOrPattern = (value: string) =>
  value.replace(/[%(),]/g, " ").replace(/\s+/g, "%");

const searchLawyerOptions = async (query: string): Promise<TaskLawyerOption[]> => {
  const cleaned = query.trim();

  const usersClient = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (column: string, value: string) => {
          or?: (filter: string) => Promise<{ data: AppUserRow[] | null; error: { message?: string } | null }>;
          limit: (n: number) => Promise<{ data: AppUserRow[] | null; error: { message?: string } | null }>;
        };
      };
    };
  };

  let users: AppUserRow[] = [];

  if (cleaned.length > 0) {
    const pattern = `%${escapeOrPattern(cleaned)}%`;
    const builder = usersClient
      .from("app_users")
      .select("user_id,email,display_name,role")
      .eq("role", "lawyer");

    const orFilter = `display_name.ilike.${pattern},email.ilike.${pattern}`;
    const result = builder.or
      ? await builder.or(orFilter)
      : await builder.limit(20);

    users = (result.data || []) as AppUserRow[];
  } else {
    const result = await usersClient
      .from("app_users")
      .select("user_id,email,display_name,role")
      .eq("role", "lawyer")
      .limit(20);

    users = (result.data || []) as AppUserRow[];
  }

  if (users.length === 0) return [];

  const profilesClient = supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        in: (column: string, values: string[]) => Promise<{ data: AttorneyProfileRow[] | null; error: { message?: string } | null }>;
      };
    };
  };

  const userIds = users.map((row) => row.user_id);
  const { data: profileRows } = await profilesClient
    .from("attorney_profiles")
    .select("user_id,full_name,display_name,firm_name,primary_email")
    .in("user_id", userIds);

  const profileById = new Map<string, AttorneyProfileRow>();
  (profileRows || []).forEach((row) => {
    if (row.user_id) profileById.set(row.user_id, row);
  });

  const tokens = cleaned.toLowerCase().split(/\s+/).filter(Boolean);

  const options: TaskLawyerOption[] = users.map((row) => {
    const profile = profileById.get(row.user_id);
    const displayName =
      (profile?.full_name || profile?.display_name || row.display_name || "").trim() ||
      (row.email ? formatAgentLabelFromEmail(row.email) || row.email : row.user_id);
    const firmName = profile?.firm_name?.trim() || null;
    const email = (profile?.primary_email || row.email || "").trim() || null;

    return {
      id: row.user_id,
      reference: displayName,
      displayName,
      firmName,
      email,
    };
  });

  if (tokens.length === 0) {
    return options.sort((a, b) => a.displayName.localeCompare(b.displayName)).slice(0, 20);
  }

  return options
    .filter((option) => {
      const haystack = [option.displayName, option.firmName, option.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 20);
};

const KANBAN_COLUMNS: TaskStatus[] = ["waiting", "todo", "in_progress", "completed"];
const TASK_PRIORITY_CARD_STYLES: Record<
  TaskPriority,
  { borderClassName: string; gradientClassName: string }
> = {
  high: {
    borderClassName: "border-rose-500/35 hover:border-rose-400/70",
    gradientClassName: "from-rose-500/15 via-rose-500/5",
  },
  medium: {
    borderClassName: "border-amber-400/35 hover:border-amber-300/70",
    gradientClassName: "from-amber-400/15 via-amber-400/5",
  },
  low: {
    borderClassName: "border-emerald-400/30 hover:border-emerald-300/65",
    gradientClassName: "from-emerald-400/15 via-emerald-400/5",
  },
};

type TaskViewMode = "list" | "calendar" | "kanban";

const TaskManagementPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);
  const [canAccess, setCanAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>([]);
  const [currentUserAssignee, setCurrentUserAssignee] = useState<TaskAssigneeOption | null>(null);
  const [currentUserLabel, setCurrentUserLabel] = useState("");
  const [lawyerSearchResults, setLawyerSearchResults] = useState<TaskLawyerOption[]>([]);
  const [lawyerSearchLoading, setLawyerSearchLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<TaskDeadlineFilter>("all");
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<TaskPriority[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>("list");

  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const todayDateKey = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayDateKey);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);
  const [presetAssignee, setPresetAssignee] = useState<TaskAssigneeOption | null>(null);

  const [selectedTask, setSelectedTask] = useState<OnboardingTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [taskNotes, setTaskNotes] = useState<OnboardingTaskNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const isSelfOnlyView = canAccess && !isAdmin;

  const resolveCurrentUserLabel = useCallback(async () => {
    if (!user) return "";

    const fallback =
      formatAgentLabelFromEmail(user.email || "") || user.email || "Onboarding User";

    const profilesClient = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { display_name?: string | null } | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };

    const { data: appUser } = await profilesClient
      .from("app_users")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    return appUser?.display_name?.trim() || fallback;
  }, [user]);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return [];

    const { data, error } = await taskDb
      .from("closer_tasks")
      .select("*")
      .eq("portal", TASK_PORTAL_VALUE)
      .order("deadline_date", { ascending: true });

    if (error) {
      throw error;
    }

    const taskRows = ((data || []) as OnboardingTask[])
      .map((task) => ({
        ...task,
        tags: Array.isArray(task.tags) ? task.tags : [],
      }))
      .filter((task) =>
        isAdmin ||
        task.assignee_user_id === user.id ||
        task.created_by === user.id,
      );

    const lawyerIds = Array.from(
      new Set(taskRows.map((task) => task.lawyer_user_id).filter(Boolean)),
    ) as string[];

    if (lawyerIds.length === 0) {
      return taskRows;
    }

    const usersClient = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (col: string, values: string[]) => Promise<{
            data: AppUserRow[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };

    const profilesClient = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (col: string, values: string[]) => Promise<{
            data: AttorneyProfileRow[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };

    const [{ data: userRows }, { data: profileRows }] = await Promise.all([
      usersClient
        .from("app_users")
        .select("user_id,email,display_name,role")
        .in("user_id", lawyerIds),
      profilesClient
        .from("attorney_profiles")
        .select("user_id,full_name,display_name,firm_name,primary_email")
        .in("user_id", lawyerIds),
    ]);

    const userById = new Map<string, AppUserRow>();
    (userRows || []).forEach((row) => userById.set(row.user_id, row));

    const profileById = new Map<string, AttorneyProfileRow>();
    (profileRows || []).forEach((row) => {
      if (row.user_id) profileById.set(row.user_id, row);
    });

    return taskRows.map((task) => {
      const lawyerId = task.lawyer_user_id;
      if (!lawyerId) return task;

      const userRow = userById.get(lawyerId);
      const profile = profileById.get(lawyerId);
      const displayName =
        (profile?.full_name || profile?.display_name || userRow?.display_name || "").trim() ||
        (userRow?.email ? formatAgentLabelFromEmail(userRow.email) || userRow.email : null);

      return {
        ...task,
        lawyer_display_name: displayName || task.lawyer_reference || null,
        lawyer_firm_name: profile?.firm_name?.trim() || null,
        lawyer_email: profile?.primary_email?.trim() || userRow?.email || null,
      };
    });
  }, [isAdmin, user?.id]);

  const handleSearchLawyers = useCallback(async (query: string) => {
    setLawyerSearchLoading(true);
    try {
      const results = await searchLawyerOptions(query);
      setLawyerSearchResults(results);
    } catch (error) {
      console.error("Error searching lawyers:", error);
      setLawyerSearchResults([]);
    } finally {
      setLawyerSearchLoading(false);
    }
  }, []);

  const fetchTaskNotes = useCallback(
    async (taskId: string) => {
      setLoadingNotes(true);
      try {
        const { data, error } = await taskDb
          .from("closer_task_notes")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setTaskNotes((data || []) as OnboardingTaskNote[]);
      } catch (error) {
        console.error("Error fetching task notes:", error);
        toast({
          title: "Unable to load notes",
          description: "The task details opened, but note history could not be fetched.",
          variant: "destructive",
        });
      } finally {
        setLoadingNotes(false);
      }
    },
    [toast],
  );

  const loadData = useCallback(
    async (showRefreshToast = false) => {
      if (!user) return;

      setRefreshing(true);

      try {
        const [userLabel, adminAssignees, nextTasks] = await Promise.all([
          resolveCurrentUserLabel(),
          isAdmin ? fetchAdminAssigneeOptions() : Promise.resolve([]),
          fetchTasks(),
        ]);

        const me: TaskAssigneeOption = { key: user.id, label: userLabel };
        const nextAssignees = isAdmin
          ? dedupeAssignees([me, ...adminAssignees])
          : [me];

        setCurrentUserLabel(userLabel);
        setCurrentUserAssignee(me);
        setAssigneeOptions(nextAssignees);
        setTasks(nextTasks);

        if (showRefreshToast) {
          toast({
            title: "Task data refreshed",
            description: "The board is now synced with the latest assignments.",
          });
        }
      } catch (error) {
        console.error("Error loading task management data:", error);
        toast({
          title: "Unable to load task management",
          description: "Task data could not be loaded from Supabase.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchTasks, isAdmin, resolveCurrentUserLabel, toast, user],
  );

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    let isMounted = true;

    const checkAccess = async () => {
      const flags = await getOnboardingTaskRoleFlags(user.id);

      if (!isMounted) return;

      setIsAdmin(flags.isAdmin);
      setCanAccess(flags.canAccess);
      setCheckingAccess(false);

      if (!flags.canAccess) {
        toast({
          title: "Access denied",
          description: "Task Management is not available for your account.",
          variant: "destructive",
        });
        navigate("/manager-dashboard", { replace: true });
      }
    };

    void checkAccess();

    return () => {
      isMounted = false;
    };
  }, [navigate, toast, user]);

  useEffect(() => {
    if (!canAccess) return;
    void loadData();
  }, [canAccess, loadData]);

  useEffect(() => {
    if (!canAccess) return;

    const channel = supabase
      .channel("lawyer-onboarding-task-management")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "closer_tasks",
          filter: `portal=eq.${TASK_PORTAL_VALUE}`,
        },
        () => {
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "closer_task_notes" },
        (payload) => {
          const taskId = selectedTask?.id;
          const changedTaskId =
            (payload.new as { task_id?: string } | null)?.task_id ||
            (payload.old as { task_id?: string } | null)?.task_id;

          if (taskId && changedTaskId === taskId) {
            void fetchTaskNotes(taskId);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, fetchTaskNotes, loadData, selectedTask?.id]);

  useEffect(() => {
    if (!selectedTask) return;
    const refreshedTask = tasks.find((task) => task.id === selectedTask.id) || null;

    if (!refreshedTask) {
      setSelectedTask(null);
      setDetailOpen(false);
      return;
    }

    if (refreshedTask !== selectedTask) {
      setSelectedTask(refreshedTask);
    }
  }, [selectedTask, tasks]);

  useEffect(() => {
    if (!selectedTask || !detailOpen) return;
    void fetchTaskNotes(selectedTask.id);
  }, [detailOpen, fetchTaskNotes, selectedTask]);

  useEffect(() => {
    if (!isSelfOnlyView) return;
    setAssigneeFilter("mine");
  }, [isSelfOnlyView]);

  const filteredTasks = useMemo(() => {
    let nextTasks = [...tasks];

    if (isSelfOnlyView) {
      nextTasks = nextTasks.filter((task) => task.assignee_user_id === user?.id);
    } else if (assigneeFilter === "mine") {
      nextTasks = nextTasks.filter((task) => task.assignee_user_id === user?.id);
    } else if (assigneeFilter !== "all") {
      nextTasks = nextTasks.filter((task) => task.assignee_user_id === assigneeFilter);
    }

    if (deadlineFilter !== "all") {
      nextTasks = nextTasks.filter((task) =>
        matchesDeadlineFilter(task, deadlineFilter, todayDateKey),
      );
    }

    if (statusFilters.length > 0) {
      nextTasks = nextTasks.filter((task) => statusFilters.includes(task.status));
    }

    if (priorityFilters.length > 0) {
      nextTasks = nextTasks.filter((task) => priorityFilters.includes(task.priority));
    }

    if (tagFilters.length > 0) {
      nextTasks = nextTasks.filter((task) =>
        tagFilters.some((tag) => task.tags.includes(tag)),
      );
    }

    if (searchTerm.trim()) {
      const query = searchTerm.trim().toLowerCase();
      nextTasks = nextTasks.filter((task) => {
        const haystack = [
          task.title,
          task.description,
          task.assignee_name,
          task.created_by_name,
          task.lawyer_reference,
          task.lawyer_display_name,
          task.lawyer_firm_name,
          task.lawyer_email,
          ...task.tags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    return sortTasks(nextTasks);
  }, [
    assigneeFilter,
    deadlineFilter,
    isSelfOnlyView,
    priorityFilters,
    searchTerm,
    statusFilters,
    tagFilters,
    tasks,
    todayDateKey,
    user?.id,
  ]);

  const deadlineSortedTasks = useMemo(
    () =>
      [...filteredTasks].sort((left, right) => {
        const leftDeadline = parseISO(left.deadline_date).getTime();
        const rightDeadline = parseISO(right.deadline_date).getTime();
        if (leftDeadline !== rightDeadline) {
          return leftDeadline - rightDeadline;
        }
        return right.created_at.localeCompare(left.created_at);
      }),
    [filteredTasks],
  );

  const assigneeFocusLabel = useMemo(() => {
    if (assigneeFilter === "all") return "All Assignees";
    if (assigneeFilter === "mine") return currentUserLabel || "My Tasks";
    return (
      assigneeOptions.find((option) => option.key === assigneeFilter)?.label ||
      "Focused Assignee"
    );
  }, [assigneeFilter, assigneeOptions, currentUserLabel]);

  const metricTasks = useMemo(() => {
    if (isSelfOnlyView) {
      return tasks.filter((task) => task.assignee_user_id === user?.id);
    }
    return tasks;
  }, [isSelfOnlyView, tasks, user?.id]);

  const metrics = useMemo(() => {
    const today = parseISO(todayDateKey);
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 });
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 0 });

    return {
      openTasks: metricTasks.filter((task) => isTaskOpen(task)).length,
      pending: metricTasks.filter((task) => task.status === "waiting").length,
      overdue: metricTasks.filter((task) => {
        if (!isTaskOpen(task)) return false;
        return parseISO(task.deadline_date) < today;
      }).length,
      completedThisWeek: metricTasks.filter((task) => {
        if (!task.completed_at) return false;
        const completedDate = new Date(task.completed_at);
        return completedDate >= startOfCurrentWeek && completedDate <= endOfCurrentWeek;
      }).length,
    };
  }, [metricTasks, todayDateKey]);

  const kanbanColumns = useMemo(
    () =>
      KANBAN_COLUMNS.map((status) => ({
        status,
        tasks: filteredTasks.filter((task) => task.status === status),
      })),
    [filteredTasks],
  );

  const greetingName =
    currentUserLabel || formatAgentLabelFromEmail(user?.email || "") || "there";
  const boardScopeLabel = isSelfOnlyView ? "My Tasks" : assigneeFocusLabel;
  const boardTaskCount = filteredTasks.length;
  const activeFilterCount = [
    Boolean(searchTerm.trim()),
    !isSelfOnlyView && assigneeFilter !== "all",
    deadlineFilter !== "all",
    statusFilters.length > 0,
    priorityFilters.length > 0,
    tagFilters.length > 0,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const openTaskDetails = (task: OnboardingTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const openCreateDialog = (preset: TaskAssigneeOption | null = null) => {
    setEditingTask(null);
    setPresetAssignee(preset);
    setTaskDialogOpen(true);
  };

  const canEditTask = useCallback(
    (task: OnboardingTask | null) => {
      if (!task || !user?.id) return false;
      return isAdmin || task.assignee_user_id === user.id;
    },
    [isAdmin, user?.id],
  );

  const openEditDialog = (task: OnboardingTask) => {
    if (!canEditTask(task)) {
      toast({
        title: "Edit unavailable",
        description: "You can only edit tasks assigned to you.",
        variant: "destructive",
      });
      return;
    }

    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setAssigneeFilter(isSelfOnlyView ? "mine" : "all");
    setDeadlineFilter("all");
    setStatusFilters([]);
    setPriorityFilters([]);
    setTagFilters([]);
  };

  const createTaskNote = useCallback(
    async (taskId: string, content: string) => {
      if (!user) return;

      const { error } = await taskDb
        .from("closer_task_notes")
        .insert({
          task_id: taskId,
          author_user_id: user.id,
          author_name: currentUserLabel,
          content,
        });

      if (error) throw error;
    },
    [currentUserLabel, user],
  );

  const handleSaveTask = async (values: TaskFormValues) => {
    if (!user) return;

    if (editingTask && !canEditTask(editingTask)) {
      toast({
        title: "Unable to save task",
        description: "You can only update tasks assigned to you.",
        variant: "destructive",
      });
      throw new Error("Task edit is outside the current user's scope.");
    }

    const assigneeUserId = isSelfOnlyView ? user.id : values.assigneeUserId;
    const assigneeName = isSelfOnlyView ? currentUserLabel : values.assigneeName;

    const payload: Partial<OnboardingTask> = {
      title: values.title,
      description: safeTrimmedValue(values.description),
      lawyer_user_id: safeTrimmedValue(values.lawyerUserId),
      lawyer_reference: safeTrimmedValue(values.lawyerReference),
      assignee_user_id: assigneeUserId,
      assignee_name: assigneeName,
      status: values.status,
      priority: values.priority,
      deadline_date: values.deadlineDate,
      tags: values.tags,
    };

    try {
      let taskId = editingTask?.id || null;

      if (editingTask) {
        const { error } = await taskDb
          .from("closer_tasks")
          .update(payload)
          .eq("id", editingTask.id);

        if (error) throw error;
      } else {
        const { data, error } = await taskDb
          .from("closer_tasks")
          .insert({
            ...payload,
            portal: TASK_PORTAL_VALUE,
            assigned_date: todayDateKey,
            created_by: user.id,
            created_by_name: currentUserLabel,
          })
          .select("*")
          .single();

        if (error) throw error;

        taskId = (data as OnboardingTask).id;
      }

      toast({
        title: editingTask ? "Task updated" : "Task created",
        description: editingTask
          ? "The task details and calendar entry have been updated."
          : "The task was assigned and added to the calendar.",
      });

      setTaskDialogOpen(false);
      setEditingTask(null);
      await loadData();

      if (taskId) {
        const refreshedTask =
          (await fetchTasks()).find((task) => task.id === taskId) || null;
        if (refreshedTask && detailOpen) {
          setSelectedTask(refreshedTask);
          await fetchTaskNotes(taskId);
        }
      }
    } catch (error) {
      console.error("Error saving task:", error);
      toast({
        title: "Unable to save task",
        description: "Please review the task details and try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUpdateTaskStatus = async (
    task: OnboardingTask,
    status: TaskStatus,
  ) => {
    if (!canEditTask(task)) {
      toast({
        title: "Unable to update status",
        description: "You can only update tasks assigned to you.",
        variant: "destructive",
      });
      throw new Error("Task status update is outside the current user's scope.");
    }

    try {
      const { error } = await taskDb
        .from("closer_tasks")
        .update({ status })
        .eq("id", task.id);

      if (error) throw error;

      toast({
        title: "Task status updated",
        description: `${task.title} is now marked ${TASK_STATUS_META[status].label.toLowerCase()}.`,
      });

      await loadData();
      await fetchTaskNotes(task.id);
    } catch (error) {
      console.error("Error updating task status:", error);
      toast({
        title: "Unable to update status",
        description: "The task status could not be updated.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteTask = async (task: OnboardingTask) => {
    if (!isAdmin) {
      toast({
        title: "Unable to delete task",
        description: "Only admins can delete tasks.",
        variant: "destructive",
      });
      throw new Error("Task deletion requires admin access.");
    }

    try {
      const { error } = await taskDb
        .from("closer_tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;

      toast({
        title: "Task deleted",
        description: `${task.title} was removed from the board.`,
      });

      setDetailOpen(false);
      setSelectedTask(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Unable to delete task",
        description: "The task could not be removed. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleAddTaskNote = async (task: OnboardingTask, content: string) => {
    if (!canEditTask(task)) {
      toast({
        title: "Unable to add note",
        description: "You can only add notes to tasks assigned to you.",
        variant: "destructive",
      });
      throw new Error("Task note is outside the current user's scope.");
    }

    try {
      await createTaskNote(task.id, content);
      toast({
        title: "Note posted",
        description: "The update is now attached to the task timeline.",
      });
      await fetchTaskNotes(task.id);
    } catch (error) {
      console.error("Error adding task note:", error);
      toast({
        title: "Unable to add note",
        description: "The note could not be attached to this task.",
        variant: "destructive",
      });
      throw error;
    }
  };

  if (checkingAccess || loading) {
    return (
      <div className="min-h-full bg-background">
        <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Loading task management
              </p>
              <p className="text-sm text-muted-foreground">
                Verifying access and syncing your task board.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="min-h-full overflow-hidden bg-background">
      <div className="relative min-h-full">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--primary)/0.12),transparent_34%),radial-gradient(circle_at_86%_12%,hsl(var(--accent)/0.10),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="relative mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-4 lg:px-6 lg:py-6">
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,480px)] xl:items-end">
            <div className="min-w-0 space-y-3">
              <Badge
                variant="outline"
                className="rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-primary"
              >
                {isSelfOnlyView
                  ? "Onboarding task workspace"
                  : "Admin task control center"}
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                  Hello, {greetingName}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {isSelfOnlyView
                    ? "Review your workload and move each item through the onboarding pipeline."
                    : "Manage onboarding assignments, inspect deadline pressure, and keep the team task board current."}
                </p>
              </div>
            </div>

            <TaskSignalCard metrics={metrics} />
          </section>

          <Card className="overflow-hidden border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border px-4 py-4 lg:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl font-semibold">
                      {boardScopeLabel}
                    </CardTitle>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                      {boardTaskCount} task{boardTaskCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Search, filter, and switch views without leaving the active task workspace.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void loadData(true)}
                    disabled={refreshing}
                  >
                    <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                    Refresh
                  </Button>
                  <Button onClick={() => openCreateDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Task
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Tabs
                    value={taskViewMode}
                    onValueChange={(value) => setTaskViewMode(value as TaskViewMode)}
                    className="w-full sm:w-auto"
                  >
                    <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl border border-border bg-muted/40 p-1 sm:w-[380px]">
                      <TabsTrigger
                        value="list"
                        className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground"
                      >
                        <LayoutList className="h-4 w-4" />
                        List
                      </TabsTrigger>
                      <TabsTrigger
                        value="calendar"
                        className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Calendar
                      </TabsTrigger>
                      <TabsTrigger
                        value="kanban"
                        className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground"
                      >
                        <Columns3 className="h-4 w-4" />
                        Kanban
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 justify-between sm:min-w-[132px]"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          Filters
                        </span>
                        {activeFilterCount > 0 ? (
                          <Badge className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                            {activeFilterCount}
                          </Badge>
                        ) : null}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[min(92vw,760px)] border border-border bg-popover p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2 xl:col-span-2">
                          <Label
                            htmlFor="task-search"
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                          >
                            <Search className="h-4 w-4" />
                            Search
                          </Label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="task-search"
                              value={searchTerm}
                              onChange={(event) => setSearchTerm(event.target.value)}
                              placeholder="Title, lawyer, assignee, tag..."
                              className="h-10 pl-9"
                            />
                          </div>
                        </div>

                        {!isSelfOnlyView ? (
                          <div className="space-y-2">
                            <Label
                              htmlFor="assignee-filter"
                              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                            >
                              Assignee
                            </Label>
                            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                              <SelectTrigger id="assignee-filter" className="h-10">
                                <SelectValue placeholder="All assignees" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Assignees</SelectItem>
                                <SelectItem value="mine">My Tasks</SelectItem>
                                {assigneeOptions.map((option) => (
                                  <SelectItem key={option.key} value={option.key}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <Label
                            htmlFor="deadline-filter"
                            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                          >
                            Deadline
                          </Label>
                          <Select
                            value={deadlineFilter}
                            onValueChange={(value) =>
                              setDeadlineFilter(value as TaskDeadlineFilter)
                            }
                          >
                            <SelectTrigger id="deadline-filter" className="h-10">
                              <SelectValue placeholder="All deadlines" />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_DEADLINE_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Status
                          </Label>
                          <MultiSelect
                            options={TASK_STATUS_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            selected={statusFilters}
                            onChange={(selected) => setStatusFilters(selected as TaskStatus[])}
                            placeholder="All statuses"
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Priority
                          </Label>
                          <MultiSelect
                            options={TASK_PRIORITY_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            selected={priorityFilters}
                            onChange={(selected) =>
                              setPriorityFilters(selected as TaskPriority[])
                            }
                            placeholder="All priorities"
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Tags
                          </Label>
                          <MultiSelect
                            options={TASK_TAG_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            selected={tagFilters}
                            onChange={setTagFilters}
                            placeholder="All tags"
                            className="w-full"
                          />
                        </div>
                      </div>

                      {hasActiveFilters ? (
                        <div className="mt-4 flex justify-end border-t border-border pt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                          >
                            Clear filters
                          </Button>
                        </div>
                      ) : null}
                    </PopoverContent>
                  </Popover>
                </div>

                {taskViewMode === "calendar" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCalendarMonth((previous) => addMonths(previous, -1))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex min-w-[170px] items-center justify-center gap-2 px-2 text-sm font-semibold">
                      <CalendarRange className="h-4 w-4 text-primary" />
                      {format(calendarMonth, "MMMM yyyy")}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setCalendarMonth((previous) => addMonths(previous, 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 lg:p-5">
              {taskViewMode === "list" ? (
                <TaskListPanel
                  tasks={deadlineSortedTasks}
                  todayDateKey={todayDateKey}
                  onOpenTask={openTaskDetails}
                  emptyDescription={
                    isSelfOnlyView
                      ? "Adjust the filters or create a new self-assigned task."
                      : "Adjust the filters or create a new task to populate the board."
                  }
                />
              ) : null}

              {taskViewMode === "calendar" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Priority legend:</span>
                    {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                      <span
                        key={priority}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1"
                      >
                        <span
                          className={cn(
                            "h-3 w-1.5 rounded-full",
                            TASK_PRIORITY_META[priority].railClassName,
                          )}
                        />
                        {TASK_PRIORITY_META[priority].label}
                      </span>
                    ))}
                  </div>

                  <TaskCalendar
                    month={calendarMonth}
                    selectedDate={selectedDate}
                    tasks={filteredTasks}
                    onSelectDate={setSelectedDate}
                    onOpenTask={openTaskDetails}
                  />
                </div>
              ) : null}

              {taskViewMode === "kanban" ? (
                <TaskKanbanPanel
                  columns={kanbanColumns}
                  todayDateKey={todayDateKey}
                  onOpenTask={openTaskDetails}
                  onMoveTask={(task, status) => {
                    if (task.status !== status) {
                      void handleUpdateTaskStatus(task, status).catch(() => undefined);
                    }
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <TaskFormDialog
        open={taskDialogOpen}
        initialTask={editingTask}
        initialAssignee={presetAssignee}
        assigneeOptions={assigneeOptions}
        currentUserAssignee={currentUserAssignee}
        selfAssignOnly={isSelfOnlyView}
        lawyerOptions={lawyerSearchResults}
        lawyerSearchLoading={lawyerSearchLoading}
        onLawyerSearch={handleSearchLawyers}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) {
            setEditingTask(null);
            setPresetAssignee(null);
            setLawyerSearchResults([]);
          }
        }}
        onSave={handleSaveTask}
      />

      <TaskDetailsSheet
        open={detailOpen}
        task={selectedTask}
        notes={taskNotes}
        loadingNotes={loadingNotes}
        todayDateKey={todayDateKey}
        canEditTask={canEditTask(selectedTask)}
        canDeleteTask={isAdmin}
        onOpenChange={setDetailOpen}
        onEdit={openEditDialog}
        onUpdateStatus={handleUpdateTaskStatus}
        onAddNote={handleAddTaskNote}
        onDelete={handleDeleteTask}
      />
    </div>
  );
};

interface TaskSignalCardProps {
  metrics: {
    openTasks: number;
    pending: number;
    overdue: number;
    completedThisWeek: number;
  };
}

function TaskSignalCard({ metrics }: TaskSignalCardProps) {
  const segments = [
    { label: "Open", value: metrics.openTasks, dot: "bg-foreground/70" },
    { label: "Pending", value: metrics.pending, dot: "bg-amber-500" },
    { label: "Overdue", value: metrics.overdue, dot: "bg-rose-500" },
    { label: "Completed", value: metrics.completedThisWeek, dot: "bg-emerald-500" },
  ];

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Task Signal
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {segments.map((segment) => (
            <div key={segment.label} className="rounded-xl border border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", segment.dot)} />
                {segment.label}
              </div>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {segment.value}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskListPanelProps {
  tasks: OnboardingTask[];
  todayDateKey: string;
  onOpenTask: (task: OnboardingTask) => void;
  emptyDescription: string;
}

function TaskListPanel({
  tasks,
  todayDateKey,
  onOpenTask,
  emptyDescription,
}: TaskListPanelProps) {
  if (tasks.length === 0) {
    return <EmptyTaskState description={emptyDescription} />;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskPreviewButton
          key={task.id}
          task={task}
          todayDateKey={todayDateKey}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}

interface TaskKanbanPanelProps {
  columns: Array<{ status: TaskStatus; tasks: OnboardingTask[] }>;
  todayDateKey: string;
  onOpenTask: (task: OnboardingTask) => void;
  onMoveTask: (task: OnboardingTask, status: TaskStatus) => void;
}

function TaskKanbanPanel({
  columns,
  todayDateKey,
  onOpenTask,
  onMoveTask,
}: TaskKanbanPanelProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const taskCount = columns.reduce((count, column) => count + column.tasks.length, 0);
  const taskById = useMemo(() => {
    const map = new Map<string, OnboardingTask>();
    columns.forEach((column) => {
      column.tasks.forEach((task) => {
        map.set(task.id, task);
      });
    });
    return map;
  }, [columns]);

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, task: OnboardingTask) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setDraggingTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
    const draggedTask = taskId ? taskById.get(taskId) : null;

    setDraggingTaskId(null);
    setDragOverStatus(null);

    if (!draggedTask || draggedTask.status === status) return;

    onMoveTask(draggedTask, status);
  };

  if (taskCount === 0) {
    return <EmptyTaskState description="No tasks match the current kanban filters." />;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      {columns.map((column) => (
        <div
          key={column.status}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDragOverStatus((currentStatus) =>
              currentStatus === column.status ? currentStatus : column.status,
            );
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setDragOverStatus(null);
          }}
          onDrop={(event) => handleDrop(event, column.status)}
          className={cn(
            "flex min-h-[420px] flex-col rounded-2xl border border-border bg-muted/30 p-3 transition",
            dragOverStatus === column.status &&
              "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                TASK_STATUS_META[column.status].badgeClassName,
              )}
            >
              {TASK_STATUS_META[column.status].label}
            </Badge>
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {column.tasks.length}
            </span>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {column.tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                No tasks in this stage.
              </div>
            ) : (
              column.tasks.map((task) => (
                <TaskPreviewButton
                  key={task.id}
                  task={task}
                  todayDateKey={todayDateKey}
                  onOpenTask={onOpenTask}
                  draggable
                  isDragging={draggingTaskId === task.id}
                  onDragStart={(event) => handleDragStart(event, task)}
                  onDragEnd={handleDragEnd}
                  compact
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TaskPreviewButtonProps {
  task: OnboardingTask;
  todayDateKey: string;
  onOpenTask: (task: OnboardingTask) => void;
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
}

function TaskPreviewButton({
  task,
  todayDateKey,
  onOpenTask,
  compact = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: TaskPreviewButtonProps) {
  const deadlineSignal = getRelativeDeadlineLabel(task, todayDateKey);
  const assignmentSourceLabel =
    task.assignee_user_id === task.created_by
      ? "Self-assigned"
      : `Assigned by ${task.created_by_name}`;
  const priorityCardStyle =
    task.status === "completed"
      ? TASK_PRIORITY_CARD_STYLES.low
      : TASK_PRIORITY_CARD_STYLES[task.priority];

  const lawyerLabel =
    task.lawyer_display_name || task.lawyer_reference || null;

  if (compact) {
    return (
      <button
        type="button"
        draggable={draggable}
        onClick={() => onOpenTask(task)}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-card px-3 py-3 text-left transition hover:shadow-sm",
          priorityCardStyle.borderClassName,
          draggable && "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-60 ring-2 ring-primary/40",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-[72%] bg-gradient-to-r to-transparent opacity-75 transition-opacity group-hover:opacity-100",
            priorityCardStyle.gradientClassName,
          )}
        />
        <span
          className={cn(
            "relative mt-1 h-9 w-1.5 shrink-0 rounded-full",
            TASK_PRIORITY_META[task.priority].railClassName,
          )}
        />
        <div className="relative min-w-0 flex-1">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {task.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className={TASK_STATUS_META[task.status].badgeClassName}
            >
              {TASK_STATUS_META[task.status].label}
            </Badge>
            {lawyerLabel ? (
              <Badge
                variant="outline"
                className="rounded-full border-primary/40 bg-primary/10 text-[10px] font-medium text-primary"
              >
                {lawyerLabel}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-xs font-medium text-primary">{deadlineSignal}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Due {formatTaskDate(task.deadline_date)}
          </p>
          <div className="mt-2">
            <Badge
              variant="outline"
              className={TASK_PRIORITY_META[task.priority].badgeClassName}
            >
              {TASK_PRIORITY_META[task.priority].label.replace(" Priority", "")}
            </Badge>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      draggable={draggable}
      onClick={() => onOpenTask(task)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border bg-card px-4 py-3 text-left transition hover:shadow-md",
        priorityCardStyle.borderClassName,
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60 ring-2 ring-primary/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[58%] bg-gradient-to-r to-transparent opacity-75 transition-opacity group-hover:opacity-100",
          priorityCardStyle.gradientClassName,
        )}
      />
      <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(130px,0.62fr)_minmax(145px,0.7fr)_minmax(135px,0.58fr)]">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-1 h-9 w-1.5 shrink-0 rounded-full",
              TASK_PRIORITY_META[task.priority].railClassName,
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 max-w-full truncate text-base font-semibold text-foreground">
                {task.title}
              </p>
              <Badge
                variant="outline"
                className={TASK_STATUS_META[task.status].badgeClassName}
              >
                {TASK_STATUS_META[task.status].label}
              </Badge>
            </div>

            {task.description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                {task.description}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {task.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="rounded-full border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {formatTaskTag(tag)}
                </Badge>
              ))}
              {task.tags.length > 3 ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  +{task.tags.length - 3}
                </Badge>
              ) : null}
              {lawyerLabel ? (
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {lawyerLabel}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <TaskFactBlock
          label="Assignee"
          primary={task.assignee_name}
          secondary={assignmentSourceLabel}
        />
        <TaskFactBlock
          label="Dates"
          primary={`Assigned ${formatTaskDate(task.assigned_date)}`}
          secondary={`Due ${formatTaskDate(task.deadline_date)}`}
        />
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Deadline Signal
          </p>
          <p className="text-sm font-medium text-primary">{deadlineSignal}</p>
          <Badge
            variant="outline"
            className={TASK_PRIORITY_META[task.priority].badgeClassName}
          >
            {TASK_PRIORITY_META[task.priority].label}
          </Badge>
        </div>
      </div>
    </button>
  );
}

interface TaskFactBlockProps {
  label: string;
  primary: string;
  secondary?: string;
  primaryClassName?: string;
}

function TaskFactBlock({
  label,
  primary,
  secondary,
  primaryClassName,
}: TaskFactBlockProps) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-sm font-medium text-foreground", primaryClassName)}>
        {primary}
      </p>
      {secondary ? (
        <p className="text-sm text-muted-foreground">{secondary}</p>
      ) : null}
    </div>
  );
}

interface EmptyTaskStateProps {
  description: string;
  title?: string;
  compact?: boolean;
}

function EmptyTaskState({
  description,
  title = "No tasks match the current filters",
  compact = false,
}: EmptyTaskStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-muted/20 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      {!compact ? (
        <p className="text-base font-medium text-foreground">{title}</p>
      ) : null}
      <p className={cn("text-sm text-muted-foreground", !compact && "mt-2")}>
        {description}
      </p>
    </div>
  );
}

export default TaskManagementPage;
