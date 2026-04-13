import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const DEFAULT_ATTORNEY_PORTAL_URL = 'https://attorney.accidentpayments.com'
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'https://onboarding.accidentpayments.com',
  'https://attorney.accidentpayments.com',
]

type AppUserRole = 'super_admin' | 'admin' | 'lawyer' | 'agent'

type AuthedUser = {
  id: string
  email: string | null
}

type AppUserLookup = {
  user_id: string
  email: string | null
  display_name: string | null
  role: AppUserRole | null
  is_super_admin?: boolean | null
  account_status?: string | null
}

const getEnv = (key: string, fallback?: string) => {
  const value = Deno.env.get(key)?.trim()
  if (value) return value
  if (fallback !== undefined) return fallback
  throw new Error(`Missing env var: ${key}`)
}

const getAllowedOrigins = () => {
  const configured = Deno.env.get('ALLOWED_PORTAL_ORIGINS')
  if (!configured?.trim()) return DEFAULT_ALLOWED_ORIGINS

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const getAllowedRequestOrigin = (req: Request) => {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = req.headers.get('origin') ?? ''
  if (!requestOrigin) return null
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null
}

const getCorsHeaders = (req: Request) => {
  const allowOrigin = getAllowedRequestOrigin(req)

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  })

const getBearerToken = (req: Request) => {
  const auth = req.headers.get('authorization') ?? ''
  const [type, token] = auth.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'

const isLocalRequest = (req: Request) => {
  const requestOrigin = req.headers.get('origin') ?? ''
  if (!requestOrigin) return false

  try {
    return isLoopbackHost(new URL(requestOrigin).hostname)
  } catch {
    return false
  }
}

const normalizeAttorneyPortalUrl = (value: unknown) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    if (parsed.origin === DEFAULT_ATTORNEY_PORTAL_URL) {
      return parsed.origin
    }

    if (isLoopbackHost(parsed.hostname)) {
      return parsed.origin
    }

    return null
  } catch {
    return null
  }
}

const sanitizeRequestedPath = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'

  try {
    const parsed = new URL(raw, 'https://internal.launch.local')
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (
      normalized === '/auth' ||
      normalized.startsWith('/auth/') ||
      normalized === '/launch-auth' ||
      normalized.startsWith('/launch-auth') ||
      normalized === '/managed-auth' ||
      normalized.startsWith('/managed-auth/')
    ) {
      return '/dashboard'
    }
    return normalized || '/dashboard'
  } catch {
    return '/dashboard'
  }
}

const normalizeStatus = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase()

const isLawyerAccountLaunchable = (value: string | null | undefined) => {
  const normalized = normalizeStatus(value)
  if (!normalized) return true
  return !['inactive', 'disabled', 'banned', 'suspended'].includes(normalized)
}

const requireAuthenticatedUser = async (req: Request): Promise<{ user: AuthedUser } | { error: Response }> => {
  const supabaseUrl = getEnv('SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY')

  const token = getBearerToken(req)
  if (!token) return { error: json(req, 401, { error: 'Missing Authorization header' }) }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error || !data.user) {
    return { error: json(req, 401, { error: 'Invalid session' }) }
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  }
}

const hasPortalAdminAccess = async (adminClient: ReturnType<typeof createClient>, userId: string) => {
  const { data: appUser, error: appUserError } = await adminClient
    .from('app_users')
    .select('role,is_super_admin')
    .eq('user_id', userId)
    .maybeSingle()

  if (appUserError) {
    throw new Error(appUserError.message)
  }

  if (appUser && (appUser.is_super_admin || appUser.role === 'super_admin' || appUser.role === 'admin')) {
    return true
  }

  const { data: roleRow, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (roleError) {
    throw new Error(roleError.message)
  }

  return Boolean(roleRow?.role === 'admin' || roleRow?.role === 'super_admin')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    if (req.headers.get('origin') && !getAllowedRequestOrigin(req)) {
      return new Response('Forbidden', { status: 403 })
    }
    return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return json(req, 405, { error: 'Method not allowed' })
  }

  try {
    const authResult = await requireAuthenticatedUser(req)
    if ('error' in authResult) return authResult.error

    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const hasAccess = await hasPortalAdminAccess(adminClient, authResult.user.id)
    if (!hasAccess) {
      return json(req, 403, { error: 'Admin access required' })
    }

    const body = await req.json().catch(() => ({}))
    const lawyerUserId = typeof body?.lawyer_user_id === 'string' ? body.lawyer_user_id.trim() : ''
    const requestedPath = sanitizeRequestedPath(body?.requested_path)
    const configuredAttorneyPortalUrl = normalizeAttorneyPortalUrl(
      getEnv('ATTORNEY_PORTAL_URL', DEFAULT_ATTORNEY_PORTAL_URL)
    )
    const requestedAttorneyPortalUrl = isLocalRequest(req) ? normalizeAttorneyPortalUrl(body?.attorney_portal_url) : null
    const attorneyPortalUrl = requestedAttorneyPortalUrl ?? configuredAttorneyPortalUrl ?? DEFAULT_ATTORNEY_PORTAL_URL

    if (!lawyerUserId) {
      return json(req, 400, { error: 'lawyer_user_id is required' })
    }

    const { data: lawyerRow, error: lawyerError } = await adminClient
      .from('app_users')
      .select('user_id,email,display_name,role,account_status')
      .eq('user_id', lawyerUserId)
      .maybeSingle()

    if (lawyerError) {
      return json(req, 500, { error: lawyerError.message })
    }

    const lawyer = lawyerRow as AppUserLookup | null
    if (!lawyer || lawyer.role !== 'lawyer') {
      return json(req, 404, { error: 'Lawyer account not found' })
    }

    if (!isLawyerAccountLaunchable(lawyer.account_status)) {
      return json(req, 400, { error: 'This lawyer account is not active and cannot be launched' })
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(lawyerUserId)
    if (authUserError) {
      return json(req, 500, { error: authUserError.message })
    }

    const authUser = authUserData.user
    if (!authUser) {
      return json(req, 404, { error: 'Lawyer auth account not found' })
    }

    const lawyerEmail = authUser.email?.trim().toLowerCase() ?? ''
    if (!lawyerEmail) {
      return json(req, 400, { error: 'The selected lawyer auth account does not have a valid email address' })
    }

    const appUserEmail = lawyer.email?.trim().toLowerCase() ?? ''
    if (appUserEmail && appUserEmail !== lawyerEmail) {
      return json(req, 409, {
        error: 'Lawyer account email is out of sync with auth. Please sync the account email before launching.',
      })
    }

    const bannedUntil = typeof authUser.banned_until === 'string' ? Date.parse(authUser.banned_until) : Number.NaN
    if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) {
      return json(req, 400, { error: 'This lawyer auth account is currently banned and cannot be launched' })
    }

    const redirectUrl = new URL('/launch-auth', attorneyPortalUrl)
    redirectUrl.searchParams.set('next', requestedPath)

    const { data: generateData, error: generateError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: lawyerEmail,
      options: {
        redirectTo: redirectUrl.toString(),
      },
    })

    if (generateError || !generateData?.properties?.action_link) {
      return json(req, 500, { error: generateError?.message ?? 'Unable to create launch link' })
    }

    return json(req, 200, {
      actionLink: generateData.properties.action_link,
      redirectTo: redirectUrl.toString(),
      lawyer: {
        userId: lawyer.user_id,
        email: lawyerEmail,
        displayName: lawyer.display_name,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json(req, 500, { error: message })
  }
})
