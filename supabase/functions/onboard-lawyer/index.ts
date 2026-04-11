import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'https://esm.sh/zod@3.24.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY',
] as const;
const US_STATE_CODE_SET = new Set<string>(US_STATE_CODES);
const LANGUAGE_VALUES = ['English', 'Spanish'] as const;
const LANGUAGE_VALUE_SET = new Set<string>(LANGUAGE_VALUES);
const POSITION_VALUES = ['accounting', 'marketing', 'invoicing', 'intake_team', 'other'] as const;
const POSITION_VALUE_SET = new Set<string>(POSITION_VALUES);
const CONTACT_VALUES = ['email', 'phone', 'text'] as const;

const optionalTextSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().optional(),
);

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
  },
  z.string().optional(),
);

const optionalStateCodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toUpperCase();
    return US_STATE_CODE_SET.has(trimmed) ? trimmed : undefined;
  },
  z.string().optional(),
);

const optionalStringArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  },
  z.array(z.string()).default([]),
);

const optionalLanguageArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is (typeof LANGUAGE_VALUES)[number] => LANGUAGE_VALUE_SET.has(item));
  },
  z.array(z.string()).default([]),
);

const optionalStateCodeArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : ''))
      .filter((item) => US_STATE_CODE_SET.has(item));
  },
  z.array(z.string()).default([]),
);

const optionalNonNegativeIntSchema = z.preprocess(
  (value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    }
    return undefined;
  },
  z.number().int().min(0).optional(),
);

const officeAddressSchema = z.preprocess(
  (value) => (value && typeof value === 'object' ? value : {}),
  z.object({
    street: optionalTextSchema,
    suite: optionalTextSchema,
    city: optionalTextSchema,
    state: optionalStateCodeSchema,
    zip: optionalTextSchema,
  }),
);

const barLicenseSchema = z.preprocess(
  (value) => (value && typeof value === 'object' ? value : {}),
  z.object({
    state: optionalStateCodeSchema,
    number: optionalTextSchema,
  }),
);

const teamMemberSchema = z.preprocess(
  (value) => (value && typeof value === 'object' ? value : {}),
  z.object({
    full_name: optionalTextSchema,
    email: optionalEmailSchema,
    phone: optionalTextSchema,
    state: optionalStateCodeSchema,
    position: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return POSITION_VALUE_SET.has(trimmed) ? trimmed : undefined;
      },
      z.enum(POSITION_VALUES).optional().default('intake_team'),
    ),
    position_other: optionalTextSchema,
    weekly_availability: z.unknown().optional().default(null),
    holiday_hours: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(z.unknown()).default([])),
    shift_availability: optionalTextSchema,
  }).transform((member) => ({
    ...member,
    position_other: member.position === 'other' ? member.position_other : null,
  })),
);

const onboardingRequestSchema = z.object({
  account: z.object({
    email: z.string().email('Valid email required').transform((value) => value.toLowerCase().trim()),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  attorneyProfile: z.preprocess(
    (value) => (value && typeof value === 'object' ? value : {}),
    z.object({
      fullName: optionalTextSchema,
      firmName: optionalTextSchema,
      bio: optionalTextSchema,
      yearsExperience: optionalNonNegativeIntSchema,
      languages: optionalLanguageArraySchema,
      barLicenses: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(barLicenseSchema).default([])),
      primaryEmail: optionalEmailSchema,
      personalEmail: optionalEmailSchema,
      directPhone: optionalTextSchema,
      preferredContact: z.preprocess(
        (value) => {
          if (typeof value !== 'string') return undefined;
          const trimmed = value.trim();
          return CONTACT_VALUES.includes(trimmed as (typeof CONTACT_VALUES)[number]) ? trimmed : undefined;
        },
        z.enum(CONTACT_VALUES).optional(),
      ),
      officeAddress: officeAddressSchema.optional().default({}),
      websiteUrl: optionalTextSchema,
      assistantName: optionalTextSchema,
      assistantEmail: optionalEmailSchema,
      licensedStates: optionalStateCodeArraySchema,
      primaryCity: optionalStateCodeSchema,
      countiesCovered: optionalStringArraySchema,
      federalCourts: optionalTextSchema,
      primaryPracticeFocus: optionalTextSchema,
      injuryCategories: optionalStringArraySchema,
      exclusionaryCriteria: optionalStringArraySchema,
    }).default({}),
  ),
  teamMembers: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []),
    z.array(teamMemberSchema).default([]),
  ),
});

const rollbackCreatedUser = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
) => {
  try {
    await admin.from('app_users').delete().eq('user_id', userId);
  } catch (cleanupError) {
    console.error('[onboard-lawyer] app_users cleanup error:', cleanupError);
  }

  try {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error('[onboard-lawyer] auth user cleanup error:', deleteUserError);
    }
  } catch (cleanupError) {
    console.error('[onboard-lawyer] unexpected auth cleanup error:', cleanupError);
  }
};

