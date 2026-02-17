# Call Result Update - Test Cases

## Overview
These test cases validate the simplified call result update system with two call sources: BPO Transfer and Agent Callback.

## Test Scenarios

### Scenario 1: BPO Transfer - New Entry (No existing Daily Outreach Report entry)
**Input:**
- Submission ID: `SUB001`
- Call Source: `BPO Transfer`
- Application Submitted: `true`
- Customer Name: `John Doe`
- Carrier: `Liberty`
- Monthly Premium: `150.00`
- Face Amount: `50000`

**Expected Behavior:**
- Should create NEW entry in daily_deal_flow with CBB prefix: `CBB1234SUB001`
- Should create new Google Sheets entry with CBB submission ID
- Should send Slack notification for submitted application
- Daily Outreach Report entry should have today's date

**Database Verification:**
```sql
SELECT * FROM daily_deal_flow WHERE submission_id LIKE 'CBB%SUB001';
```

---

### Scenario 2: BPO Transfer - Update Existing Entry (Entry exists for today)
**Input:**
- Submission ID: `SUB002` (already exists in daily_deal_flow for today)
- Call Source: `BPO Transfer`
- Application Submitted: `false`
- Status: `Chargeback DQ`
- Status Reason: `Chargeback DQ`
- Notes: `John Doe has caused multiple chargebacks. We will not accept this caller into our agency`

**Expected Behavior:**
- Should UPDATE existing entry for today
- Should NOT create new CBB entry
- Should update Google Sheets with same submission ID
- Should send center notification for not submitted application

**Database Verification:**
```sql
SELECT * FROM daily_deal_flow WHERE submission_id = 'SUB002' AND date = CURRENT_DATE;
```

---

### Scenario 3: Agent Callback - New Entry (No existing Daily Outreach Report entry for today)
**Input:**
- Submission ID: `SUB003`
- Call Source: `Agent Callback`
- Application Submitted: `true`
- Customer Name: `Jane Smith`
- Carrier: `SBLI`
- Monthly Premium: `200.00`
- Face Amount: `75000`
- Sent to Underwriting: `true`

**Expected Behavior:**
- Should create NEW entry in daily_deal_flow with CBB prefix: `CBB5678SUB003`
- Should create new Google Sheets entry with CBB submission ID
- Should send Slack notification for submitted application
- Call result should be "Underwriting" due to sent_to_underwriting = true

**Database Verification:**
```sql
SELECT * FROM daily_deal_flow WHERE submission_id LIKE 'CBB%SUB003';
```

---

### Scenario 4: Agent Callback - Update Existing Entry (Entry exists for today)
**Input:**
- Submission ID: `SUB004` (already exists in daily_deal_flow for today)
- Call Source: `Agent Callback`
- Application Submitted: `false`
- Status: `Not Interested`
- Status Reason: `Existing coverage - Not Looking for More`
- Notes: `Jane Smith has existing coverage and cannot afford additional coverage`

**Expected Behavior:**
- Should UPDATE existing entry for today
- Should NOT create new CBB entry
- Should update Google Sheets with same submission ID
- Should send center notification for not submitted application

**Database Verification:**
```sql
SELECT * FROM daily_deal_flow WHERE submission_id = 'SUB004' AND date = CURRENT_DATE;
```

---

### Scenario 5: Disconnected Call
**Input:**
- Submission ID: `SUB005`
- Call Source: `BPO Transfer`
- Application Submitted: `false`
- Status: `Disconnected`
- Buffer Agent: `Ira`
- Agent Who Took Call: `N/A`

**Expected Behavior:**
- Should create NEW entry in daily_deal_flow with CBB prefix (if no entry for today)
- Should send disconnected call notification
- Should send center notification
- Should NOT send Slack notification

**Database Verification:**
```sql
SELECT * FROM daily_deal_flow WHERE submission_id LIKE 'CBB%SUB005' AND status = 'Incomplete Transfer';
```

---

## Edge Cases

### Edge Case 1: Multiple Updates Same Day
**Scenario:** Same submission ID gets multiple call result updates on the same day
**Expected:** Should always update the existing entry, never create duplicate entries for same day

### Edge Case 2: CBB Prefix Collision
**Scenario:** Generated CBB prefix might collide with existing submission ID
**Expected:** System should handle gracefully (very low probability with 4-digit random number)

### Edge Case 3: Missing Lead Data
**Scenario:** Submission ID doesn't exist in leads table
**Expected:** System should handle gracefully and not fail the entire process

---

## Database Schema Validation

### Daily Outreach Report Entry Fields:
- `submission_id`: Should be either original or CBB prefixed
- `date`: Should be today's date for new entries
- `from_callback`: Should be `true` for Agent Callback, `false` for BPO Transfer
- `is_callback`: Should be `true` for CBB prefixed entries
- `call_result`: Should be "Submitted", "Underwriting", or "Not Submitted"
- `status`: Should be mapped correctly via `mapStatusToSheetValue` function

### Call Results Entry Fields:
- `submission_id`: Always original submission ID
- `call_source`: Either "BPO Transfer" or "Agent Callback"
- `application_submitted`: Boolean value
- `is_callback`: Should match daily_deal_flow logic

---

## API Integration Tests

### Google Sheets Integration:
- New entries should call `create-new-callback-sheet` function
- Updates should call `google-sheets-update` function
- Both should pass correct data structure

### Notification Integration:
- Submitted applications → Slack notification
- Not submitted applications → Center notification
- Disconnected calls → Disconnected call notification

---

## Performance Considerations

### Database Queries:
- Should use single query to check existing entry
- Should use efficient indexing on `submission_id` and `date` fields
- Should minimize number of database calls per update

### Error Handling:
- Should not fail entire process if notifications fail
- Should provide meaningful error messages
- Should log all operations for debugging
