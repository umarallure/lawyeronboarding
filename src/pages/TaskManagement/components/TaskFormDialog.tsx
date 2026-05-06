import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Loader2, Search, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";

import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_TAG_OPTIONS,
} from "../taskManagementUtils";
import type {
  OnboardingTask,
  TaskAssigneeOption,
  TaskFormValues,
  TaskLawyerOption,
} from "../types";

interface TaskFormDialogProps {
  open: boolean;
  initialTask: OnboardingTask | null;
  initialAssignee?: TaskAssigneeOption | null;
  initialLawyer?: TaskLawyerOption | null;
  lockLawyer?: boolean;
  assigneeOptions: TaskAssigneeOption[];
  currentUserAssignee: TaskAssigneeOption | null;
  selfAssignOnly?: boolean;
  lawyerOptions: TaskLawyerOption[];
  lawyerSearchLoading: boolean;
  onLawyerSearch: (query: string) => void;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TaskFormValues) => Promise<void>;
}

const createEmptyState = (): TaskFormValues => ({
  title: "",
  description: "",
  lawyerUserId: "",
  lawyerReference: "",
  assigneeUserId: "",
  assigneeName: "",
  status: "todo",
  priority: "medium",
  deadlineDate: "",
  tags: [],
});

const buildLawyerSearchLabel = (lawyer: TaskLawyerOption | null) => {
  if (!lawyer) return "";
  const display = lawyer.displayName.trim() || lawyer.reference.trim();
  return lawyer.firmName ? `${display} · ${lawyer.firmName}` : display;
};

type DateInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export function TaskFormDialog({
  open,
  initialTask,
  initialAssignee = null,
  initialLawyer = null,
  lockLawyer = false,
  assigneeOptions,
  currentUserAssignee,
  selfAssignOnly = false,
  lawyerOptions,
  lawyerSearchLoading,
  onLawyerSearch,
  onOpenChange,
  onSave,
}: TaskFormDialogProps) {
  const [values, setValues] = useState<TaskFormValues>(createEmptyState);
  const [submitting, setSubmitting] = useState(false);
  const [lawyerSearchText, setLawyerSearchText] = useState("");
  const [showLawyerResults, setShowLawyerResults] = useState(false);
  const deadlineInputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(initialTask);

  const selectableAssigneeOptions = useMemo(() => {
    if (
      !currentUserAssignee ||
      values.assigneeUserId !== currentUserAssignee.key
    ) {
      return assigneeOptions;
    }

    const alreadyIncluded = assigneeOptions.some(
      (option) => option.key === currentUserAssignee.key,
    );

    if (alreadyIncluded) {
      return assigneeOptions;
    }

    return [currentUserAssignee, ...assigneeOptions];
  }, [assigneeOptions, currentUserAssignee, values.assigneeUserId]);

  const assigneeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    selectableAssigneeOptions.forEach((option) => {
      map.set(option.key, option.label);
    });
    return map;
  }, [selectableAssigneeOptions]);

  useEffect(() => {
    if (!open) return;

    if (initialTask) {
      const lockedAssignee =
        selfAssignOnly && currentUserAssignee ? currentUserAssignee : null;
      const initialLawyerSeed: TaskLawyerOption | null = initialTask.lawyer_user_id
        ? {
            id: initialTask.lawyer_user_id,
            reference:
              initialTask.lawyer_reference ||
              initialTask.lawyer_display_name ||
              initialTask.lawyer_email ||
              "",
            displayName:
              initialTask.lawyer_display_name ||
              initialTask.lawyer_reference ||
              "",
            firmName: initialTask.lawyer_firm_name ?? null,
            email: initialTask.lawyer_email ?? null,
          }
        : null;

      setValues({
        title: initialTask.title,
        description: initialTask.description || "",
        lawyerUserId: initialTask.lawyer_user_id || "",
        lawyerReference: initialTask.lawyer_reference || "",
        assigneeUserId: lockedAssignee?.key || initialTask.assignee_user_id,
        assigneeName: lockedAssignee?.label || initialTask.assignee_name,
        status: initialTask.status,
        priority: initialTask.priority,
        deadlineDate: initialTask.deadline_date,
        tags: initialTask.tags || [],
      });
      setLawyerSearchText(buildLawyerSearchLabel(initialLawyerSeed));
      setShowLawyerResults(false);
      return;
    }

    const canAssignCurrentUser =
      currentUserAssignee &&
      (selfAssignOnly ||
        assigneeOptions.some((option) => option.key === currentUserAssignee.key));

    const presetAssignee =
      !selfAssignOnly && initialAssignee
        ? initialAssignee
        : canAssignCurrentUser
          ? currentUserAssignee
          : null;

    setValues({
      ...createEmptyState(),
      lawyerUserId: initialLawyer?.id || "",
      lawyerReference: initialLawyer?.reference || "",
      assigneeUserId: presetAssignee?.key || "",
      assigneeName: presetAssignee?.label || "",
    });
    setLawyerSearchText(buildLawyerSearchLabel(initialLawyer));
    setShowLawyerResults(false);
  }, [
    assigneeOptions,
    currentUserAssignee,
    initialAssignee,
    initialLawyer,
    initialTask,
    open,
    selfAssignOnly,
  ]);

  useEffect(() => {
    if (!open) return;
    if (lockLawyer) return;

    const query = lawyerSearchText.trim();
    if (values.lawyerUserId) return;

    const timer = window.setTimeout(() => {
      onLawyerSearch(query);
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lawyerSearchText, lockLawyer, onLawyerSearch, open, values.lawyerUserId]);

  const handleChange = <K extends keyof TaskFormValues>(
    key: K,
    value: TaskFormValues[K],
  ) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleAssigneeChange = (assigneeUserId: string) => {
    handleChange("assigneeUserId", assigneeUserId);
    handleChange("assigneeName", assigneeLabelById.get(assigneeUserId) || "");
  };

  const handleLawyerInputChange = (value: string) => {
    if (lockLawyer) return;

    setLawyerSearchText(value);
    setShowLawyerResults(true);

    if (values.lawyerUserId || values.lawyerReference) {
      handleChange("lawyerUserId", "");
      handleChange("lawyerReference", "");
    }
  };

  const handleLawyerSelect = (lawyer: TaskLawyerOption) => {
    handleChange("lawyerUserId", lawyer.id);
    handleChange("lawyerReference", lawyer.reference);
    setLawyerSearchText(buildLawyerSearchLabel(lawyer));
    setShowLawyerResults(false);
  };

  const clearAttachedLawyer = () => {
    if (lockLawyer) return;

    handleChange("lawyerUserId", "");
    handleChange("lawyerReference", "");
    setLawyerSearchText("");
    setShowLawyerResults(false);
    onLawyerSearch("");
  };

  const openDeadlinePicker = () => {
    const input = deadlineInputRef.current as DateInputWithPicker | null;
    if (!input) return;

    input.focus();

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // Browsers may reject showPicker outside direct pointer activation.
      }
    }
  };

  const handleSubmit = async () => {
    const nextValues =
      selfAssignOnly && currentUserAssignee
        ? {
            ...values,
            assigneeUserId: currentUserAssignee.key,
            assigneeName: currentUserAssignee.label,
          }
        : values;

    if (
      !nextValues.title.trim() ||
      !nextValues.assigneeUserId ||
      !nextValues.deadlineDate
    ) {
      return;
    }

    setSubmitting(true);

    try {
      await onSave({
        ...nextValues,
        title: nextValues.title.trim(),
        description: nextValues.description.trim(),
        assigneeName: nextValues.assigneeName.trim(),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const showLawyerEmptyState =
    !lawyerSearchLoading && showLawyerResults && lawyerOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-hidden border border-border bg-card p-0 text-foreground shadow-2xl">
        <div className="relative overflow-hidden border-b border-primary/25 px-5 py-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_38%),linear-gradient(135deg,hsl(var(--primary)/0.08),transparent_46%)]" />
          <DialogHeader className="relative space-y-1">
            <DialogTitle className="text-lg">
              {isEditing ? "Update Task" : "Create Task"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Set the owner, deadline, priority, and lawyer context.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="h-[min(56vh,520px)]">
          <div className="space-y-4 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)]">
              {selfAssignOnly ? (
                <div className="space-y-2">
                  <Label htmlFor="task-assignee">Assigned to</Label>
                  <Input
                    id="task-assignee"
                    value={
                      currentUserAssignee?.label || values.assigneeName || "You"
                    }
                    readOnly
                    className="h-10 border-primary/35 bg-muted/40"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="task-assignee">Assign to</Label>
                    {currentUserAssignee ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          handleAssigneeChange(currentUserAssignee.key)
                        }
                      >
                        Assign to me
                      </Button>
                    ) : null}
                  </div>
                  <Select
                    value={values.assigneeUserId}
                    onValueChange={handleAssigneeChange}
                  >
                    <SelectTrigger
                      id="task-assignee"
                      className="h-10 border-primary/35 bg-background"
                    >
                      <SelectValue placeholder="Select an admin or super-admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableAssigneeOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="task-title">Task title</Label>
                <Input
                  id="task-title"
                  value={values.title}
                  onChange={(event) =>
                    handleChange("title", event.target.value)
                  }
                  placeholder="Follow up on outstanding bar verification"
                  className="h-10 border-primary/35 bg-background"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="task-deadline">Deadline</Label>
                <div className="relative" onClick={openDeadlinePicker}>
                  <Input
                    ref={deadlineInputRef}
                    id="task-deadline"
                    type="date"
                    value={values.deadlineDate}
                    onChange={(event) =>
                      handleChange("deadlineDate", event.target.value)
                    }
                    className="relative h-10 cursor-pointer appearance-none border-primary/35 bg-background pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={values.status}
                  onValueChange={(value) =>
                    handleChange("status", value as TaskFormValues["status"])
                  }
                >
                  <SelectTrigger
                    id="task-status"
                    className="h-10 border-border bg-background"
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

              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={values.priority}
                  onValueChange={(value) =>
                    handleChange(
                      "priority",
                      value as TaskFormValues["priority"],
                    )
                  }
                >
                  <SelectTrigger
                    id="task-priority"
                    className="h-10 border-border bg-background"
                  >
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-tags">Tags</Label>
                <MultiSelect
                  options={TASK_TAG_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  selected={values.tags}
                  onChange={(selected) => handleChange("tags", selected)}
                  placeholder="Select tags"
                  className="border-border bg-background"
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={values.description}
                  onChange={(event) =>
                    handleChange("description", event.target.value)
                  }
                  placeholder="Context, blockers, and next best action."
                  rows={3}
                  className="min-h-[40px] border-border bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-lawyer-reference">Lawyer Reference</Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="task-lawyer-reference"
                      value={lawyerSearchText}
                      onChange={(event) =>
                        handleLawyerInputChange(event.target.value)
                      }
                      onFocus={() => {
                        if (lockLawyer) return;
                        setShowLawyerResults(true);
                        onLawyerSearch(lawyerSearchText.trim());
                      }}
                      readOnly={lockLawyer}
                      placeholder={
                        lockLawyer
                          ? "Attached lawyer"
                          : "Search lawyer name, firm, or email"
                      }
                      className={`h-10 border-border bg-background pl-9 pr-10 ${lockLawyer ? "cursor-default" : ""}`}
                    />
                    {values.lawyerUserId && !lockLawyer ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-8 w-8"
                        onClick={clearAttachedLawyer}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  {values.lawyerUserId ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-border px-2.5 py-1 text-xs"
                      >
                        Attached: {lawyerSearchText || "Selected lawyer"}
                      </Badge>
                    </div>
                  ) : null}

                  {showLawyerResults && !lockLawyer ? (
                    <div className="absolute z-20 mt-2 w-full rounded-2xl border border-border bg-popover shadow-xl">
                      <ScrollArea className="h-52">
                        <div className="space-y-1 p-2">
                          {lawyerSearchLoading ? (
                            <div className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading lawyers...
                            </div>
                          ) : null}

                          {!lawyerSearchLoading &&
                            lawyerOptions.map((lawyer) => (
                              <button
                                key={lawyer.id}
                                type="button"
                                onClick={() => handleLawyerSelect(lawyer)}
                                className="flex w-full flex-col rounded-xl px-3 py-3 text-left transition hover:bg-accent"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-foreground">
                                    {lawyer.displayName ||
                                      lawyer.email ||
                                      lawyer.reference}
                                  </span>
                                  {lawyer.firmName ? (
                                    <Badge
                                      variant="secondary"
                                      className="rounded-full text-[10px]"
                                    >
                                      {lawyer.firmName}
                                    </Badge>
                                  ) : null}
                                </div>
                                {lawyer.email ? (
                                  <span className="mt-0.5 text-xs text-muted-foreground">
                                    {lawyer.email}
                                  </span>
                                ) : null}
                              </button>
                            ))}

                          {showLawyerEmptyState ? (
                            <div className="rounded-xl px-3 py-3 text-sm text-muted-foreground">
                              {lawyerSearchText.trim().length > 0
                                ? "No lawyers matched that search."
                                : "No lawyers are available right now."}
                            </div>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              !values.title.trim() ||
              !values.assigneeUserId ||
              !values.deadlineDate
            }
          >
            {submitting
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : "Create task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
