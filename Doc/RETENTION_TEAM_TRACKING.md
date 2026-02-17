# Retention Team Call Tracking System

## Overview
This feature enables tracking of calls handled by the retention team (separate from normal sales agents). The system adds a boolean flag `is_retention_call` across all relevant tables to distinguish retention calls from regular sales calls.

## Database Changes

### Tables Modified
All migrations have been successfully applied with `is_retention_call` boolean column (default: `false`):

1. **`leads`** - Tracks if a lead is assigned to retention team
2. **`call_results`** - Tracks if the call result was from retention team
3. **`verification_sessions`** - Tracks if the verification session is for retention
4. **`call_update_logs`** - Tracks if log entries are for retention calls
5. **`daily_deal_flow`** - Tracks if daily deal flow entries are from retention

### Column Details
```sql
-- All tables have this column structure:
is_retention_call BOOLEAN DEFAULT false

-- Column comments provide context:
-- leads: "Indicates whether this lead is assigned to the retention team"
-- call_results: "Indicates whether this call was handled by the retention team"
-- verification_sessions: "Indicates whether this verification session is for a retention team call"
-- call_update_logs: "Indicates whether this log entry is for a retention team call"
-- daily_deal_flow: "Indicates whether this call was handled by the retention team"
```

## Implementation Plan

### Frontend Implementation Areas

#### 1. **Dashboard - Claim Call Modal**
**Location:** `src/components/ClaimModal.tsx` (or similar claim components)

**Changes Needed:**
- Add a checkbox control: "Mark as Retention Call"
- Pass `is_retention_call` flag when claiming calls
- Update claim mutation to include the flag

**Example Implementation:**
```typescript
// Add state for retention flag
const [isRetentionCall, setIsRetentionCall] = useState(false);

// In the claim modal form
<div className="flex items-center space-x-2">
  <Checkbox 
    id="retention-call" 
    checked={isRetentionCall}
    onCheckedChange={setIsRetentionCall}
  />
  <label htmlFor="retention-call" className="text-sm font-medium">
    Mark as Retention Call
  </label>
</div>

// When claiming the call
const handleClaim = async () => {
  await supabase
    .from('verification_sessions')
    .update({ 
      licensed_agent_id: user.id,
      status: 'in_progress',
      is_retention_call: isRetentionCall, // Add this flag
      claimed_at: new Date().toISOString()
    })
    .eq('id', sessionId);
};
```

#### 2. **Verification Dashboard - Start Verification**
**Location:** `src/components/VerificationDashboard.tsx`

**Changes Needed:**
- Add retention call checkbox when starting new verification
- Store flag in verification_sessions table
- Propagate flag to related tables (call_results, daily_deal_flow)

**Example Implementation:**
```typescript
// When starting verification from dashboard
const startVerification = async (submissionId: string) => {
  const { data: session } = await supabase
    .from('verification_sessions')
    .insert({
      submission_id: submissionId,
      buffer_agent_id: user.id,
      status: 'in_progress',
      is_retention_call: isRetentionCall, // Add this flag
      started_at: new Date().toISOString()
    })
    .select()
    .single();
    
  // Also update the lead
  await supabase
    .from('leads')
    .update({ is_retention_call: isRetentionCall })
    .eq('submission_id', submissionId);
};
```

#### 3. **Call Result Forms**
**Location:** Various call result submission forms

**Changes Needed:**
- When creating call_results, include is_retention_call flag
- Fetch from verification_sessions or allow manual selection
- Store in call_results table

**Example Implementation:**
```typescript
// When submitting call results
const submitCallResult = async (formData) => {
  // Get retention flag from verification session
  const { data: session } = await supabase
    .from('verification_sessions')
    .select('is_retention_call')
    .eq('submission_id', submissionId)
    .single();

  await supabase
    .from('call_results')
    .insert({
      ...formData,
      is_retention_call: session?.is_retention_call || isRetentionCall,
      created_at: new Date().toISOString()
    });
};
```

#### 4. **Daily Outreach Report**
**Location:** Triggers/automated inserts to daily_deal_flow

**Changes Needed:**
- Update triggers to propagate is_retention_call from call_results
- Ensure manual entries include the flag
- Update bulk import scripts

