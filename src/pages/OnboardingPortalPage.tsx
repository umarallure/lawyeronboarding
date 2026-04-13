import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Briefcase,
  MapPin,
  Scale,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { US_STATES } from '@/lib/us-states';
import {
  type BarLicense,
  type TeamMemberData,
  type WeeklyAvailability,
  DEFAULT_WEEKLY_AVAILABILITY,
  PRACTICE_FOCUS_OPTIONS,
  INJURY_CATEGORY_OPTIONS,
  EXCLUSIONARY_CRITERIA_OPTIONS,
  onboardingPayloadSchema,
  deriveShiftAvailability,
} from '@/lib/onboarding-schema';

/* ── Constants ── */

const STATE_CODE_OPTIONS = US_STATES.map((s) => s.code);
const LANGUAGE_OPTIONS = ['English', 'Spanish'];
const POSITION_OPTIONS = [
  { value: 'accounting', label: 'Accounting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'invoicing', label: 'Invoicing' },
  { value: 'intake_team', label: 'Intake Team' },
  { value: 'other', label: 'Other' },
];
const DASH_SELECT_TRIGGER_CLASS =
  'h-9 border-[var(--dash-border)] bg-background/80 text-[13px] text-[var(--dash-text)] backdrop-blur-sm focus:ring-[#AE4010]/30 hover:border-[var(--dash-border-hover)]';
const DASH_SELECT_CONTENT_CLASS =
  'border-[var(--dash-border)] bg-background/95 text-[var(--dash-text)] shadow-xl backdrop-blur-xl';
const DASH_MULTISELECT_CLASS =
  'border-[var(--dash-border)] bg-background/80 text-[13px] text-[var(--dash-text)] backdrop-blur-sm hover:border-[var(--dash-border-hover)]';
const DASH_MULTISELECT_COMPACT_CLASS = `${DASH_MULTISELECT_CLASS} min-h-9 h-9`;

/* ── Reusable UI primitives ── */

function SectionCard({
  icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="group/section dash-animate-in relative isolate overflow-hidden rounded-2xl border border-[#AE4010]/50 bg-[var(--dash-surface)] backdrop-blur-[var(--dash-blur)] shadow-[var(--dash-shadow)] transition-all duration-300 hover:border-[#AE4010]/65 hover:shadow-[0_14px_30px_rgba(174,64,16,0.14)] focus-within:border-[#AE4010]/75 focus-within:shadow-[0_16px_34px_rgba(174,64,16,0.18)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Card header */}
      <div className="relative flex items-center gap-3 px-5 py-3.5 border-b border-[#AE4010]/12 bg-[linear-gradient(90deg,rgba(174,64,16,0.18)_0%,rgba(174,64,16,0.1)_28%,rgba(174,64,16,0.04)_54%,rgba(174,64,16,0)_84%)]">
        {/* Bottom accent rule */}
        <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-[#AE4010] via-[#AE4010]/50 to-transparent" />
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#AE4010]/45 bg-[#AE4010]/10">
          <span className="text-[#AE4010]">{icon}</span>
        </div>
        <h2 className="text-[13px] font-semibold text-[var(--dash-text)]">{title}</h2>
      </div>
      {/* Card body */}
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-medium text-[var(--dash-text)] mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function FieldHelper({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[var(--dash-text-muted)] mt-0.5">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-red-400 mt-0.5">{message}</p>;
}

function FormInput({
  label,
  required,
  helper,
  error,
  ...props
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Input
        className="h-9 border-[var(--dash-border)] bg-transparent text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/50 focus:ring-[#AE4010]/30 focus:border-[#AE4010]/40"
        {...props}
      />
      {helper && <FieldHelper>{helper}</FieldHelper>}
      <FieldError message={error} />
    </div>
  );
}

function ToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; activeColor: string }[];
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(isActive ? '' : opt.value)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
              isActive
                ? `${opt.activeColor} border-current`
                : 'border-[#AE4010]/20 text-[var(--dash-text-muted)] hover:bg-white/[0.03]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusBanner({
  type,
  message,
}: {
  type: 'success' | 'error' | 'warning';
  message: string;
}) {
  const config = {
    success: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', icon: <CheckCircle2 className="h-4 w-4" /> },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: <AlertTriangle className="h-4 w-4" /> },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: <AlertTriangle className="h-4 w-4" /> },
  }[type];

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${config.bg} ${config.border} ${config.text}`}>
      {config.icon}
      <span className="text-[12px] font-medium">{message}</span>
    </div>
  );
}

/* ── Blank team member ── */

function blankTeamMember(): Omit<TeamMemberData, 'position_other'> & { position_other?: string | null } {
  return {
    full_name: '',
    email: '',
    phone: '',
    state: undefined,
    position: 'intake_team',
    position_other: '',
    weekly_availability: { ...DEFAULT_WEEKLY_AVAILABILITY },
    holiday_hours: [],
  };
}

function hasMeaningfulTeamMemberData(member: ReturnType<typeof blankTeamMember>) {
  const position = member.position ?? '';

  return Boolean(
    (member.full_name ?? '').trim() ||
    (member.email ?? '').trim() ||
    (member.phone ?? '').trim() ||
    member.state ||
    (position === 'other' ? (member.position_other ?? '').trim() : '') ||
    (position && position !== 'intake_team')
  );
}

/* ══════════════════════════════════════════════════════════
   Main page component
   ══════════════════════════════════════════════════════════ */

export default function OnboardingPortalPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const disclaimerPanelId = 'onboarding-important-notes';

  /* ── Account state ── */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  /* ── Attorney profile state ── */
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [barLicenses, setBarLicenses] = useState<BarLicense[]>([]);
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [primaryEmailTouched, setPrimaryEmailTouched] = useState(false);
  const [personalEmail, setPersonalEmail] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [preferredContact, setPreferredContact] = useState('');
  const [street, setStreet] = useState('');
  const [suite, setSuite] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [zip, setZip] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [assistantEmail, setAssistantEmail] = useState('');
  const [licensedStates, setLicensedStates] = useState<string[]>([]);
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [countiesCovered, setCountiesCovered] = useState<string[]>([]);
  const [countiesInput, setCountiesInput] = useState('');
  const [federalCourts, setFederalCourts] = useState('');
  const [primaryPracticeFocus, setPrimaryPracticeFocus] = useState('');
  const [injuryCategories, setInjuryCategories] = useState<string[]>([]);
  const [exclusionaryCriteria, setExclusionaryCriteria] = useState<string[]>([]);

  /* ── Team members state ── */
  const [teamMembers, setTeamMembers] = useState<ReturnType<typeof blankTeamMember>[]>([]);

  /* ── UI state ── */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);

  useEffect(() => {
    if (!primaryEmailTouched) {
      setPrimaryEmail(email);
    }
  }, [email, primaryEmailTouched]);

  /* ── Bar license helpers ── */
  const addBarLicense = () => setBarLicenses((prev) => [...prev, { state: 'FL' as any, number: '' }]);
  const removeBarLicense = (idx: number) => setBarLicenses((prev) => prev.filter((_, i) => i !== idx));
  const updateBarLicense = (idx: number, field: 'state' | 'number', value: string) => {
    setBarLicenses((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  /* ── Team member helpers ── */
  const addTeamMember = () => setTeamMembers((prev) => [...prev, blankTeamMember()]);
  const removeTeamMember = (idx: number) => setTeamMembers((prev) => prev.filter((_, i) => i !== idx));
  const updateTeamMember = (idx: number, field: string, value: unknown) => {
    setTeamMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  /* ── Counties chip input ── */
  const handleCountiesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = countiesInput.trim();
      if (val && !countiesCovered.includes(val)) {
        setCountiesCovered((prev) => [...prev, val]);
      }
      setCountiesInput('');
    }
  };
  const removeCounty = (county: string) => setCountiesCovered((prev) => prev.filter((c) => c !== county));

  /* ── Submit ── */
  const handleSubmit = useCallback(async () => {
    setFieldErrors({});
    setSubmitResult(null);
    setSubmitWarnings([]);

    const transformedMembers = teamMembers
      .filter(hasMeaningfulTeamMemberData)
      .map((member) => ({
        ...member,
        position_other: member.position === 'other' ? member.position_other || undefined : undefined,
        shift_availability: deriveShiftAvailability(member.weekly_availability as WeeklyAvailability),
      }));

    const payloadResult = onboardingPayloadSchema.safeParse({
      account: { email, password, confirmPassword },
      attorneyProfile: {
        fullName,
        firmName,
        bio,
        yearsExperience,
        languages,
        barLicenses,
        primaryEmail: primaryEmail || undefined,
        personalEmail,
        directPhone,
        preferredContact: preferredContact || undefined,
        officeAddress: { street, suite, city, state: addressState, zip },
        websiteUrl,
        assistantName,
        assistantEmail,
        licensedStates,
        primaryCity: primaryLocation,
        countiesCovered,
        federalCourts,
        primaryPracticeFocus,
        injuryCategories,
        exclusionaryCriteria,
      },
      teamMembers: transformedMembers,
    });

    if (!payloadResult.success) {
      const errors: Record<string, string> = {};
      payloadResult.error.issues.forEach((issue) => {
        errors[issue.path.join('.')] = issue.message;
      });
      setFieldErrors(errors);
      const errorList = Object.entries(errors).map(([, msg]) => msg).join(', ');
      setSubmitResult({ type: 'error', message: errorList });
      // Scroll to top so the user sees the banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const payload = payloadResult.data;

    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('onboard-lawyer', {
        method: 'POST',
        body: {
          account: {
            email: payload.account.email,
            password: payload.account.password,
          },
          attorneyProfile: payload.attorneyProfile,
          teamMembers: payload.teamMembers,
        },
      });

      if (fnError) {
        const msg = fnError.message || 'Failed to create lawyer account';
        setSubmitResult({ type: 'error', message: msg });
        if (data?.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      if (data?.error) {
        setSubmitResult({ type: 'error', message: data.error });
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      const warnings = Array.isArray(data?.warnings)
        ? data.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
        : [];
      const createdEmail = payload.account.email;
      const displayName = (payload.attorneyProfile?.fullName || '').trim();

      setSubmitWarnings(warnings);
      setSubmitResult({
        type: 'success',
        message: warnings.length > 0
          ? `Lawyer account created successfully for ${createdEmail}. Review the notes below.`
          : `Lawyer account created successfully for ${createdEmail}`,
      });
      toast({
        title: warnings.length > 0 ? 'Account Created With Notes' : 'Account Created',
        description: warnings.length > 0
          ? warnings[0]
          : displayName
            ? `${displayName} (${createdEmail}) has been onboarded.`
            : `${createdEmail} has been onboarded.`,
      });

      // Keep the user on the page when there are follow-up notes to review.
      if (data?.userId && warnings.length === 0) {
        setTimeout(() => {
          navigate(`/account-management/lawyer-profiles/${data.userId}`);
        }, 1500);
      }
    } catch (err) {
      setSubmitResult({ type: 'error', message: (err as Error).message || 'Unexpected error' });
    } finally {
      setSubmitting(false);
    }
  }, [
    email, password, confirmPassword, fullName, firmName, bio, yearsExperience,
    languages, barLicenses, primaryEmail, personalEmail, directPhone,
    preferredContact, street, suite, city, addressState, zip, websiteUrl,
    assistantName, assistantEmail, licensedStates, primaryLocation, countiesCovered,
    federalCourts, primaryPracticeFocus, injuryCategories, exclusionaryCriteria,
    teamMembers, toast, navigate,
  ]);

  const e = (key: string) => fieldErrors[key];

  return (
    <div className="dashboard-premium min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px] space-y-5">

        {/* ── Page header ── */}
        <div className="dash-animate-in">
          <h1 className="text-lg font-bold text-[var(--dash-text)]">New Lawyer Onboarding</h1>
          <p className="text-[12px] text-[var(--dash-text-muted)] mt-0.5">
            This form can be used simply for account creation as well. Only Account Credentials are required, and every other field is optional.
          </p>
        </div>

        {/* ── Result banner ── */}
        {submitResult && (
          <StatusBanner type={submitResult.type} message={submitResult.message} />
        )}
        {submitWarnings.length > 0 && (
          <div className="space-y-2">
            {submitWarnings.map((warning, index) => (
              <StatusBanner key={`submit-warning-${index}`} type="warning" message={warning} />
            ))}
          </div>
        )}

        {/* ═══ Section 1: Account Credentials ═══ */}
        <SectionCard icon={<User className="h-3.5 w-3.5" />} title="Account Credentials" delay={60}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Email Address"
              required
              type="email"
              placeholder="lawyer@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={e('account.email')}
            />
            <div /> {/* spacer */}
            <div>
              <FieldLabel required>Password</FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="h-9 pr-9 border-[var(--dash-border)] bg-background/80 text-[13px] text-[var(--dash-text)] backdrop-blur-sm placeholder:text-[var(--dash-text-muted)]/50 focus:ring-[#AE4010]/30"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <FieldError message={e('account.password')} />
            </div>
            <FormInput
              label="Confirm Password"
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={e('account.confirmPassword')}
            />
          </div>
        </SectionCard>

        {/* ═══ Section 2: Account & Identity ═══ */}
        <SectionCard icon={<Briefcase className="h-3.5 w-3.5" />} title="Account & Identity" delay={120}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={e('profile.fullName')}
            />
            <FormInput
              label="Firm Name"
              placeholder="Doe & Associates"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              error={e('profile.firmName')}
            />
            <FormInput
              label="Years of Experience"
              type="number"
              placeholder="10"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              min={0}
            />
            <div>
              <FieldLabel>Languages</FieldLabel>
              <MultiSelect
                options={LANGUAGE_OPTIONS}
                selected={languages}
                onChange={setLanguages}
                placeholder="Select languages"
                className={DASH_MULTISELECT_COMPACT_CLASS}
                showSelectAll={false}
              />
              <FieldError message={e('profile.languages')} />
            </div>
          </div>
          <div className="mt-3">
            <FieldLabel>Bio</FieldLabel>
            <Textarea
              placeholder="Brief attorney bio..."
              className="min-h-[72px] border-[var(--dash-border)] bg-transparent text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/50 focus:ring-[#AE4010]/30"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Bar Licenses</FieldLabel>
              <button
                type="button"
                onClick={addBarLicense}
                className="flex items-center gap-1 text-[11px] text-[#AE4010] hover:text-[#E8622A] font-medium transition-colors"
              >
                <Plus className="h-3 w-3" /> Add License
              </button>
            </div>
            <FieldError message={e('profile.barLicenses')} />
            <div className="space-y-2">
              {barLicenses.map((lic, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Select value={lic.state} onValueChange={(v) => updateBarLicense(idx, 'state', v)}>
                    <SelectTrigger className={`w-24 ${DASH_SELECT_TRIGGER_CLASS}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-9 flex-1 border-[var(--dash-border)] bg-transparent text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/50"
                    placeholder="License number"
                    value={lic.number}
                    onChange={(e) => updateBarLicense(idx, 'number', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeBarLicense(idx)}
                    aria-label={`Remove bar license ${idx + 1}`}
                    className="text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ═══ Section 2: Contact & Address ═══ */}
        <SectionCard icon={<MapPin className="h-3.5 w-3.5" />} title="Contact Details" delay={180}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput
              label="Primary Email"
              type="email"
              placeholder="lawyer@firm.com"
              value={primaryEmail}
              onChange={(e) => {
                setPrimaryEmailTouched(true);
                setPrimaryEmail(e.target.value);
              }}
              error={e('profile.primaryEmail')}
            />
            <FormInput
              label="Personal Email"
              type="email"
              placeholder="john@personal.com"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
            />
            <FormInput
              label="Direct Phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={directPhone}
              onChange={(e) => setDirectPhone(e.target.value)}
              error={e('profile.directPhone')}
            />
            <div>
              <FieldLabel>Preferred Contact Method</FieldLabel>
              <ToggleGroup
                value={preferredContact}
                onChange={setPreferredContact}
                options={[
                  { value: 'email', label: 'Email', activeColor: 'bg-green-500/15 text-green-400' },
                  { value: 'phone', label: 'Phone', activeColor: 'bg-green-500/15 text-green-400' },
                  { value: 'text', label: 'Text', activeColor: 'bg-green-500/15 text-green-400' },
                ]}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <p className="text-[11px] font-medium text-[var(--dash-text-muted)] uppercase tracking-wider mb-2">Office Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                label="Street Address"
                placeholder="123 Main St"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                error={e('profile.officeAddress.street')}
              />
              <FormInput
                label="Suite / Unit"
                placeholder="Suite 200"
                value={suite}
                onChange={(e) => setSuite(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <FormInput
                label="City"
                placeholder="Miami"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                error={e('profile.officeAddress.city')}
              />
              <div>
                <FieldLabel>State</FieldLabel>
                <Select value={addressState} onValueChange={setAddressState}>
                  <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={e('profile.officeAddress.state')} />
              </div>
              <FormInput
                label="ZIP Code"
                placeholder="33101"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                error={e('profile.officeAddress.zip')}
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormInput
                label="Website URL"
                type="url"
                placeholder="https://www.firm.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <div /> {/* spacer */}
              <FormInput
                label="Assistant Name"
                placeholder="Jane Smith"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
              />
              <FormInput
                label="Assistant Email"
                type="email"
                placeholder="assistant@firm.com"
                value={assistantEmail}
                onChange={(e) => setAssistantEmail(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        {/* ═══ Section 3: Expertise & Jurisdiction ═══ */}
        <SectionCard icon={<Scale className="h-3.5 w-3.5" />} title="Expertise & Jurisdiction" delay={240}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Licensed States</FieldLabel>
              <div className="min-h-[20px]">
                <FieldHelper>Maximum 5 states</FieldHelper>
              </div>
              <MultiSelect
                options={STATE_CODE_OPTIONS}
                selected={licensedStates}
                onChange={(v) => setLicensedStates(v.slice(0, 5))}
                placeholder="Select states"
                className={DASH_MULTISELECT_COMPACT_CLASS}
                showSelectAll={false}
              />
              <FieldError message={e('profile.licensedStates')} />
            </div>
            <div>
              <FieldLabel>Primary Location</FieldLabel>
              <div className="min-h-[20px]">
                <FieldHelper>Select one state</FieldHelper>
              </div>
              <Select value={primaryLocation} onValueChange={setPrimaryLocation}>
                <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={e('profile.primaryCity')} />
            </div>
          </div>

          <div className="mt-3">
            <FieldLabel>Counties Covered</FieldLabel>
            <FieldHelper>Type a county name and press Enter to add</FieldHelper>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {countiesCovered.map((county) => (
                <span
                  key={county}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#AE4010]/10 text-[11px] text-[#AE4010] font-medium"
                >
                  {county}
                  <button type="button" onClick={() => removeCounty(county)} className="hover:text-red-400">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              className="h-9 mt-1.5 border-[var(--dash-border)] bg-transparent text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/50"
              placeholder="e.g. Miami-Dade County"
              value={countiesInput}
              onChange={(e) => setCountiesInput(e.target.value)}
              onKeyDown={handleCountiesKeyDown}
            />
          </div>

          <div className="mt-3">
            <FormInput
              label="Federal Courts"
              placeholder="e.g. Southern District of Florida"
              value={federalCourts}
              onChange={(e) => setFederalCourts(e.target.value)}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Primary Practice Focus</FieldLabel>
                <Select value={primaryPracticeFocus} onValueChange={setPrimaryPracticeFocus}>
                  <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select focus area" />
                  </SelectTrigger>
                  <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                    {PRACTICE_FOCUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={e('profile.primaryPracticeFocus')} />
              </div>
              <div>
                <FieldLabel>Injury Categories</FieldLabel>
                <MultiSelect
                  options={INJURY_CATEGORY_OPTIONS}
                  selected={injuryCategories}
                  onChange={setInjuryCategories}
                  placeholder="Select categories"
                  className={DASH_MULTISELECT_COMPACT_CLASS}
                />
                <FieldError message={e('profile.injuryCategories')} />
              </div>
            </div>
            <div className="mt-3">
              <FieldLabel>Exclusionary Criteria</FieldLabel>
              <FieldHelper>Cases the attorney will not accept</FieldHelper>
              <MultiSelect
                options={EXCLUSIONARY_CRITERIA_OPTIONS}
                selected={exclusionaryCriteria}
                onChange={setExclusionaryCriteria}
                placeholder="Select criteria"
                className={DASH_MULTISELECT_CLASS}
              />
            </div>
          </div>
        </SectionCard>

        {/* ═══ Section 4: Team Members ═══ */}
        <SectionCard icon={<Users className="h-3.5 w-3.5" />} title="Team Members" delay={300}>
          {teamMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--dash-border)] px-4 py-8 text-center">
              <p className="text-[12px] text-[var(--dash-text-muted)]">
                No team members added yet. Add contacts from the firm's team.
              </p>
              <button
                type="button"
                onClick={addTeamMember}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#AE4010]/10 text-[12px] font-medium text-[#AE4010] hover:bg-[#AE4010]/20 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Team Member
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--dash-border)] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-[var(--dash-text-muted)] uppercase tracking-wider">
                      Team Member {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTeamMember(idx)}
                      className="text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormInput
                      label="Full Name"
                      placeholder="Jane Smith"
                      value={member.full_name}
                      onChange={(e) => updateTeamMember(idx, 'full_name', e.target.value)}
                      error={e(`team.${idx}.full_name`)}
                    />
                    <FormInput
                      label="Email"
                      type="email"
                      placeholder="jane@firm.com"
                      value={member.email}
                      onChange={(e) => updateTeamMember(idx, 'email', e.target.value)}
                      error={e(`team.${idx}.email`)}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FormInput
                      label="Phone"
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={member.phone || ''}
                      onChange={(e) => updateTeamMember(idx, 'phone', e.target.value)}
                    />
                    <div>
                      <FieldLabel>State</FieldLabel>
                      <Select
                        value={member.state || ''}
                        onValueChange={(v) => updateTeamMember(idx, 'state', v)}
                      >
                        <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                          {US_STATES.map((s) => (
                            <SelectItem key={s.code} value={s.code}>{s.code} - {s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Position</FieldLabel>
                      <Select
                        value={member.position}
                        onValueChange={(v) => updateTeamMember(idx, 'position', v)}
                      >
                        <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                          {POSITION_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {member.position === 'other' && (
                      <FormInput
                        label="Specify Position"
                        placeholder="e.g. Paralegal"
                        value={member.position_other || ''}
                        onChange={(e) => updateTeamMember(idx, 'position_other', e.target.value)}
                        error={e(`team.${idx}.position_other`)}
                      />
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addTeamMember}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#AE4010] hover:text-[#E8622A] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Another Member
              </button>
            </div>
          )}
        </SectionCard>

        {/* ═══ Disclaimer / Warning card ═══ */}
        <div className="dash-animate-in" style={{ animationDelay: '300ms' }}>
          <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08)_0%,rgba(245,158,11,0.04)_100%)] shadow-[0_10px_24px_rgba(120,53,15,0.08)] backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setDisclaimerOpen(!disclaimerOpen)}
              aria-expanded={disclaimerOpen}
              aria-controls={disclaimerPanelId}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-amber-500/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <span className="block text-[12px] font-semibold text-amber-200">Important Notes</span>
                  <span className="mt-0.5 block text-[11px] text-amber-200/70">
                    A few account creation details to keep in mind before submitting.
                  </span>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/8">
                {disclaimerOpen ? (
                  <ChevronUp className="h-4 w-4 text-amber-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-amber-400" />
                )}
              </div>
            </button>
            {disclaimerOpen && (
              <div
                id={disclaimerPanelId}
                className="border-t border-amber-500/15 px-5 py-4"
              >
                <div className="space-y-3">
                  <p className="text-[12px] leading-5 text-amber-100/85">
                    This creates a real user account in the system with{' '}
                    <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
                      lawyer
                    </span>{' '}
                    role access.
                  </p>
                  <p className="text-[12px] leading-5 text-amber-100/80">
                    The attorney can log in immediately with the credentials provided, and any profile details entered here will be pre-populated for them.
                  </p>
                  <p className="text-[12px] leading-5 text-amber-100/80">
                    Team members entered here will be associated with the attorney account and can be updated later from Lawyer Management section.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Submit ═══ */}
        <div className="dash-animate-in flex justify-end gap-3 pb-8" style={{ animationDelay: '360ms' }}>
          <Button
            variant="outline"
            className="border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:bg-white/[0.03]"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#AE4010] text-white hover:bg-[#7c2c0a] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Lawyer Account'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
