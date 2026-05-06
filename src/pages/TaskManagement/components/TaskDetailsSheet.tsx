import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  BriefcaseBusiness,
  CalendarClock,
  ExternalLink,
  Mail,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_OPTIONS,
  formatTaskDate,
  formatTaskTag,
  getRelativeDeadlineLabel,
} from "../taskManagementUtils";
import type { OnboardingTask, OnboardingTaskNote, TaskStatus } from "../types";

interface TaskDetailsSheetProps {
  open: boolean;
  task: OnboardingTask | null;
  notes: OnboardingTaskNote[];
  loadingNotes: boolean;
  todayDateKey: string;
  canEditTask: boolean;
  canDeleteTask?: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: OnboardingTask) => void;
  onUpdateStatus: (task: OnboardingTask, status: TaskStatus) => Promise<void>;
  onAddNote: (task: OnboardingTask, content: string) => Promise<void>;
  onDelete?: (task: OnboardingTask) => Promise<void>;
}

export function TaskDetailsSheet({
  open,
  task,
  notes,
  loadingNotes,
  todayDateKey,
  canEditTask,
  canDeleteTask = false,
  onOpenChange,
  onEdit,
  onUpdateStatus,
  onAddNote,
  onDelete,
}: TaskDetailsSheetProps) {
  const navigate = useNavigate();
  const [statusDraft, setStatusDraft] = useState<TaskStatus>("todo");
  const [noteDraft, setNoteDraft] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  useEffect(() => {
    if (!task) return;
    setStatusDraft(task.status);
    setNoteDraft("");
    setDeleteConfirmOpen(false);
  }, [task]);

  const handleStatusSave = async () => {
    if (!task || statusDraft === task.status) return;
    setSavingStatus(true);
    try {
      await onUpdateStatus(task, statusDraft);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleNoteSave = async () => {
    if (!task || !noteDraft.trim()) return;
    setSavingNote(true);
    try {
      await onAddNote(task, noteDraft.trim());
      setNoteDraft("");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!task || !onDelete) return;
    setDeletingTask(true);
    try {
      await onDelete(task);
      setDeleteConfirmOpen(false);
    } finally {
      setDeletingTask(false);
    }
  };

  const openLawyerProfile = () => {
    if (!task?.lawyer_user_id) return;
    navigate("/lawyer-management", {
      state: { selectedUserId: task.lawyer_user_id },
    });
    onOpenChange(false);
  };

  const lawyerDisplay =
    task?.lawyer_display_name ||
    task?.lawyer_reference ||
    task?.lawyer_email ||
    null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-border bg-card px-0 py-0 text-foreground shadow-2xl sm:max-w-2xl"
      >
        {task ? (
          <div className="space-y-5">
            <div className="relative overflow-hidden border-b border-border px-6 py-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_46%),linear-gradient(135deg,hsl(var(--primary)/0.08),transparent_50%)]" />
              <SheetHeader className="relative space-y-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={TASK_STATUS_META[task.status].badgeClassName}
                  >
                    {TASK_STATUS_META[task.status].label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={TASK_PRIORITY_META[task.priority].badgeClassName}
                  >
                    {TASK_PRIORITY_META[task.priority].label}
                  </Badge>
                  {task.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="rounded-full border-primary/40 bg-primary/10 text-xs font-medium text-primary"
                    >
                      {formatTaskTag(tag)}
                    </Badge>
                  ))}
                </div>
                <SheetTitle className="text-2xl font-semibold tracking-tight">
                  {task.title}
                </SheetTitle>
                <SheetDescription className="text-sm leading-6 text-muted-foreground">
                  {task.description ||
                    "No description was provided for this task."}
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="space-y-5 px-6 pb-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <UserRound className="h-4 w-4 text-primary" />
                    Ownership
                  </div>
                  <p className="text-sm font-semibold">{task.assignee_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {task.assignee_user_id === task.created_by
                      ? "Self-assigned"
                      : `Assigned by ${task.created_by_name}`}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    Timeline
                  </div>
                  <p className="text-sm font-semibold">
                    Due {formatTaskDate(task.deadline_date)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assigned {formatTaskDate(task.assigned_date)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-primary">
                    {getRelativeDeadlineLabel(task, todayDateKey)}
                  </p>
                </div>

                {task.lawyer_user_id ? (
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 md:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <BriefcaseBusiness className="h-4 w-4 text-primary" />
                          Lawyer
                        </div>
                        <p className="truncate text-base font-semibold">
                          {lawyerDisplay || "Lawyer not attached"}
                        </p>
                        {task.lawyer_firm_name ? (
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <BriefcaseBusiness className="h-3.5 w-3.5 text-primary" />
                            <span>{task.lawyer_firm_name}</span>
                          </div>
                        ) : null}
                        {task.lawyer_email ? (
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 text-primary" />
                            <span>{task.lawyer_email}</span>
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={openLawyerProfile}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Lawyer
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <Label htmlFor="task-status-update">Task status</Label>
                    <Select
                      value={statusDraft}
                      onValueChange={(value) =>
                        setStatusDraft(value as TaskStatus)
                      }
                      disabled={!canEditTask}
                    >
                      <SelectTrigger
                        id="task-status-update"
                        className="w-full border-border bg-background lg:w-[220px]"
                      >
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleStatusSave}
                      disabled={
                        !canEditTask ||
                        savingStatus ||
                        statusDraft === task.status
                      }
                    >
                      {savingStatus ? "Saving..." : "Save status"}
                    </Button>
                    {canEditTask ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onEdit(task)}
                      >
                        Edit task
                      </Button>
                    ) : null}
                    {canDeleteTask && onDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Delete task"
                        className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Notes &amp; Activity
                  </h3>
                </div>

                <div className="space-y-3">
                  {loadingNotes ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Loading notes...
                    </div>
                  ) : notes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      No notes yet. Add the first update to keep the task trail
                      clear.
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl border border-border bg-muted/40 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {note.author_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(note.created_at),
                              "MMM d, yyyy h:mm a",
                            )}
                          </p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {note.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <Label htmlFor="task-note-draft">Add note</Label>
                  <Textarea
                    id="task-note-draft"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    rows={4}
                    placeholder="Write a concise update, blocker, or lawyer detail."
                    className="mt-2 border-border bg-background"
                    disabled={!canEditTask}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      onClick={handleNoteSave}
                      disabled={
                        !canEditTask || savingNote || !noteDraft.trim()
                      }
                    >
                      {savingNote ? "Posting..." : "Post note"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              {task ? (
                <>
                  This will permanently remove{" "}
                  <span className="font-semibold text-foreground">
                    {task.title}
                  </span>{" "}
                  and its notes. This action cannot be undone.
                </>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTask}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingTask}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteConfirmed();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingTask ? "Deleting..." : "Delete task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
