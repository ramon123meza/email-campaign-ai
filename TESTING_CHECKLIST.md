# Email Campaign AI - Comprehensive Testing Checklist

## 🎯 Complete End-to-End Testing Guide

Use this checklist to thoroughly test the email campaign system before production use.

---

## 📊 Pre-Testing Setup

### Required Test Data:

- [ ] **Shopify Product Export CSV** (at least 50 products)
- [ ] **Test Email Addresses** (at least 3 different addresses you control)
- [ ] **AWS SES Verified** (sender and test recipient emails)
- [ ] **OpenAI API Key** configured in Lambda environment variables
- [ ] **DynamoDB Tables** exist and accessible

### Test User Setup:

```
Navigate to: Test Users page
Add test users:
  - Name: John Doe, Email: your+test1@email.com, School: HOUS
  - Name: Jane Smith, Email: your+test2@email.com, School: UCLA
  - Name: Bob Johnson, Email: your+test3@email.com, School: MICH
```

---

## 🧪 Testing Workflow

### **Phase 1: Campaign Creation**

#### Test Case 1.1: Create New Campaign
- [ ] Navigate to Dashboard
- [ ] Click "Create Campaign" button
- [ ] Enter campaign name: "Test Campaign - License Plates"
- [ ] Click "Create"
- [ ] **Expected:** Campaign appears in list with "draft" status
- [ ] **Expected:** Success notification appears
- [ ] **Expected:** Campaign ID is generated

#### Test Case 1.2: Upload Product File
- [ ] Click Eye icon on test campaign
- [ ] Look for file upload section
- [ ] Upload Shopify CSV file (should be in proper format)
- [ ] **Expected:** File uploads successfully
- [ ] **Expected:** "Processing..." status appears
- [ ] **Expected:** After processing:
  - Total emails count updates
  - Batch count shows (e.g., "5 batches" for 8,527 emails)
  - Status changes to "ready"

**⏱️ Expected Time:** 30-60 seconds for 8,000+ records

---

### **Phase 2: AI Template Generation**

#### Test Case 2.1: Automatic Template Creation
- [ ] After file processing completes
- [ ] Click Sparkles icon (AI Template Editor)
- [ ] **Expected:** Editor opens with template
- [ ] **Expected:** Template shows AI-generated content:
  - Title references actual products (e.g., "License Plates")
  - Description mentions schools in campaign
  - CTA text is action-oriented
  - Products section has relevant heading

#### Test Case 2.2: Verify AI-Generated Metadata
**Check these elements are NOT generic defaults:**
- [ ] Campaign Title (subject line)
- [ ] Main Title (headline)
- [ ] Description Text
- [ ] CTA Button Text
- [ ] Products Section Title

**Example of Good AI Output:**
```
✅ "Show Your School Spirit with Custom License Plates!"
✅ "Personalize Your Ride, Rep Your Team"
❌ "New Collection Available!" (generic default)
```

---

### **Phase 3: Template Editing**

#### Test Case 3.1: AI Chat Editing
- [ ] In AI Template Editor, open AI Chat (if not already visible)
- [ ] Test simple request: "Make the title blue"
- [ ] **Expected:** Title color changes to blue
- [ ] **Expected:** Chat shows confirmation message
- [ ] **Expected:** Template updates in preview

#### Test Case 3.2: Complex AI Edit
- [ ] Send message: "Change the main title to 'Rep Your Team in Style' and make the button green"
- [ ] **Expected:** Both changes apply correctly
- [ ] **Expected:** Button becomes green
- [ ] **Expected:** Title text updates
- [ ] **Expected:** Preview refreshes automatically

#### Test Case 3.3: Save Template
- [ ] Click "Save" button in header
- [ ] **Expected:** "Campaign saved successfully!" message
- [ ] **Expected:** Green checkmark or success indicator
- [ ] Navigate away and back
- [ ] **Expected:** Changes persist

---

### **Phase 4: Test Email Functionality**

#### Test Case 4.1: Send Test from Campaign Detail
- [ ] Navigate to campaign (Eye icon)
- [ ] Click "Send Test" button in header
- [ ] **Expected:** Button shows "Sending..."
- [ ] **Expected:** After 5-10 seconds, shows "Test emails sent successfully!"
- [ ] **Expected:** Status returns to "Send Test" after 3 seconds

#### Test Case 4.2: Verify Test Emails Received
- [ ] Check all 3 test email inboxes
- [ ] **Expected:** All 3 test users receive email
- [ ] **Expected:** Emails arrive within 2 minutes

#### Test Case 4.3: Validate Test Email Content
**For each test email received:**
- [ ] Subject line shows AI-generated title
- [ ] Greeting shows correct recipient name ("Hi John,")
- [ ] Products section shows school-specific items
- [ ] Product images load correctly
- [ ] Product names display (not truncated badly)
- [ ] Product prices show with $ symbol
- [ ] "Shop Now" buttons work (lead to products)
- [ ] School logo appears (if available)
- [ ] "Shop Collection" button leads to school page
- [ ] Footer shows company information
- [ ] Unsubscribe link is present

