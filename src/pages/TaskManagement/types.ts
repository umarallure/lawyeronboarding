export type TaskStatus = "todo" | "in_progress" | "waiting" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskDeadlineFilter = "all" | "today" | "this_week" | "overdue" | "upcoming";

export interface OnboardingTask {
  id: string;
  title: string;
  description: string | null;
  lawyer_user_id: string | null;
  lawyer_reference: string | null;
  assignee_user_id: string;
  assignee_name: string;
  created_by: string;
  created_by_name: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  assigned_date: string;
  deadline_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  portal: "lawyer_onboarding";
  lawyer_display_name?: string | null;
  lawyer_firm_name?: string | null;
  lawyer_email?: string | null;
}

export interface OnboardingTaskNote {
  id: string;
  task_id: string;
  author_user_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
}

export interface TaskAssigneeOption {
  key: string;
  label: string;
}

export interface TaskLawyerOption {
  id: string;
  reference: string;
  displayName: string;
  firmName: string | null;
  email: string | null;
}

export interface TaskFormValues {
  title: string;
  description: string;
  lawyerUserId: string;
  lawyerReference: string;
  assigneeUserId: string;
  assigneeName: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineDate: string;
  tags: string[];
}
