# Callback Request Feature - BPO-Client Connection

## Overview
Implemented a comprehensive callback request system that allows BPO centers to request callbacks from agents for their leads with three specific request types.

## Feature Components

### 1. Database Schema
**Table**: `callback_requests`

**Columns**:
- `id` (UUID) - Primary key
- `submission_id` (TEXT) - Lead submission ID
- `lead_vendor` (TEXT) - BPO center name
- `request_type` (TEXT) - Type of callback request (constrained)
- `notes` (TEXT) - Detailed notes about the request
- `customer_name` (TEXT) - Client name
- `phone_number` (TEXT) - Client phone
- `status` (TEXT) - Request status (pending, in_progress, completed, cancelled)
- `requested_by` (UUID) - User who created the request
- `requested_at` (TIMESTAMPTZ) - When request was created
- `completed_at` (TIMESTAMPTZ) - When request was completed
- `completed_by` (UUID) - Agent who completed it
- Timestamps: `created_at`, `updated_at`

**Request Types**:
1. `new_application` - New Application
2. `updating_billing` - Updating Billing/Draft Date
3. `carrier_requirements` - Fulfilling Pending Carrier Requirements

**Indexes**:
- submission_id (for lead lookup)
- lead_vendor (for BPO filtering)
- status (for pending/completed filtering)
- requested_at DESC (for chronological listing)

**RLS Policies**:
- Center users can INSERT their own requests
- Center users can SELECT their own requests
- Closers can SELECT all requests
- Closers can UPDATE all requests

### 2. Frontend Components

#### CallbackRequestForm Component
**Location**: `src/components/CallbackRequestForm.tsx`

**Features**:
- Two-panel layout using Dialog
- **Left Panel**: Complete lead information display
  - Submission ID
  - Customer Name
  - Phone Number
  - State
  - Carrier
  - Coverage Amount
  - Monthly Premium
  - Date
  - Submission Date
  - Lead Vendor
  
- **Right Panel**: Callback request form
  - Request Type dropdown (3 options)
  - Notes textarea (required)
  - Submit/Cancel buttons
  - Loading state with spinner

**Props**:
```typescript
interface CallbackRequestFormProps {
  lead: Lead;
  leadVendor: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}
```

**Validation**:
- Request type must be selected
- Notes cannot be empty
- All fields are required before submission

#### CenterLeadPortal Updates
**Location**: `src/pages/CenterLeadPortal.tsx`

**New Features**:
- "Send Callback" button on each lead card
- Opens CallbackRequestForm dialog
- Refreshes leads after successful submission
- Uses Send icon from lucide-react

**Button Styling**:
- Blue primary button (`bg-blue-600 hover:bg-blue-700`)
- Positioned in bottom-right of lead card
- Send icon with label

### 3. Integration Flow

```
1. BPO User clicks "Send Callback" on a lead
   ↓
2. CallbackRequestForm opens with lead details
   ↓
3. User selects request type and adds notes
   ↓
4. On submit:
   - Saves to callback_requests table
   - Sends Slack notification
   - Closes dialog
   - Refreshes lead list
   ↓
5. Slack notification sent to public channel
```

### 4. Slack Notification

**Function**: `send-slack-notification`

**Payload Structure**:
```typescript
{
  type: 'callback_request',
  data: {
    submission_id: string,
    customer_name: string,
    phone_number: string,
    lead_vendor: string,
    request_type: string, // Human-readable label
    notes: string,
    carrier: string,
    coverage_amount: number,
    monthly_premium: number,
    state: string,
    requested_at: ISO timestamp
  }
}
```

**Slack Message Content**:
- Shows request type prominently
- Includes all lead details
- Shows notes from BPO
- Timestamp of request
- Can be configured to post to specific channel

### 5. Request Types Explained

#### 1. New Application
**Use Case**: BPO needs agent to process a brand new insurance application
- Client is ready to apply
- All information has been gathered
- Needs agent to take over and submit

