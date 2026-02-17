# Call Result to Daily Outreach Report Auto-Update System

## Overview
This system automatically updates the `daily_deal_flow` table with call result information whenever a call result is saved or updated in the `call_results` table using PostgreSQL triggers and functions.

## Implementation Details

### Database Function: `update_daily_deal_flow_from_call_result()`
- **Purpose**: Automatically updates `daily_deal_flow` table with call result data
- **Trigger Type**: AFTER INSERT OR UPDATE on `call_results` table
- **Language**: PL/pgSQL

### Field Mapping
The following fields are automatically updated from `call_results` to `daily_deal_flow`:

| **call_results** Table | **daily_deal_flow** Table | **Processing Logic** |
|------------------------|---------------------------|---------------------|
| `buffer_agent` | `buffer_agent` | Direct mapping |
| `agent_who_took_call` | `agent` | Direct mapping |
| `licensed_agent_account` | `licensed_agent_account` | Direct mapping |
| `application_submitted` + `status` | `status` | **Status Mapping Logic** (see below) |
| `application_submitted` + `sent_to_underwriting` | `call_result` | **Call Result Logic** (see below) |
| `carrier` | `carrier` | Direct mapping |
| `product_type` | `product_type` | Direct mapping |
| `new_draft_date` OR `draft_date` | `draft_date` | Priority: new_draft_date > draft_date |
| `monthly_premium` | `monthly_premium` | Direct mapping |
| `face_amount` | `face_amount` | Direct mapping |
| `notes` | `notes` | Direct mapping |

### Status Mapping Logic

#### When `application_submitted = TRUE`:
- **Result**: `status = 'Pending Approval'`

#### When `application_submitted = FALSE`:
The agent-selected status is mapped using this logic:

```sql
CASE agent_selected_status
  WHEN 'Needs callback' THEN 'Needs BPO Callback'
  WHEN 'Call Never Sent' THEN 'Incomplete Transfer'
  WHEN 'Not Interested' THEN 'Returned To Center - DQ'
  WHEN 'DQ' THEN 'DQ''d Can''t be sold'
  WHEN '⁠DQ' THEN 'DQ''d Can''t be sold'
  WHEN 'Future Submission Date' THEN 'Application Withdrawn'
  WHEN 'Call Back Fix' THEN 'NO STAGE CHANGE'
  WHEN 'Disconnected' THEN 'Incomplete Transfer'
  WHEN 'Disconnected - Never Retransferred' THEN 'Incomplete Transfer'
  ELSE agent_selected_status  -- Pass through other values
END
```

### Call Result Logic

#### When `application_submitted = TRUE`:
- If `sent_to_underwriting = TRUE` → `call_result = 'Underwriting'`
- If `sent_to_underwriting = FALSE` → `call_result = 'Submitted'`

#### When `application_submitted = FALSE`:
- `call_result = 'Not Submitted'`

#### When `application_submitted = NULL`:
- `call_result = ''` (empty string)

### Draft Date Priority Logic
```sql
COALESCE(
  CASE 
    WHEN new_draft_date IS NOT NULL THEN new_draft_date
    WHEN draft_date IS NOT NULL THEN draft_date::date
    ELSE existing_draft_date
  END, 
  existing_draft_date
)
```

## SQL Implementation

