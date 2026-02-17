# Name Search Workflow - Updated Implementation

## 🔄 How the Name Search Works

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User Enters Name                                        │
│ Input: "Anthony Curtiss Brooks"                                 │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Generate Name Variations                                │
│ - anthony curtiss brooks                                        │
│ - BROOKS, ANTHONY CURTISS                                       │
│ - BROOKS, ANTHONY                                               │
│ - anthony brooks                                                │
│ - ANTHONY CURTISS BROOKS                                        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Search Daily Outreach Report by Name                         │
│ Query: SELECT * FROM daily_deal_flow                            │
│        WHERE insured_name ILIKE '%variation%'                   │
│                                                                  │
│ Results: Multiple records for "Anthony Curtiss Brooks"          │
│   - Record 1: Phone (555) 123-4567                             │
│   - Record 2: Phone (555) 987-6543                             │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Display Results to User                                │
│ Show cards with:                                                │
│   - Name                                                        │
│   - Phone Number ← IMPORTANT FOR NEXT STEP                     │
│   - Policy Details                                              │
│   - "View Monday.com Policy Info" button                        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: User Clicks "View Monday.com Policy Info"              │
│ System extracts PHONE NUMBER from the clicked record            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Search Monday.com by PHONE (not name!)                 │
│ Call: get-monday-policy-info                                    │
│ Body: { phone: "(555) 123-4567" }                              │
│                                                                  │
│ WHY PHONE? Phone is more reliable than name in Monday.com      │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Display Monday.com Policy Info                         │
│ Show all policies associated with that phone number             │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Points

### ✅ What This Workflow Does

1. **User searches by NAME** → Finds records in Daily Outreach Report
2. **System uses PHONE from those records** → Queries Monday.com
3. **Result:** Accurate Monday.com policies linked to the correct client

### 🎯 Why This Approach?

**Phone Numbers are More Reliable:**
- ✅ Monday.com uses normalized phone format: `1XXXXXXXXXX`
- ✅ Phone numbers are unique identifiers
- ✅ No name format confusion (Julia Jordan vs JORDAN, JULIA)
- ✅ Faster Monday.com queries (indexed phone column)

**Name Search is for Daily Outreach Report Only:**
- ✅ Handles multiple name formats in Daily Outreach Report
- ✅ Fuzzy matching for typos and variations
- ✅ After finding records, phone takes over for Monday.com

---

## 💻 Code Implementation

### handleFetchPolicyInfo Function

```typescript
const handleFetchPolicyInfo = async (
  clientPhone: string | null, 
  clientName: string | null, 
  resultIdentifier: string
) => {
  if (policyInfo[resultIdentifier]) return;
  
  // ALWAYS prefer phone search for Monday.com
  // Even when user searched by name initially
  if (!clientPhone) {
    toast.error('Phone number not available for this record');
    return;
  }

  setPolicyInfoLoading(prev => ({ ...prev, [resultIdentifier]: true }));
  
  try {
    // Always search Monday.com by phone (more reliable)
    const response = await supabase.functions.invoke('get-monday-policy-info', {
      body: { phone: clientPhone }  // ← Using phone, NOT name!
    });
    
    const data = response.data;
    const error = response.error;

    if (error) throw error;

    setPolicyInfo(prev => ({ 
      ...prev, 
      [resultIdentifier]: data?.items || [] 
    }));
  } catch (error: any) {
    toast.error(`Failed to fetch policy info: ${error.message}`);
  } finally {
    setPolicyInfoLoading(prev => ({ 
      ...prev, 
      [resultIdentifier]: false 
    }));
  }
};
```

### Accordion Trigger (Passes Phone)

```typescript
<AccordionTrigger
  onClick={() => handleFetchPolicyInfo(
    result.client_phone_number,  // ← Phone from Daily Outreach Report
    result.insured_name,          // ← Name (not used for Monday.com)
    result.id
  )}
>
  View Monday.com Policy Info
</AccordionTrigger>
```

---

## 🔍 Real-World Example

### Scenario: Search for "Anthony Curtiss Brooks"

**Step 1: Name Search in Daily Outreach Report**
```sql
-- Finds records with name variations
SELECT * FROM daily_deal_flow 
WHERE insured_name ILIKE '%anthony curtiss brooks%'
   OR insured_name ILIKE '%BROOKS, ANTHONY CURTISS%'
   OR insured_name ILIKE '%anthony brooks%'
```

**Results:**
```
Record 1:
  - Name: Anthony Curtiss Brooks
  - Phone: (555) 123-4567
  - Carrier: GTL

Record 2:
  - Name: Anthony C Brooks
  - Phone: (555) 987-6543
  - Carrier: MOH
```

