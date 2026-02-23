import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageCircle, PhoneCall, Users } from "lucide-react";

type OutreachMethod = "Email (Instantly)" | "DM (FlowChat)" | "Cold Call" | "Networking";

export interface DailyDealFlowRow {
  id: string;
  submission_id: string;
  created_at?: string;
  updated_at?: string;
  notes?: string;
  [key: string]: unknown;
}

type OutreachMetrics = {
  method: OutreachMethod;
  output: number;
  conversion: number;
  conversionLabel: string;
  goalOutput: number;
};

type MethodMeta = {
  icon: typeof Mail;
  accentClass: string;
  badgeClass: string;
};

const DailyDealFlowPage = () => {
  const metrics: OutreachMetrics[] = [
    {
      method: "Email (Instantly)",
      output: 220,
      conversion: 18,
      conversionLabel: "Responded",
      goalOutput: 300,
    },
    {
      method: "DM (FlowChat)",
      output: 95,
      conversion: 11,
      conversionLabel: "Green Flags",
      goalOutput: 120,
    },
    {
      method: "Cold Call",
      output: 62,
      conversion: 9,
      conversionLabel: "Connected",
      goalOutput: 80,
    },
    {
      method: "Networking",
      output: 8,
      conversion: 3,
      conversionLabel: "Green Flags",
      goalOutput: 10,
    },
  ];

  const metaByMethod: Record<OutreachMethod, MethodMeta> = {
    "Email (Instantly)": {
      icon: Mail,
      accentClass: "bg-blue-500",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    },
    "DM (FlowChat)": {
      icon: MessageCircle,
      accentClass: "bg-violet-500",
      badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    },
    "Cold Call": {
      icon: PhoneCall,
      accentClass: "bg-amber-500",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    },
    "Networking": {
      icon: Users,
      accentClass: "bg-emerald-500",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  };

  return (
    <div className="space-y-6 px-4 md:px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics.map((m) => {
          const meta = metaByMethod[m.method];
          const Icon = meta.icon;
          const conversionRate = m.output > 0 ? (m.conversion / m.output) * 100 : 0;
          const remaining = Math.max(0, m.goalOutput - m.output);
          const goalPct = m.goalOutput > 0 ? Math.min(100, (m.output / m.goalOutput) * 100) : 0;

          return (
            <Card key={m.method} className="overflow-hidden">
              <div className={`h-1.5 w-full ${meta.accentClass}`} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{m.method}</div>
                        <div className="text-xs text-muted-foreground">Daily scorecard</div>
                      </div>
                    </div>
                  </div>

                  <Badge variant="outline" className={meta.badgeClass}>
                    {goalPct.toFixed(0)}% to goal
                  </Badge>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-[11px] text-muted-foreground">Output</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight">{m.output}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Goal {m.goalOutput} • Remaining {remaining}</div>
                  </div>

                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-[11px] text-muted-foreground">{m.conversionLabel}</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight">{m.conversion}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">Rate {conversionRate.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span>
                    <span>{m.output}/{m.goalOutput}</span>
                  </div>
                  <div className="mt-2 h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${meta.accentClass}`} style={{ width: `${goalPct}%` }} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[11px]">
                      {remaining === 0 ? 'Goal hit' : `${remaining} left`}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {conversionRate >= 15 ? 'Strong rate' : conversionRate >= 8 ? 'Healthy rate' : 'Needs lift'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DailyDealFlowPage;