#### Test Case 4.4: Send Test from AI Editor
- [ ] Open AI Template Editor (Sparkles icon)
- [ ] Click "Send Test" button in header
- [ ] **Expected:** Same behavior as 4.1-4.3
- [ ] Verify emails reflect any template edits made

---

### **Phase 5: Batch Management**

#### Test Case 5.1: View Campaign Batches
- [ ] Navigate to campaign (Eye icon)
- [ ] Scroll to "Email Batches" section
- [ ] **Expected:** Shows all batches (e.g., "5 batches")
- [ ] **Expected:** Each batch shows:
  - Batch number
  - Status badge (Ready to Send)
  - Size (2,000 emails or less for last batch)
  - Estimated duration (minutes)

#### Test Case 5.2: Expand Batch to See Recipients
- [ ] Click on Batch 1 header (or chevron icon)
- [ ] **Expected:** Batch expands
- [ ] **Expected:** Loading spinner appears briefly
- [ ] **Expected:** Recipients list loads (up to 2,000)
- [ ] **Expected:** Each recipient shows:
  - Customer name
  - Customer email
  - School code
  - Product count
  - "Preview" button

**⏱️ Expected Time:** 1-3 seconds to load 2,000 recipients

#### Test Case 5.3: Preview Individual Recipient Email
- [ ] Click "Preview" button on any recipient
- [ ] **Expected:** Modal opens with email preview
- [ ] **Expected:** Modal header shows recipient name and email
- [ ] **Expected:** Email renders in iframe
- [ ] **Expected:** Email is fully personalized:
  - Correct name in greeting
  - Their specific products (1-4 items)
  - Correct school code
  - School-specific links

#### Test Case 5.4: Preview Multiple Recipients
- [ ] Preview 3 different recipients from same batch
- [ ] **Expected:** Each shows different personalization
- [ ] **Expected:** Product grids differ based on recipient
- [ ] **Expected:** School codes may differ
- [ ] Close modal with X button
- [ ] **Expected:** Modal closes cleanly

---

### **Phase 6: UI/UX Verification**

#### Test Case 6.1: Sidebar Color Scheme
- [ ] Check sidebar hover states
- [ ] **Expected:** Hover shows blue (NOT pink/purple)
- [ ] **Expected:** Active item has blue-cyan gradient
- [ ] **Expected:** AI badge at bottom has blue theme

#### Test Case 6.2: Campaign Detail Page
- [ ] Verify Eye icon (campaign detail) NO LONGER shows:
  - ❌ Generic template preview at top
  - ❌ Confusing inline template editor
- [ ] Verify Eye icon DOES show:
  - ✅ Campaign overview stats
  - ✅ Batch management section
  - ✅ "Send Test" button in header
  - ✅ "AI Template Editor" button (if draft/ready)

#### Test Case 6.3: Responsive Batch UI
- [ ] Expand multiple batches
- [ ] **Expected:** Only clicked batch expands
- [ ] **Expected:** Smooth expand/collapse animation
- [ ] **Expected:** Chevron icon rotates (right → down)
- [ ] Collapse all batches
- [ ] **Expected:** Recipients are unloaded (memory efficient)

---

### **Phase 7: Email Sending (Production Test)**

⚠️ **WARNING:** This sends real emails. Only test with small batch or test data!

#### Test Case 7.1: Send Small Test Batch
**Setup:**
- [ ] Create a campaign with ONLY 5-10 recipients (test data)
- [ ] Process file and create template
- [ ] Send test emails first

**Execution:**
- [ ] Click "Send Batch" on Batch 1
- [ ] **Expected:** Confirmation dialog appears
- [ ] Click "Confirm"
- [ ] **Expected:** Button shows "Starting..."
- [ ] **Expected:** Status changes to "Sending"
- [ ] **Expected:** Progress bar appears
- [ ] **Expected:** Progress updates in real-time (refresh every 5 seconds)

#### Test Case 7.2: Monitor Batch Progress
- [ ] Keep campaign detail page open
- [ ] **Expected:** Batch status automatically updates
- [ ] **Expected:** "Emails sent" count increases
- [ ] **Expected:** Progress percentage increases
- [ ] **Expected:** After all sent:
  - Status changes to "Completed"
  - Progress bar shows 100%
  - Completed timestamp appears

**⏱️ Expected Time:** ~1 minute per 14 emails (SES rate limit)

#### Test Case 7.3: Verify Production Emails
- [ ] Check recipient inboxes
- [ ] **Expected:** All emails arrive within 5 minutes
- [ ] **Expected:** Each email is correctly personalized
- [ ] **Expected:** No duplicate sends
- [ ] **Expected:** SES metrics show successful deliveries

---

### **Phase 8: Error Handling**

