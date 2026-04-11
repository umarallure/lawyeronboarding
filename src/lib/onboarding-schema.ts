import { z } from 'zod';

/* ── US State codes ── */

const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
] as const;

export type USStateCode = (typeof US_STATE_CODES)[number];

const usStateCode = z.enum(US_STATE_CODES);
const US_STATE_CODE_SET = new Set<string>(US_STATE_CODES);
const LANGUAGE_VALUES = ['English', 'Spanish'] as const;
const LANGUAGE_VALUE_SET = new Set<string>(LANGUAGE_VALUES);
const POSITION_VALUES = ['accounting', 'marketing', 'invoicing', 'intake_team', 'other'] as const;

/* ── Time slot ── */

const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
}).refine((s) => s.end > s.start, { message: 'End must be after start' });

/* ── Day availability ── */

const dayAvailabilitySchema = z.object({
  enabled: z.boolean(),
  slots: z.array(timeSlotSchema),
});

/* ── Weekly availability ── */

const weeklyAvailabilitySchema = z.object({
  monday: dayAvailabilitySchema,
  tuesday: dayAvailabilitySchema,
  wednesday: dayAvailabilitySchema,
  thursday: dayAvailabilitySchema,
  friday: dayAvailabilitySchema,
  saturday: dayAvailabilitySchema,
  sunday: dayAvailabilitySchema,
});

/* ── Holiday hours ── */

const holidayHoursSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  label: z.string().nullable(),
  is_closed: z.boolean(),
  slots: z.array(timeSlotSchema),
});

/* ── Positions ── */

const positionEnum = z.enum(POSITION_VALUES);

/* ── Bar license ── */

const barLicenseSchema = z.object({
  state: z.string().min(1),
  number: z.string().default(''),
});

/* ── Office address ── */

const officeAddressSchema = z.object({
  street: z.string().optional().default(''),
  suite: z.string().optional(),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zip: z.string().optional().default(''),
});

const DEFAULT_WEEKLY_AVAILABILITY_VALUE = {
  monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
} satisfies z.input<typeof weeklyAvailabilitySchema>;

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
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().email('Valid email required').catch(undefined),
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
  z.array(z.enum(LANGUAGE_VALUES)).default([]),
);

const optionalStateCodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toUpperCase();
    return US_STATE_CODE_SET.has(trimmed) ? trimmed : undefined;
  },
  usStateCode.optional(),
);

const optionalStateCodeArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : ''))
      .filter((item): item is USStateCode => US_STATE_CODE_SET.has(item));
  },
  z.array(usStateCode).default([]),
);

/* ── Account section ── */

export const accountSchema = z.object({
  email: z.string().email('Valid email required').transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

/* ── Attorney profile section ── */

export const attorneyProfileSchema = z.object({
  fullName: optionalTextSchema,
  firmName: optionalTextSchema,
  bio: optionalTextSchema,
  yearsExperience: optionalNonNegativeIntSchema,
  languages: optionalLanguageArraySchema,
  barLicenses: z.array(barLicenseSchema).optional().default([]),

  primaryEmail: optionalEmailSchema,
  personalEmail: optionalEmailSchema,
  directPhone: optionalTextSchema,
  preferredContact: z.enum(['email', 'phone', 'text']).optional(),

  officeAddress: officeAddressSchema
    .extend({
      state: optionalStateCodeSchema,
    })
    .optional()
    .default({}),
  websiteUrl: optionalTextSchema,
  assistantName: optionalTextSchema,
  assistantEmail: optionalEmailSchema,

  licensedStates: optionalStateCodeArraySchema,
  primaryCity: optionalTextSchema,
  countiesCovered: optionalStringArraySchema,
  federalCourts: optionalTextSchema,

  primaryPracticeFocus: optionalTextSchema,
  injuryCategories: optionalStringArraySchema,
  exclusionaryCriteria: optionalStringArraySchema,
});

/* ── Team member ── */

export const teamMemberSchema = z.object({
  full_name: optionalTextSchema,
  email: optionalEmailSchema,
  phone: optionalTextSchema,
  state: optionalStateCodeSchema,
  position: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return POSITION_VALUES.includes(trimmed as (typeof POSITION_VALUES)[number]) ? trimmed : undefined;
    },
    positionEnum.optional().default('intake_team'),
  ),
  position_other: optionalTextSchema,
  weekly_availability: weeklyAvailabilitySchema.optional().default(DEFAULT_WEEKLY_AVAILABILITY_VALUE),
  holiday_hours: z.array(holidayHoursSchema).optional().default([]),
  shift_availability: optionalTextSchema,
}).transform((d) => ({
  ...d,
  position_other: d.position === 'other' ? d.position_other : null,
}));

