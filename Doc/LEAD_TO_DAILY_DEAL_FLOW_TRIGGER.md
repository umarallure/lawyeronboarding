# Lead to Daily Outreach Report Auto-Population System

## Overview
This system automatically populates the `daily_deal_flow` table with basic lead information whenever a new lead is created in the `leads` table using PostgreSQL triggers and functions.

## Implementation Details

### Database Function: `insert_lead_to_daily_deal_flow()`
- **Purpose**: Automatically inserts lead data into `daily_deal_flow` table
- **Trigger Type**: AFTER INSERT on `leads` table
- **Language**: PL/pgSQL

### Field Mapping
The following fields are automatically copied from `leads` to `daily_deal_flow`:

| **leads** Table | **daily_deal_flow** Table | **Notes** |
|-----------------|---------------------------|-----------|
| `submission_id` | `submission_id` | Primary identifier |
| `phone_number` | `client_phone_number` | Client contact |
| `lead_vendor` | `lead_vendor` | Lead source |
| `submission_date` | `date` | Uses CURRENT_DATE if null |
| `customer_full_name` | `insured_name` | Customer name |

### Additional Fields in daily_deal_flow
All other fields in `daily_deal_flow` are set to NULL initially and can be updated later:
- `buffer_agent`
- `agent`
- `licensed_agent_account`
- `status`
- `call_result`
- `carrier`
- `product_type`
- `draft_date`
- `monthly_premium`
- `face_amount`
- `from_callback`
- `notes`
- `policy_number`
- `carrier_audit`
- `product_type_carrier`
- `level_or_gi`

## Features

### 1. **Automatic Insertion**
- Triggers immediately when a new lead is created
- No manual intervention required
- Maintains data consistency

### 2. **Duplicate Prevention**
- Uses `ON CONFLICT (submission_id) DO NOTHING`
- Prevents duplicate entries if submission_id already exists
- Safe for multiple executions

### 3. **Date Handling**
- Uses `submission_date` from leads if available
- Falls back to `CURRENT_DATE` if submission_date is NULL
- Converts timestamp to date format automatically

### 4. **Error Handling**
- Graceful handling of NULL values
- Non-blocking operation - won't prevent lead insertion if daily_deal_flow insertion fails

## SQL Implementation

```sql
-- Function Definition
CREATE OR REPLACE FUNCTION insert_lead_to_daily_deal_flow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "public"."daily_deal_flow" (
    "submission_id",
    "client_phone_number", 
    "lead_vendor",
    "date",
    "insured_name"
  )
  VALUES (
    NEW.submission_id,
    NEW.phone_number,
    NEW.lead_vendor,
    COALESCE(NEW.submission_date::date, CURRENT_DATE),
    NEW.customer_full_name
  )
  ON CONFLICT (submission_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger Definition
CREATE TRIGGER trigger_insert_lead_to_daily_deal_flow
  AFTER INSERT ON "public"."leads"
  FOR EACH ROW
  EXECUTE FUNCTION insert_lead_to_daily_deal_flow();
```

## Testing Scenarios Verified

### ✅ **Normal Operation**
- New lead inserted → Corresponding daily_deal_flow record created
- All specified fields properly mapped

### ✅ **NULL Date Handling**
- Lead with NULL submission_date → Uses CURRENT_DATE in daily_deal_flow

### ✅ **Duplicate Prevention**
- Attempt to insert duplicate submission_id → Silently ignored, no error

### ✅ **Field Isolation**
- Only specified fields populated
- Other fields remain NULL for future updates

## Workflow Integration

1. **Lead Creation**: When a new lead is created (via form, API, manual entry)
2. **Auto-Trigger**: Database automatically creates corresponding daily_deal_flow entry
3. **Workflow Continuation**: Other processes can update the daily_deal_flow record with additional information (agent assignments, call results, etc.)

## Benefits

- **Data Consistency**: Ensures every lead has a corresponding daily_deal_flow entry
- **Automation**: Eliminates manual steps in the workflow
- **Real-time**: Immediate population upon lead creation
- **Scalable**: Handles high volume of lead insertions efficiently
- **Reliable**: Built-in error handling and duplicate prevention

## Maintenance

- **Monitor**: Check trigger performance during high-volume periods
- **Backup**: Standard database backup includes trigger definitions
- **Updates**: Function can be modified without affecting existing data
- **Logging**: Consider adding logging if debugging is needed

## Future Enhancements

- Add logging for trigger executions
- Consider adding validation for required fields
- Implement notification system for failed insertions
- Add metrics tracking for trigger performance