const hasMeaningfulTeamMemberData = (member: Record<string, unknown>) => {
  const fullName = typeof member.full_name === 'string' ? member.full_name.trim() : '';
  const email = typeof member.email === 'string' ? member.email.trim() : '';
  const phone = typeof member.phone === 'string' ? member.phone.trim() : '';
  const state = typeof member.state === 'string' ? member.state.trim() : '';
  const position = typeof member.position === 'string' ? member.position.trim() : '';
  const positionOther = typeof member.position_other === 'string' ? member.position_other.trim() : '';

  return Boolean(fullName || email || phone || state || positionOther || (position && position !== 'intake_team'));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payloadResult = onboardingRequestSchema.safeParse(await req.json());

    if (!payloadResult.success) {
      const fieldErrors = Object.fromEntries(
        payloadResult.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      );
      return json({ error: 'Validation failed', fieldErrors }, 400);
    }

    const { account, attorneyProfile: profile, teamMembers } = payloadResult.data;
    const email = account.email;
    const password = account.password;

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return json({ error: authError.message, fieldErrors: { 'account.email': authError.message } }, 400);
    }

    const userId = authData.user.id;

    const { error: appUserError } = await admin
      .from('app_users')
      .upsert(
        {
          user_id: userId,
          email,
          display_name: profile.fullName || null,
          role: 'lawyer',
          account_status: 'active',
        },
        { onConflict: 'user_id' },
      );

    if (appUserError) {
      console.error('[onboard-lawyer] app_users upsert error:', appUserError);
      await rollbackCreatedUser(admin, userId);
      return json({ error: `Failed to create app_users record: ${appUserError.message}` }, 500);
    }

    const addr = profile.officeAddress || {};
    const addressParts = [addr.street];
    if (addr.suite) addressParts.push(addr.suite);
    if (addr.city || addr.state || addr.zip) {
      addressParts.push(`${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`.trim());
    }
    const streetAddress = addressParts.filter(Boolean).join(', ');

    const normalizedBarLicenses = profile.barLicenses
      .map((license) => ({
        state: license.state || '',
        number: license.number || '',
      }))
      .filter((license) => license.state || license.number);
    const barAssociationNumbers = normalizedBarLicenses
      .filter((license) => license.number)
      .map((license) => `${license.state}|${license.number}`);
    const firstBarNumber = normalizedBarLicenses.find((license) => license.number)?.number ?? null;

    const profilePayload: Record<string, unknown> = {
      user_id: userId,
      full_name: profile.fullName || null,
      firm_name: profile.firmName || null,
      professional_bio: profile.bio || null,
      years_experience: profile.yearsExperience ?? null,
      languages_spoken: profile.languages,
      primary_email: profile.primaryEmail || email,
      personal_email: profile.personalEmail || null,
      direct_phone: profile.directPhone || null,
      preferred_contact_method: profile.preferredContact || null,
      office_address: streetAddress || null,
      state: addr.state || null,
      website_url: profile.websiteUrl || null,
      assistant_name: profile.assistantName || null,
      assistant_email: profile.assistantEmail || null,
      bar_association_number: firstBarNumber,
      bar_association_numbers: barAssociationNumbers,
      licensed_states: profile.licensedStates,
      primary_city: profile.primaryCity || null,
      counties_covered: profile.countiesCovered,
      federal_court_admissions: profile.federalCourts || null,
      primary_practice_focus: profile.primaryPracticeFocus || null,
      injury_categories: profile.injuryCategories,
      exclusionary_criteria: profile.exclusionaryCriteria,
      availability_status: 'accepting',
    };

    const { error: profileError } = await admin
      .from('attorney_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' });

    if (profileError) {
      console.error('[onboard-lawyer] attorney_profiles upsert error:', profileError);
      await rollbackCreatedUser(admin, userId);
      return json({ error: `Failed to create attorney profile: ${profileError.message}` }, 500);
    }

    const members = teamMembers.filter((member) =>
      hasMeaningfulTeamMemberData(member as unknown as Record<string, unknown>),
    );
    const teamMemberIds: string[] = [];
    const warnings: string[] = [];

    if (members.length > 0) {
      await admin.from('team_members').delete().eq('lawyer_id', userId);

      for (const [index, member] of members.entries()) {
        const { data: teamMemberData, error: teamMemberError } = await admin
          .from('team_members')
          .insert({
            lawyer_id: userId,
            full_name: member.full_name || null,
            email: member.email || null,
            phone: member.phone || null,
            state: member.state || null,
            position: member.position || 'intake_team',
            position_other: member.position === 'other' ? member.position_other || null : null,
            weekly_availability: member.weekly_availability || null,
            holiday_hours: member.holiday_hours || [],
            shift_availability: member.shift_availability || 'full_day',
            publisher_id: null,
          })
          .select('id')
          .single();

        if (teamMemberError) {
          console.error('[onboard-lawyer] team_member insert error:', teamMemberError);
          warnings.push(
            `Team member ${index + 1} could not be saved and can be added later from the lawyer profile.`,
          );
          continue;
        }

        if (teamMemberData?.id) {
          teamMemberIds.push(String(teamMemberData.id));
        }
      }
    }

    return json({
      success: true,
      userId,
      email,
      teamMemberIds,
      warnings,
    });
  } catch (err) {
    console.error('[onboard-lawyer] unexpected error:', err);
    return json({ error: (err as Error).message || 'Internal server error' }, 500);
  }
});
