/**
 * Instantly AI analytics — fetched via Supabase Edge Function proxy
 * (avoids CORS; API key lives as a Supabase secret, not in the browser)
 *
 * Edge function: supabase/functions/instantly-analytics/index.ts
 * Deploy: supabase functions deploy instantly-analytics
 * Secret: supabase secrets set INSTANTLY_API_KEY=<your_key>
 */

import { supabase } from '@/integrations/supabase/client';

export type InstantlyOverview = {
  // Replies
  reply_count: number;
  reply_count_unique: number;          // unique human replies (first per lead, no auto-replies) — "Output"
  reply_count_automatic: number;
  reply_count_automatic_unique: number;

  // Sends / opens
  emails_sent_count: number;
  contacted_count: number;
  new_leads_contacted_count: number;
  open_count: number;
  open_count_unique: number;

  // Clicks
  link_click_count: number;
  link_click_count_unique: number;

  // CRM / interest
  total_opportunities: number;
  total_opportunity_value: number;
  total_interested: number;            // leads marked "Interested" in Instantly CRM — "Interested/Connected"
  total_meeting_booked: number;
  total_meeting_completed: number;
  total_closed: number;

  // Other
  bounced_count: number;
  unsubscribed_count: number;
  completed_count: number;
};

export type InstantlyDailyEntry = {
  date: string;
  sent: number;
  contacted: number;
  new_leads_contacted: number;
  opened: number;
  unique_opened: number;
  replies: number;
  unique_replies: number;
  replies_automatic: number;
  unique_replies_automatic: number;
  clicks: number;
  unique_clicks: number;
  opportunities: number;
  unique_opportunities: number;
};

/**
 * Fetch aggregated analytics overview via the Supabase Edge Function proxy.
 * Called once per date-range change — not on every render.
 */
export const fetchInstantlyOverview = async (
  startDate: string,  // YYYY-MM-DD
  endDate: string,    // YYYY-MM-DD
): Promise<InstantlyOverview | null> => {
  try {
    const sb = supabase as unknown as {
      functions: {
        invoke: (name: string, opts: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
      };
    };

    const { data, error } = await sb.functions.invoke('instantly-analytics', {
      body: { start_date: startDate, end_date: endDate },
    });

    if (error) {
      console.error('[instantly] edge function error', error);
      return null;
    }

    return data as InstantlyOverview;
  } catch (err) {
    console.error('[instantly] fetch error', err);
    return null;
  }
};
