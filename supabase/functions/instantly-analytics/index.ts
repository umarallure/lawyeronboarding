import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  console.log(`[instantly-analytics] ${req.method} ${new URL(req.url).pathname}`);

  try {
    const apiKey = Deno.env.get('INSTANTLY_API_KEY') ?? '';
    if (!apiKey) {
      console.error('[instantly-analytics] INSTANTLY_API_KEY secret is not set');
      return new Response(
        JSON.stringify({ error: 'INSTANTLY_API_KEY secret is not set on this Supabase project' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const { start_date, end_date } = await req.json() as {
      start_date?: string;
      end_date?: string;
    };

    console.log(`[instantly-analytics] fetching overview  start=${start_date ?? 'none'}  end=${end_date ?? 'none'}`);

    const url = new URL('https://api.instantly.ai/api/v2/campaigns/analytics/overview');
    if (start_date) url.searchParams.set('start_date', start_date);
    if (end_date) url.searchParams.set('end_date', end_date);

    const upstream = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    console.log(`[instantly-analytics] upstream status ${upstream.status}`);

    const body = await upstream.text();

    if (!upstream.ok) {
      console.error(`[instantly-analytics] upstream error body:`, body);
    } else {
      try {
        const parsed = JSON.parse(body);
        console.log(
          `[instantly-analytics] reply_count_unique=${parsed.reply_count_unique}` +
          `  total_interested=${parsed.total_interested}` +
          `  contacted_count=${parsed.contacted_count}`,
        );
      } catch (_) { /* body not JSON — logged as-is above */ }
    }

    return new Response(body, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[instantly-analytics] unhandled error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