#### Test Case 8.1: Invalid File Upload
- [ ] Try uploading wrong file format (e.g., .txt)
- [ ] **Expected:** Error message: "File must be CSV"
- [ ] Try uploading empty CSV
- [ ] **Expected:** Error or warning message

#### Test Case 8.2: Network Error Recovery
- [ ] Disconnect internet
- [ ] Try any action (e.g., send test)
- [ ] **Expected:** Error message about network
- [ ] Reconnect internet
- [ ] Retry action
- [ ] **Expected:** Works normally

#### Test Case 8.3: Campaign Without Products
- [ ] Create campaign but don't upload file
- [ ] Try opening AI Template Editor
- [ ] **Expected:** Template uses default content (not AI-generated)
- [ ] **Expected:** No crash or error

---

## 🎨 Visual Consistency Checks

### Colors:
- [ ] Sidebar: Blue/cyan theme (no pink)
- [ ] Buttons: Blue (primary), Green (success), Gray (secondary)
- [ ] Status badges: Blue (ready), Yellow (sending), Green (completed), Red (failed)

### Typography:
- [ ] Headers are bold and readable
- [ ] Body text is 16px minimum
- [ ] Email preview text matches final emails

### Layout:
- [ ] No horizontal scrollbars (except email preview)
- [ ] Batch recipients list has vertical scroll (max-height)
- [ ] Modal overlays page correctly
- [ ] Mobile responsive (test on phone/tablet if possible)

---

## 🚨 Critical Issues to Watch For

### **MUST NOT HAPPEN:**
- ❌ Sending duplicate emails to same recipient
- ❌ Wrong products showing for recipient
- ❌ Broken product images in emails
- ❌ Incorrect school assignments
- ❌ Test emails sent to production list
- ❌ Campaign sending when status is "draft"
- ❌ Batch sending twice (duplicate sends)

### **SHOULD NOT HAPPEN (but recoverable):**
- ⚠️ AI template generation fails (falls back to defaults)
- ⚠️ Preview modal doesn't open (refresh page)
- ⚠️ Batch recipients don't load (retry expand)
- ⚠️ Template save fails (retry save)

---

## 📊 Performance Benchmarks

### Expected Performance:
- **File Upload & Processing:** <60 seconds for 8,000 records
- **Template Generation:** <10 seconds with AI
- **Batch Recipient Load:** <3 seconds for 2,000 recipients
- **Email Preview:** <2 seconds per recipient
- **Test Email Send:** <15 seconds for 3 emails
- **Batch Send:** ~1 minute per 14 emails

### If Performance is Slower:
- Check Lambda memory allocation (increase if needed)
- Verify DynamoDB has proper indexes
- Check CloudWatch logs for bottlenecks
- Consider increasing Lambda timeout for file processing

---

## ✅ Final Sign-Off Checklist

Before going live, confirm:

### Functionality:
- [ ] All test cases passed
- [ ] No critical issues found
- [ ] AI template generation works
- [ ] Batch preview works
- [ ] Individual email preview works
- [ ] Test emails send correctly
- [ ] Production emails send correctly
- [ ] Personalization is accurate

### Data Integrity:
- [ ] Products mapped to correct schools
- [ ] No duplicate recipients in batches
- [ ] Customer names and emails correct
- [ ] Product URLs are valid
- [ ] School pages are correct

### Performance:
- [ ] File processing completes in reasonable time
- [ ] No Lambda timeouts
- [ ] Email sending rate stays at 14/second
- [ ] Frontend responds quickly
- [ ] No memory leaks on long sessions

### Security:
- [ ] API keys not exposed in frontend
- [ ] Only verified senders can send emails
- [ ] CORS configured correctly
- [ ] Unsubscribe links work
- [ ] No sensitive data in logs

---

## 🎉 Testing Complete!

If all tests pass, your email campaign system is ready for production use!

### What to Do Next:
1. **Train Your Team:** Show them this checklist
2. **Create SOPs:** Document your campaign creation process
3. **Monitor Metrics:** Watch SES delivery rates for first few campaigns
4. **Gather Feedback:** Ask recipients if emails look good
5. **Iterate:** Use learnings to improve templates

---

## 📞 Troubleshooting Resources

**CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/lambda_campaign_manager --follow
aws logs tail /aws/lambda/lambda_ai_template_editor --follow
aws logs tail /aws/lambda/lambda_email_sender --follow
```

**DynamoDB Queries:**
- Check campaign_data for specific recipient
- Verify template_instance was created
- Check batch status in campaign_batches

**Browser Console:**
- Open DevTools (F12)
- Check Network tab for API errors
- Check Console for JavaScript errors

---

## 🏆 Success Criteria

Your system is working perfectly if:
✅ 95%+ of emails send successfully
✅ 98%+ of emails are personalized correctly
✅ 0% duplicate sends
✅ <1% bounces/complaints
✅ Users can complete workflows without support
✅ AI generates relevant template content
✅ Preview shows exactly what recipients receive

**Happy Campaigning! 🚀**