**Step 2: User Clicks "Monday.com Policy" on Record 1**

**Step 3: System Calls Monday.com with Phone**
```javascript
// NOT using name!
// Using phone from Record 1
invoke('get-monday-policy-info', { 
  phone: "(555) 123-4567" 
})
```

**Step 4: Monday.com Returns Policies**
```
Policies for 15551234567:
  - Policy 1: Deal Value $5000, Status: Active
  - Policy 2: Deal Value $10000, Status: Pending
```

---

## 🎨 User Experience Flow

```
1. User enters: "Anthony Curtiss Brooks"
   ↓
2. System shows: 2 records found
   ┌──────────────────────────────────┐
   │ Anthony Curtiss Brooks          │
   │ Phone: (555) 123-4567           │
   │ [View Monday.com Policy Info]   │ ← User clicks this
   └──────────────────────────────────┘
   ↓
3. System thinks: 
   "I have phone (555) 123-4567 from this record"
   "Let me search Monday.com using this phone"
   ↓
4. Monday.com query: { phone: "(555) 123-4567" }
   ↓
5. Results displayed:
   ┌──────────────────────────────────┐
   │ Monday.com Policy Info           │
   │                                  │
   │ Policy #: 123456                │
   │ Deal Value: $5000               │
   │ Status: Active                  │
   │ Sales Agent: John Doe           │
   └──────────────────────────────────┘
```

---

## ⚡ Benefits of This Approach

### 1. **Accuracy**
- Phone numbers are unique, names are not
- No confusion between "Julia Jordan" and "JORDAN, JULIA"
- Guaranteed correct Monday.com records

### 2. **Performance**
- Monday.com phone column is indexed
- Faster queries than name-based search
- Less data to process

### 3. **Reliability**
- Phone format is consistent in Monday.com (`1XXXXXXXXXX`)
- Name formats vary widely
- Reduces API errors and mismatches

### 4. **Simplicity**
- One Monday.com function (`get-monday-policy-info`)
- No need for complex name matching in Monday.com
- Easier to maintain and debug

---

## 🔧 Edge Functions Used

### Primary Function: `get-monday-policy-info`
```typescript
// Handles ALL Monday.com queries (phone-based)
POST /functions/v1/get-monday-policy-info
Body: { phone: "(555) 123-4567" }

Response: {
  items: [
    { id: "123", name: "BROOKS, ANTHONY", column_values: [...] }
  ]
}
```

### Secondary Function: `get-monday-policy-by-name`
```typescript
// NOT USED in current workflow
// Kept for potential future use
// Name search happens in Daily Outreach Report only
```

---

## 📊 Data Flow Summary

```
┌─────────────────┐
│  Name Search    │
│  Input Field    │
└────────┬────────┘
         ↓
    ┌────────────────┐
    │ Daily Deal     │
    │ Flow Search    │ ← Name-based fuzzy matching
    │ (by name)      │
    └────────┬───────┘
             ↓
    ┌────────────────┐
    │ Results with   │
    │ Phone Numbers  │ ← Extract phone from each result
    └────────┬───────┘
             ↓
    ┌────────────────┐
    │ Monday.com     │
    │ Search         │ ← Phone-based query
    │ (by phone!)    │
    └────────┬───────┘
             ↓
    ┌────────────────┐
    │ Policy Info    │
    │ Display        │
    └────────────────┘
```

---

## 🎯 Why Not Use Name for Monday.com?

### Problem with Name-Based Search:
```javascript
// Daily Outreach Report name: "Anthony Curtiss Brooks"
// Monday.com name: "BROOKS, ANTHONY"
// Would require complex matching and might miss records
```

### Solution with Phone-Based Search:
```javascript
// Daily Outreach Report: phone "(555) 123-4567"
// Monday.com: phone "15551234567"
// Always finds correct record with normalization
```

---

## ✅ Testing Checklist

- [x] Search by name in Daily Outreach Report works
- [x] Multiple name formats handled
- [x] Results show phone numbers
- [x] Click "Monday.com Policy" uses phone
- [x] Monday.com returns correct policies
- [x] No name-based Monday.com queries
- [x] Error handling for missing phone

---

## 🚀 Summary

**The Workflow:**
1. ✅ Name search finds records in Daily Outreach Report
2. ✅ Phone numbers extracted from those records
3. ✅ Monday.com queried using phone (not name)
4. ✅ Accurate policy information displayed

**The Result:**
- Fast, accurate, and reliable policy lookups
- No name format confusion
- Consistent Monday.com queries
- Better user experience

---

*Last Updated: October 2, 2025*
*Version: 2.1.0 (Phone-based Monday.com queries)*