export const teamMembersSchema = z.array(teamMemberSchema);

/* ── Full onboarding payload ── */

export const onboardingPayloadSchema = z.object({
  account: accountSchema,
  attorneyProfile: attorneyProfileSchema.optional().default({}),
  teamMembers: teamMembersSchema.optional().default([]),
});

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;
export type AccountData = z.infer<typeof accountSchema>;
export type AttorneyProfileData = z.infer<typeof attorneyProfileSchema>;
export type TeamMemberData = z.infer<typeof teamMemberSchema>;
export type BarLicense = z.infer<typeof barLicenseSchema>;
export type OfficeAddress = z.infer<typeof officeAddressSchema>;
export type WeeklyAvailability = z.infer<typeof weeklyAvailabilitySchema>;

/* ── Default weekly availability: Mon-Fri 09:00-17:00, weekends off ── */

export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailability = DEFAULT_WEEKLY_AVAILABILITY_VALUE;

/* ── Mapping helpers ── */

export function buildOfficeAddressString(addr: OfficeAddress): string {
  const parts = [addr.street];
  if (addr.suite) parts.push(addr.suite);
  parts.push(`${addr.city}, ${addr.state} ${addr.zip}`);
  return parts.join(', ');
}

export function buildBarAssociationNumbers(licenses: BarLicense[]): string[] {
  return licenses.map((l) => `${l.state}|${l.number}`);
}

/** Derive shift_availability from weekly_availability. */
export function deriveShiftAvailability(avail: WeeklyAvailability): string {
  const enabledDays = Object.values(avail).filter((d) => d.enabled);
  if (enabledDays.length === 0) return 'full_day';
  const allSlots = enabledDays.flatMap((d) => d.slots);
  if (allSlots.length === 0) return 'full_day';
  const avgStart = allSlots.reduce((s, sl) => s + parseInt(sl.start.split(':')[0], 10), 0) / allSlots.length;
  const avgEnd = allSlots.reduce((s, sl) => s + parseInt(sl.end.split(':')[0], 10), 0) / allSlots.length;
  if (avgEnd <= 12) return 'morning';
  if (avgStart >= 12 && avgEnd <= 18) return 'afternoon';
  if (avgStart >= 17) return 'evening';
  return 'full_day';
}

/* ── Suggested options for form dropdowns ── */

export const PRACTICE_FOCUS_OPTIONS = [
  'Personal Injury',
  'Motor Vehicle Accidents',
  'Medical Malpractice',
  'Workers Compensation',
  'Slip and Fall',
  'Product Liability',
  'Wrongful Death',
  'Mass Torts',
];

export const INJURY_CATEGORY_OPTIONS = [
  'Auto Accidents',
  'Truck Accidents',
  'Motorcycle Accidents',
  'Pedestrian Accidents',
  'Bicycle Accidents',
  'Rideshare Accidents',
  'Bus Accidents',
  'Dog Bites',
  'Premises Liability',
  'Nursing Home Abuse',
  'Workplace Injuries',
  'Construction Accidents',
  'Brain Injuries',
  'Spinal Cord Injuries',
  'Burn Injuries',
];

export const EXCLUSIONARY_CRITERIA_OPTIONS = [
  'Property damage only',
  'No injury reported',
  'Out of jurisdiction',
  'Pre-existing condition only',
  'Workers comp exclusive',
  'Government entity defendant',
  'Statute of limitations expired',
];
