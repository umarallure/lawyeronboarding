import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}
const rawSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  }
});

const ENABLE_DATALESS_PORTAL_MODE = true;
const LOGIN_ALLOWED_TABLES = new Set(['app_users', 'user_roles', 'portal_stages', 'lawyer_leads', 'orders']);

const createMockQueryBuilder = () => {
  const listResponse = Promise.resolve({ data: [], error: null, count: 0 });
  const singleResponse = Promise.resolve({ data: null, error: null, count: 0 });

  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_target, prop) => {
      if (prop === 'then') return listResponse.then.bind(listResponse);
      if (prop === 'catch') return listResponse.catch.bind(listResponse);
      if (prop === 'finally') return listResponse.finally.bind(listResponse);

      if (prop === 'single' || prop === 'maybeSingle') {
        return () => singleResponse;
      }

      return () => new Proxy({}, handler);
    },
  };

  return new Proxy({}, handler);
};

export const supabase = (ENABLE_DATALESS_PORTAL_MODE
  ? new Proxy(rawSupabase, {
      get: (target, prop, receiver) => {
        if (prop === 'from') {
          return (table: string) => {
            if (LOGIN_ALLOWED_TABLES.has(table)) {
              const untypedTarget = target as unknown as { from: (relation: string) => unknown };
              return untypedTarget.from(table);
            }

            return createMockQueryBuilder();
          };
        }

        if (prop === 'rpc') {
          return () => Promise.resolve({ data: null, error: null });
        }

        return Reflect.get(target, prop, receiver);
      },
    })
  : rawSupabase) as typeof rawSupabase;