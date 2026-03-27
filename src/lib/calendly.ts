/**
 * Calendly events — fetched via Supabase Edge Function proxy
 * (avoids CORS; token lives as a Supabase secret, not in the browser)
 *
 * Edge function: supabase/functions/calendly-events/index.ts
 * Deploy: supabase functions deploy calendly-events
 * Secret: supabase secrets set CALENDLY_TOKEN=<your_personal_access_token>
 */

import { supabase } from '@/integrations/supabase/client';

export type CalendlyStats = {
  /** Active events with start_time >= now (upcoming meetings) */
  scheduled: number;
  /** Active events with start_time < now within the selected date range (past meetings) */
  ran: number;
};

/**
 * Fetch Calendly meeting counts via the Supabase Edge Function proxy.
 * Returns null on any error so callers can fall back gracefully.
 */
export const fetchCalendlyStats = async (
  startDate: string,  // YYYY-MM-DD  (used for ran meetings lower bound)
  endDate: string,    // YYYY-MM-DD  (used for scheduled meetings upper bound)
): Promise<CalendlyStats | null> => {
  try {
    const sb = supabase as unknown as {
      functions: {
        invoke: (name: string, opts: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
      };
    };

    const { data, error } = await sb.functions.invoke('calendly-events', {
      body: { start_date: startDate, end_date: endDate },
    });

    if (error) {
      console.error('[calendly] edge function error', error);
      return null;
    }

    return data as CalendlyStats;
  } catch (err) {
    console.error('[calendly] fetch error', err);
    return null;
  }
};
