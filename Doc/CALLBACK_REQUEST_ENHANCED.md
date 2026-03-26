# Callback Request Feature - Enhanced (Full Page View)

## Overview
Enhanced the callback request feature to display on a dedicated page with complete lead details instead of a popup dialog. Added a new edge function that sends rich Slack notifications with clickable buttons for agents to update call results directly.

## What Changed

### 1. New Callback Request Page
**File**: `src/pages/CallbackRequestPage.tsx`

**Features**:
- **Full-page layout** instead of modal dialog
- **Three-column responsive design**:
  - Left side (2/3 width): Complete lead information in organized cards
  - Right side (1/3 width): Sticky callback request form
- **Comprehensive lead details displayed**:
  - Customer Information: Name, Phone, State, Submission ID
  - Policy Information: Carrier, Coverage Amount, Monthly Premium, Lead Vendor
  - Timeline: Date, Submission Date (with time)
- **Enhanced UX**:
  - Back button to return to lead portal
  - Breadcrumb-style navigation
  - Professional card-based layout with icons
  - Sticky form that stays visible while scrolling
  - Loading states and proper error handling

**URL**: `/center-callback-request?submissionId=SUBMISSION_ID`

### 2. Updated Routing
**File**: `src/App.tsx`

Added new protected route for center users:
```typescript
<Route 
  path="/center-callback-request" 
  element={
    <CenterProtectedRoute>
      <CallbackRequestPage />
    </CenterProtectedRoute>
  } 
/>
```

### 3. CenterLeadPortal Updates
**File**: `src/pages/CenterLeadPortal.tsx`

**Changes**:
- Removed dialog-based callback form
- Removed CallbackRequestForm import
- Removed state management for dialog (selectedLead, showCallbackForm)
- Updated "Send Callback" button to navigate to new page
- Cleaner, simpler component with navigation-based flow

**New Flow**:
```typescript
const handleSendCallback = (lead: Lead) => {
  navigate(`/center-callback-request?submissionId=${lead.submission_id}`);
};
```

### 4. New Edge Function for Slack Notifications
**File**: `supabase/functions/callback-notification/index.ts`

**Purpose**: Send rich, formatted Slack notifications to BPO center channels when callback requests are created.

**Features**:
- **Rich Slack Message Blocks** with professional formatting:
  - Header with emoji (📞 Callback Request)
  - Structured fields layout showing all key information
  - Request type, customer details, carrier, state
  - Full notes section
  - Clickable action button
  - Context footer with submission ID

- **Clickable Button** that links to:
  ```
  https://agents-portal-uai.vercel.app/call-result-update?submissionId={SUBMISSION_ID}
  ```
  This allows agents to click directly from Slack to update the call result

- **Channel Routing**: Uses same lead vendor → channel mapping as center-transfer-notification
- **Error Handling**: Comprehensive logging and graceful error handling

**Slack Message Structure**:
```javascript
{
  blocks: [
    { type: 'header', text: '📞 Callback Request' },
    { 
      type: 'section', 
      fields: [
        'Request Type', 'Call Center',
        'Customer Name', 'Phone Number',
        'Carrier', 'State'
      ]
    },
    { type: 'section', text: 'Notes: ...' },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [{
        type: 'button',
        text: '📋 Update Call Result',
        url: 'https://...',
        style: 'primary'
      }]
    },
    { type: 'context', elements: ['Submission ID: ...'] }
  ]
}
```

## User Flow

### BPO Center User Experience
1. Login to Center Lead Portal
2. Browse leads list
3. Click "Send Callback" button on a lead
4. **Redirected to new page** showing:
   - Complete lead details (left side)
   - Callback request form (right side)
5. Select request type from dropdown
6. Add detailed notes
7. Submit request
8. **Redirected back** to lead portal
9. Success notification shown

### Agent Experience
1. Receive **rich Slack notification** in center channel
2. See all relevant information at a glance:
   - Request type and customer details
   - Phone number, carrier, state
   - Notes from BPO center
3. Click **"📋 Update Call Result"** button
4. Taken directly to Call Result Update page with submission ID pre-filled
5. Update call result as needed

## Benefits Over Previous Implementation

### UX Improvements
✅ **Better Mobile Experience**: Full page layout works better on mobile than modal
✅ **More Information**: Can show complete lead details without cramping
✅ **Cleaner Navigation**: Browser back button works naturally
✅ **Bookmarkable**: Direct URL for callback requests
✅ **Better Focus**: Dedicated page reduces cognitive load

### Technical Improvements
✅ **Simpler State Management**: No dialog state to manage
✅ **Better Accessibility**: Full page navigation is more accessible
✅ **Easier Testing**: Can navigate directly to page for testing
✅ **Better SEO**: Proper page routing vs hidden modal

### Slack Integration Improvements
✅ **Professional Formatting**: Rich blocks with proper layout
✅ **Action Button**: Direct link to update call result
✅ **Better Readability**: Structured fields vs plain text
✅ **Consistent Branding**: Emoji and styling match other notifications

