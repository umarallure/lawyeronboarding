import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CALENDLY_BASE = 'https://api.calendly.com';

/** Fetch all pages for a Calendly list endpoint and return total count. */
async function countAllPages(
  token: string,
  initialUrl: URL,
): Promise<number> {
  let count = 0;
  let nextPageToken: string | null = null;

  do {
    const url = new URL(initialUrl.toString());
    url.searchParams.set('count', '100');
    if (nextPageToken) url.searchParams.set('page_token', nextPageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[calendly-events] upstream error ${res.status}:`, body);
      throw new Error(`Calendly API error ${res.status}: ${body}`);
    }

    const json = await res.json() as {
      collection?: unknown[];
      pagination?: { next_page_token?: string | null };
    };

    count += (json.collection ?? []).length;
    nextPageToken = json.pagination?.next_page_token ?? null;
  } while (nextPageToken);

  return count;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  console.log(`[calendly-events] ${req.method} ${new URL(req.url).pathname}`);

  try {
    const token = Deno.env.get('CALENDLY_TOKEN') ?? '';
    if (!token) {
      console.error('[calendly-events] CALENDLY_TOKEN secret is not set');
      return new Response(
        JSON.stringify({ error: 'CALENDLY_TOKEN secret is not set on this Supabase project' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const { start_date, end_date } = await req.json() as {
      start_date?: string;
      end_date?: string;
    };

    // Step 1: get the organization URI from /users/me
    const meRes = await fetch(`${CALENDLY_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) {
      const body = await meRes.text();
      console.error('[calendly-events] /users/me error:', body);
      return new Response(
        JSON.stringify({ error: `Failed to fetch Calendly user: ${body}` }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const meData = await meRes.json() as {
      resource?: { current_organization?: string };
    };

    const orgUri = meData.resource?.current_organization;
    if (!orgUri) {
      return new Response(
        JSON.stringify({ error: 'Could not determine organization URI from /users/me' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[calendly-events] organization=${orgUri}`);

    const now = new Date().toISOString();

    // Step 2: count SCHEDULED (future active) meetings — min_start_time = now
    const scheduledUrl = new URL(`${CALENDLY_BASE}/scheduled_events`);
    scheduledUrl.searchParams.set('organization', orgUri);
    scheduledUrl.searchParams.set('status', 'active');
    scheduledUrl.searchParams.set('min_start_time', now);
    // If a date range is provided, cap the upper bound
    if (end_date) {
      // end_date is YYYY-MM-DD — include through end of that day
      scheduledUrl.searchParams.set('max_start_time', `${end_date}T23:59:59Z`);
    }

    // Step 3: count RAN (past) meetings within the selected date range
    const ranUrl = new URL(`${CALENDLY_BASE}/scheduled_events`);
    ranUrl.searchParams.set('organization', orgUri);
    ranUrl.searchParams.set('status', 'active');
    ranUrl.searchParams.set('max_start_time', now);
    if (start_date) {
      ranUrl.searchParams.set('min_start_time', `${start_date}T00:00:00Z`);
    }

    console.log(`[calendly-events] fetching scheduled (future) and ran (past) counts`);

    const [scheduledCount, ranCount] = await Promise.all([
      countAllPages(token, scheduledUrl),
      countAllPages(token, ranUrl),
    ]);

    console.log(`[calendly-events] scheduled=${scheduledCount}  ran=${ranCount}`);

    return new Response(
      JSON.stringify({ scheduled: scheduledCount, ran: ranCount }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[calendly-events] unhandled error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
