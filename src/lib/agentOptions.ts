import { supabase } from "@/integrations/supabase/client";

const titleCase = (s: string) => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const formatAgentLabelFromEmail = (email: string) => {
  const localPart = (email || "").split("@")[0] || "";
  if (!localPart) return "";

  const cleaned = localPart.replace(/[_-]+/g, ".");

  if (cleaned.includes(".")) {
    const [firstRaw, secondRaw] = cleaned.split(".");
    const first = titleCase(firstRaw || "");
    const secondInitial = (secondRaw || "").trim().charAt(0);
    const second = secondInitial ? titleCase(secondInitial) : "";
    return `${first}${second ? " " + second : ""}`.trim();
  }

  return titleCase(cleaned);
};

const getBestDisplayName = (row: { name?: string | null; display_name?: string | null; email?: string | null; fallback?: string }) => {
  const direct = (row.name || row.display_name || "").trim();
  if (direct) return direct;

  const email = (row.email || "").trim();
  if (email) {
    const formatted = formatAgentLabelFromEmail(email);
    return formatted || email;
  }

  return row.fallback || "";
};

const safeSelectAppUsers = async () => {
  const full = await supabase
    .from('app_users' as any)
    .select('user_id, name, display_name, email' as any);

  if (!full.error) return full;

  const minimal = await supabase
    .from('app_users' as any)
    .select('user_id, display_name, email' as any);

  return minimal;
};

export const fetchAgentDropdownOptions = async (): Promise<Array<{ key: string; label: string }>> => {
  const [agentsRes, appUsersRes] = await Promise.all([
    supabase.from('agents').select('id, name, email'),
    safeSelectAppUsers(),
  ]);

  const out = new Map<string, { key: string; label: string }>();

  if (!agentsRes.error) {
    (agentsRes.data || []).forEach((a) => {
      const label = getBestDisplayName({ name: a.name, email: a.email, fallback: a.id });
      if (!label) return;
      out.set(label.toLowerCase(), { key: `agents:${a.id}`, label });
    });
  }

  if (!appUsersRes.error) {
    (appUsersRes.data || []).forEach((u: any) => {
      const label = getBestDisplayName({ name: u.name, display_name: u.display_name, email: u.email, fallback: u.user_id });
      if (!label) return;
      out.set(label.toLowerCase(), { key: `app_users:${u.user_id || label}`, label });
    });
  }

  return Array.from(out.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export const fetchLicensedCloserOptions = async (): Promise<Array<{ key: string; label: string }>> => {
  const { data: agentStatus, error: agentStatusError } = await supabase
    .from('agent_status')
    .select('user_id')
    .eq('agent_type', 'licensed');

  if (agentStatusError) {
    return [];
  }

  const userIds = (agentStatus || []).map((r: any) => r.user_id).filter(Boolean);
  if (userIds.length === 0) return [];

  const appUsersRes = await safeSelectAppUsers();

  const byUserId = new Map<string, { key: string; label: string }>();

  if (!appUsersRes.error) {
    (appUsersRes.data || []).forEach((u: any) => {
      if (!u.user_id) return;
      const label = getBestDisplayName({ name: u.name, display_name: u.display_name, email: u.email, fallback: u.user_id });
      if (!label) return;
      byUserId.set(String(u.user_id), { key: `app_users:${u.user_id}`, label });
    });
  }

  const out: Array<{ key: string; label: string }> = [];

  userIds.forEach((userId: string) => {
    const existing = byUserId.get(String(userId));
    if (existing) {
      out.push(existing);
      return;
    }

    out.push({ key: `user:${userId}`, label: String(userId) });
  });

  return out
    .filter((x) => x.label)
    .sort((a, b) => a.label.localeCompare(b.label));
};