```sql
-- Function Definition
CREATE OR REPLACE FUNCTION update_daily_deal_flow_from_call_result()
RETURNS TRIGGER AS $$
DECLARE
  mapped_status TEXT;
  final_call_result TEXT;
BEGIN
  -- Status mapping
  mapped_status := CASE NEW.status
    WHEN 'Needs callback' THEN 'Needs BPO Callback'
    WHEN 'Call Never Sent' THEN 'Incomplete Transfer'
    WHEN 'Not Interested' THEN 'Returned To Center - DQ'
    WHEN 'DQ' THEN 'DQ''d Can''t be sold'
    WHEN '⁠DQ' THEN 'DQ''d Can''t be sold'
    WHEN 'Future Submission Date' THEN 'Application Withdrawn'
    WHEN 'Call Back Fix' THEN 'NO STAGE CHANGE'
    WHEN 'Disconnected' THEN 'Incomplete Transfer'
    WHEN 'Disconnected - Never Retransferred' THEN 'Incomplete Transfer'
    ELSE COALESCE(NEW.status, '')
  END;

  -- Override status for submitted applications
  IF NEW.application_submitted = TRUE THEN
    mapped_status := 'Pending Approval';
  END IF;

  -- Determine call result
  final_call_result := CASE
    WHEN NEW.application_submitted = TRUE THEN
      CASE 
        WHEN NEW.sent_to_underwriting = TRUE THEN 'Underwriting'
        ELSE 'Submitted'
      END
    WHEN NEW.application_submitted = FALSE THEN 'Not Submitted'
    ELSE ''
  END;

  -- Update daily_deal_flow
  UPDATE "public"."daily_deal_flow"
  SET
    buffer_agent = COALESCE(NEW.buffer_agent, buffer_agent),
    agent = COALESCE(NEW.agent_who_took_call, agent),
    licensed_agent_account = COALESCE(NEW.licensed_agent_account, licensed_agent_account),
    status = mapped_status,
    call_result = final_call_result,
    carrier = COALESCE(NEW.carrier, carrier),
    product_type = COALESCE(NEW.product_type, product_type),
    draft_date = COALESCE(
      CASE 
        WHEN NEW.new_draft_date IS NOT NULL THEN NEW.new_draft_date
        WHEN NEW.draft_date IS NOT NULL THEN NEW.draft_date::date
        ELSE draft_date
      END, 
      draft_date
    ),
    monthly_premium = COALESCE(NEW.monthly_premium, monthly_premium),
    face_amount = COALESCE(NEW.face_amount, face_amount),
    notes = COALESCE(NEW.notes, notes),
    updated_at = NOW()
  WHERE submission_id = NEW.submission_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger Definition
CREATE TRIGGER trigger_update_daily_deal_flow_from_call_result
  AFTER INSERT OR UPDATE ON "public"."call_results"
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_deal_flow_from_call_result();
```

## Testing Scenarios Verified

### ✅ **Application Submitted (Underwriting)**
- Input: `application_submitted = TRUE`, `sent_to_underwriting = TRUE`
- Result: `status = 'Pending Approval'`, `call_result = 'Underwriting'`

### ✅ **Application Submitted (No Underwriting)**
- Input: `application_submitted = TRUE`, `sent_to_underwriting = FALSE`
- Result: `status = 'Pending Approval'`, `call_result = 'Submitted'`

### ✅ **Application Not Submitted (DQ)**
- Input: `application_submitted = FALSE`, `status = '⁠DQ'`
- Result: `status = 'DQ\'d Can\'t be sold'`, `call_result = 'Not Submitted'`

### ✅ **Application Not Submitted (Needs Callback)**
- Input: `application_submitted = FALSE`, `status = 'Needs callback'`
- Result: `status = 'Needs BPO Callback'`, `call_result = 'Not Submitted'`

### ✅ **Draft Date Priority**
- Input: `new_draft_date = '2025-10-15'`, `draft_date = '2025-09-20'`
- Result: `draft_date = '2025-10-15'` (new_draft_date takes priority)

### ✅ **Update Operations**
- Existing call results can be updated and daily_deal_flow reflects changes

### ✅ **NULL Value Handling**
- COALESCE ensures existing values are preserved when new values are NULL

## Workflow Integration

1. **Agent Submits Call Result Form** (CallResultForm.tsx)
2. **Call Result Saved** to `call_results` table
3. **Database Trigger Fires** (automatic, immediate)
4. **Daily Outreach Report Updated** with mapped values
5. **Status & Call Result** properly categorized
6. **Other Workflows Continue** (Google Sheets, Slack notifications, etc.)

## Benefits

- **Automatic Synchronization**: No manual steps required
- **Real-time Updates**: Immediate reflection of call result data
- **Consistent Mapping**: Standardized status and call result values
- **Data Integrity**: COALESCE preserves existing values when appropriate
- **Scalable**: Handles high volume of call result updates
- **Maintainable**: Clear mapping logic that can be easily updated

## Maintenance

- **Status Mapping**: Update the CASE statement in the function if new statuses are added
- **Field Mapping**: Modify the UPDATE statement if new fields need to be synchronized
- **Performance**: Monitor trigger performance during high-volume periods
- **Logging**: Consider adding logging for debugging if needed

## Integration with Existing System

This trigger works in conjunction with:
1. **Lead to Daily Outreach Report Trigger**: Creates initial daily_deal_flow entries
2. **CallResultForm Component**: Frontend form that saves to call_results table
3. **Google Sheets Sync**: Continues to work as before
4. **Slack Notifications**: Continues to work as before

The system maintains backward compatibility while adding automatic database synchronization.