**Database Trigger Update:**
```sql
-- Update existing trigger to include is_retention_call
CREATE OR REPLACE FUNCTION sync_to_daily_deal_flow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_deal_flow (
    submission_id,
    -- ... other fields ...
    is_retention_call
  ) VALUES (
    NEW.submission_id,
    -- ... other values ...
    NEW.is_retention_call
  )
  ON CONFLICT (submission_id) DO UPDATE SET
    -- ... other updates ...
    is_retention_call = EXCLUDED.is_retention_call;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 5. **Call Update Logs**
**Location:** `src/lib/callLogging.ts` or wherever logging happens

**Changes Needed:**
- Include is_retention_call in all log entries
- Fetch from verification_sessions context

**Example Implementation:**
```typescript
// Update the logging function
export const logCallUpdate = async ({
  submissionId,
  agentId,
  agentType,
  agentName,
  eventType,
  eventDetails,
  verificationSessionId,
  isRetentionCall, // Add this parameter
}: LogCallUpdateParams) => {
  await supabase.from('call_update_logs').insert({
    submission_id: submissionId,
    agent_id: agentId,
    agent_type: agentType,
    agent_name: agentName,
    event_type: eventType,
    event_details: eventDetails,
    verification_session_id: verificationSessionId,
    is_retention_call: isRetentionCall, // Add this field
    created_at: new Date().toISOString()
  });
};
```

### UI/UX Recommendations

1. **Visual Distinction**
   - Add a badge/tag to retention calls (e.g., `<Badge variant="secondary">Retention</Badge>`)
   - Use different colors in tables/lists to distinguish retention calls
   - Add filter options to view only retention or only sales calls

2. **Dashboard Stats**
   - Add separate stats cards for retention team metrics
   - Show "Retention Calls Today", "Regular Calls Today" side by side
   - Include retention conversion rates

3. **Reporting & Analytics**
   - Group by `is_retention_call` in analytics queries
   - Show team-specific performance metrics
   - Add retention team leaderboards

### Example Filter Component
```typescript
// Add to dashboard filters
<Select value={retentionFilter} onValueChange={setRetentionFilter}>
  <SelectTrigger>
    <SelectValue placeholder="Filter by team" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Calls</SelectItem>
    <SelectItem value="sales">Sales Team Only</SelectItem>
    <SelectItem value="retention">Retention Team Only</SelectItem>
  </SelectContent>
</Select>

// In your query
const { data } = await supabase
  .from('verification_sessions')
  .select('*')
  .eq('is_retention_call', retentionFilter === 'retention')
  .neq('is_retention_call', retentionFilter === 'sales');
```

## Security Considerations

### RLS Policies
Existing RLS policies should continue to work as expected. No changes needed unless you want to restrict retention call visibility.

**Optional: Team-specific access**
```sql
-- If you want to restrict retention agents to only see retention calls
CREATE POLICY "Retention agents see retention calls only"
ON verification_sessions
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM profiles WHERE agent_code LIKE 'RET-%'
  ) 
  AND is_retention_call = true
);
```

## Data Integrity

### Cascade Updates
When a call is marked as retention at any stage, ensure it propagates:

```typescript
// Helper function to mark entire call flow as retention
const markCallAsRetention = async (submissionId: string) => {
  await Promise.all([
    supabase.from('leads').update({ is_retention_call: true }).eq('submission_id', submissionId),
    supabase.from('verification_sessions').update({ is_retention_call: true }).eq('submission_id', submissionId),
    supabase.from('call_results').update({ is_retention_call: true }).eq('submission_id', submissionId),
    supabase.from('daily_deal_flow').update({ is_retention_call: true }).eq('submission_id', submissionId),
    supabase.from('call_update_logs').update({ is_retention_call: true }).eq('submission_id', submissionId)
  ]);
};
```

## Testing Checklist

### Database Testing
- [x] Verify all columns exist with correct defaults
- [x] Check column comments are in place
- [ ] Test queries filtering by is_retention_call
- [ ] Verify indexes if needed for performance

### Frontend Testing
- [ ] Test claiming call with retention flag
- [ ] Test starting verification with retention flag
- [ ] Verify flag appears in call_results
- [ ] Check daily_deal_flow receives flag
- [ ] Verify call_update_logs include flag
- [ ] Test filtering by retention team
- [ ] Verify stats/analytics show correct splits

### Integration Testing
- [ ] End-to-end flow: Claim → Verify → Transfer → Submit
- [ ] Verify flag persists through entire workflow
- [ ] Test bulk operations respect the flag
- [ ] Verify exports include retention flag

## Migration Files Created

1. `add_is_retention_call_to_daily_deal_flow`
2. `add_is_retention_call_to_call_results`
3. `add_is_retention_call_to_call_update_logs`
4. `add_is_retention_call_to_verification_sessions`
5. `add_is_retention_call_to_leads`

## Next Steps

1. **Update TypeScript Types**
   ```bash
   # Generate updated types from Supabase
   npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
   ```

2. **Implement UI Components**
   - Start with claim modal checkbox
   - Add to verification dashboard
   - Update all form submissions

3. **Update Reporting**
   - Modify dashboard queries to show team splits
   - Add retention-specific metrics
   - Update Google Sheets sync if needed

4. **Testing**
   - Manual testing of all workflows
   - Verify data consistency across tables
   - Test with both sales and retention agents

## Support & Questions

For implementation questions or issues:
1. Check existing claim/verification components for patterns
2. Review `src/lib/callLogging.ts` for logging patterns
3. Check database RLS policies for access patterns
4. Refer to `PROJECT_DOCUMENTATION.md` for overall architecture

---

**Status:** Database migrations completed ✅  
**Next:** Frontend implementation in progress 🚧
