import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, MessageSquare } from "lucide-react";

const slackWorkspaceUrl = import.meta.env.VITE_SLACK_WORKSPACE_URL?.trim() ?? "";

const isValidSlackUrl = (value: string) => {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "app.slack.com" ||
        parsed.hostname === "slack.com" ||
        parsed.hostname.endsWith(".slack.com"))
    );
  } catch {
    return false;
  }
};

const SlackPage = () => {
  const workspaceUrl = isValidSlackUrl(slackWorkspaceUrl) ? slackWorkspaceUrl : "";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_36%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.25))] px-4 py-8 sm:px-6">
      <Card className="w-full max-w-xl border-primary/15 bg-card/95 shadow-lg backdrop-blur">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquare className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Slack Workspace</CardTitle>
          <CardDescription className="max-w-md text-sm leading-6">
            Open the team workspace directly from the portal.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            {workspaceUrl || "Set VITE_SLACK_WORKSPACE_URL to enable this button."}
          </div>

          {workspaceUrl ? (
            <Button asChild size="lg" className="w-full">
              <a href={workspaceUrl} target="_blank" rel="noreferrer">
                Open Slack Workspace
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button size="lg" className="w-full" disabled>
              Open Slack Workspace
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SlackPage;