#### 2. Updating Billing/Draft Date
**Use Case**: Existing application needs billing information or draft date updated
- Client changed banking information
- Draft date needs to be rescheduled
- Payment method needs updating

#### 3. Fulfilling Pending Carrier Requirements
**Use Case**: Carrier requested additional information or documentation
- Medical exams needed
- Additional forms required
- Carrier-specific requirements to complete

## File Changes

### New Files
1. `src/components/CallbackRequestForm.tsx` - Callback request dialog component
2. `supabase/migrations/20250106000000_create_callback_requests.sql` - Database schema
3. `CALLBACK_REQUEST_FEATURE.md` - This documentation

### Modified Files
1. `src/pages/CenterLeadPortal.tsx`
   - Added Send icon import
   - Added CallbackRequestForm import
   - Added selectedLead state
   - Added showCallbackForm state
   - Added handleSendCallback function
   - Added handleCloseCallbackForm function
   - Added handleCallbackSuccess function
   - Added "Send Callback" button to lead cards
   - Added CallbackRequestForm dialog at bottom

## Usage Instructions

### For BPO Centers

1. **Navigate to Center Lead Portal**
   - Login with center credentials
   - View your leads list

2. **Initiate Callback Request**
   - Find the lead you want to request callback for
   - Click "Send Callback" button (blue button at bottom-right)

3. **Fill Out Request Form**
   - Review lead information on left panel
   - Select appropriate request type from dropdown:
     - New Application
     - Updating Billing/Draft Date
     - Fulfilling Pending Carrier Requirements
   - Add detailed notes explaining what's needed
   - Click "Submit Request"

4. **Confirmation**
   - Success toast appears
   - Dialog closes automatically
   - Slack notification sent to agents
   - Request saved in database

### For Closers

1. **Receive Notifications**
   - Slack notification in public channel
   - Shows all lead and request details

2. **View Requests** (Future Enhancement)
   - Dashboard to view all pending callback requests
   - Filter by request type, lead vendor, date
   - Update status as working on it
   - Mark as completed when done

3. **Process Request**
   - Review request details from Slack
   - Contact customer based on request type
   - Complete required actions
   - Update request status in system

## Future Enhancements

### Agent Dashboard for Callbacks
- View all pending callback requests
- Filter and sort capabilities
- Claim/assign requests to agents
- Update status (in_progress, completed)
- Add completion notes

### Reporting & Analytics
- Callback request metrics
- Average response time
- Completion rates by request type
- BPO performance tracking

### Notifications
- Email notifications option
- SMS alerts for urgent requests
- In-app notifications

### Advanced Features
- Priority levels for requests
- SLA tracking (time to respond/complete)
- Automated follow-ups
- Request templates for common scenarios

## Testing Checklist

- [x] Database table created successfully
- [x] RLS policies working correctly
- [x] TypeScript types generated
- [x] Build completes without errors
- [ ] BPO user can create callback request
- [ ] Form validation works (required fields)
- [ ] Slack notification sends correctly
- [ ] Request appears in database
- [ ] Lead list refreshes after submission
- [ ] Dialog opens and closes properly
- [ ] All lead information displays correctly

## Technical Notes

### Dependencies
- Supabase client for database operations
- Dialog component from shadcn/ui
- Slack webhook integration (existing)
- date-fns for date formatting

### Error Handling
- Try-catch blocks for database operations
- Toast notifications for user feedback
- Console logging for debugging
- Graceful degradation if Slack fails (doesn't block submit)

### Security
- RLS policies restrict data access
- Center users can only see their own requests
- Closers can view/update all requests
- Authenticated users only

## Database Migration

The migration was applied successfully to Supabase:
```sql
-- Migration: 20250106000000_create_callback_requests
-- Status: Applied ✓
```

## Build Status
✅ Build completed successfully
✅ No TypeScript errors
✅ All components compile correctly