## Technical Details

### Request Type Options
1. **New Application** (`new_application`)
2. **Updating Billing/Draft Date** (`updating_billing`)
3. **Fulfilling Pending Carrier Requirements** (`carrier_requirements`)

### Database Schema
Table: `callback_requests`
- Stores all callback request data
- Status tracking (pending, in_progress, completed)
- Audit trail with timestamps
- RLS policies for security

### Security
- **Protected Route**: Only center users can access callback request page
- **Vendor Filtering**: Users only see leads from their own vendor
- **RLS Policies**: Database-level security on callback_requests table
- **Auth Required**: Must be authenticated to submit requests

### API Endpoints
1. **Database**: Standard Supabase client operations
2. **Edge Function**: `callback-notification` for Slack integration
   - Method: POST
   - Invoked after successful database insert
   - Sends notification to appropriate channel

## Files Modified/Created

### Created
- `src/pages/CallbackRequestPage.tsx` - New full-page callback request form
- `supabase/functions/callback-notification/index.ts` - New edge function for Slack

### Modified
- `src/App.tsx` - Added new route for callback request page
- `src/pages/CenterLeadPortal.tsx` - Changed to navigation-based flow, removed dialog

### Unchanged
- `src/components/CallbackRequestForm.tsx` - Still exists but no longer used (can be removed later)
- Database schema - No changes needed
- TypeScript types - Already generated with callback_requests table

## Testing Checklist

### Frontend Testing
- [ ] Navigate to callback request page from lead portal
- [ ] All lead details display correctly
- [ ] Form validation works (required fields)
- [ ] Submit button shows loading state
- [ ] Success toast appears after submission
- [ ] Redirects back to lead portal after success
- [ ] Back button works correctly
- [ ] Page loads with invalid submission ID (should redirect)
- [ ] Page loads with submission ID from different vendor (should redirect/error)
- [ ] Responsive design works on mobile/tablet
- [ ] Sticky form stays visible while scrolling lead details

### Backend Testing
- [ ] Callback request saves to database correctly
- [ ] All fields populated properly
- [ ] Status defaults to 'pending'
- [ ] Timestamps set correctly
- [ ] RLS policies prevent unauthorized access

### Slack Integration Testing
- [ ] Notification sends to correct channel based on lead vendor
- [ ] All lead details appear in Slack message
- [ ] Request type displays correctly
- [ ] Notes field shows full text
- [ ] Button is clickable
- [ ] Button URL is correct and includes submission ID
- [ ] Button opens call result update page
- [ ] Submission ID pre-populated in call result page
- [ ] Message formatting looks professional
- [ ] Error handling works if Slack fails (doesn't block submission)

## Future Enhancements

### Agent Dashboard
- View all pending callback requests
- Filter by request type, lead vendor, date
- Claim requests
- Update status (in_progress, completed)
- Add completion notes

### Advanced Features
- Priority levels for urgent requests
- SLA tracking (time to respond)
- Automated follow-ups if not completed
- Analytics dashboard for callback metrics
- Email notifications as backup to Slack
- SMS alerts for urgent requests

### UI Enhancements
- Real-time status updates
- Request history timeline
- Agent assignment
- Estimated response time

## Deployment Notes

### Edge Function Deployment
The new `callback-notification` edge function must be deployed to Supabase:

```bash
# Deploy edge function
supabase functions deploy callback-notification

# Verify deployment
supabase functions list
```

### Environment Variables
Ensure `SLACK_BOT_TOKEN` is configured in Supabase Edge Functions secrets:
```bash
supabase secrets set SLACK_BOT_TOKEN=xoxb-your-token-here
```

### Build and Deploy
```bash
# Build frontend
npm run build

# Deploy to Vercel (automatic if connected to repo)
# Or manual deployment:
vercel --prod
```

## URL Structure

### Development
- Callback Request Page: `http://localhost:8080/center-callback-request?submissionId=SUBMISSION_ID`
- Call Result Update: `http://localhost:8080/call-result-update?submissionId=SUBMISSION_ID`

### Production
- Callback Request Page: `https://agents-portal-uai.vercel.app/center-callback-request?submissionId=SUBMISSION_ID`
- Call Result Update: `https://agents-portal-uai.vercel.app/call-result-update?submissionId=SUBMISSION_ID` (used in Slack button)

## Support

For issues or questions:
1. Check browser console for errors
2. Check Supabase logs for edge function errors
3. Check Slack API response in edge function logs
4. Verify RLS policies if database access issues
5. Verify user authentication and permissions

## Summary

This enhanced implementation provides a better user experience with a dedicated page for callback requests and professional Slack notifications with actionable buttons. The full-page layout allows for displaying complete lead details while maintaining a clean, focused request form. The rich Slack notifications enable agents to quickly understand the request and take immediate action with a single click.
