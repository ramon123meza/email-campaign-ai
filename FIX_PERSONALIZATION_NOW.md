# Fix Personalization Issues - Action Plan

## Current Problems

1. ❌ **Emails show "AKN" instead of "Akron Zips"**
   - School code → name conversion not working
   - Missing data in college-db-email table

2. ❌ **Generic content not tailored to products**
   - Subject and description are generic
   - AI-generated content doesn't analyze actual products
   - Old templates created before personalization fixes

3. ❌ **Same content for all recipients**
   - Each school should have unique, tailored messaging

## Root Causes

### Problem 1: Missing School Names
The `college-db-email` DynamoDB table is empty or missing entries.

### Problem 2: Old Templates
Your templates were created BEFORE the personalization improvements. They have:
- Generic AI-generated descriptions
- No product-specific content
- Old personalization logic

### Problem 3: Not Using Latest Code
The latest code has:
- Per-recipient description personalization
- School name resolution
- Product-aware AI generation

## THE FIX (3 Steps)

### STEP 1: Deploy Latest Lambda Functions ✅

Deploy these updated files:
```bash
cd /home/user/email-campaign-ai/lambda_functions

# Deploy updated functions:
- lambda_email_sender.py           # School name lookup with logging
- lambda_campaign_manager.py       # Same for previews
- lambda_ai_template_editor.py     # AI generation improvements
```

### STEP 2: Populate School Names Database 📊

Run this script to add school names to DynamoDB:

```bash
cd /home/user/email-campaign-ai/scripts
python3 populate_school_names.py
```

**What it does:**
- Adds 80+ NCAA schools to `college-db-email` table
- Maps codes like "AKN" → "Akron Zips"
- Includes default school_page URLs
- Verifies the data was added correctly

**Output:**
```
✅ AKN        - Added: Akron Zips
✅ ALA        - Added: Alabama Crimson Tide
✅ RAD        - Added: Radford Highlanders
...
Summary:
  Added:   80
  Skipped: 0
  Failed:  0
```

### STEP 3: Regenerate Templates 🔄

Delete old generic templates and create new product-specific ones:

```bash
cd /home/user/email-campaign-ai/scripts

# For specific campaign:
python3 regenerate_templates.py YOUR_CAMPAIGN_ID

# For ALL campaigns:
python3 regenerate_templates.py
```

**What it does:**
- Deletes old template instances
- Calls Lambda to generate new templates
- AI analyzes actual campaign products
- Generates product-specific content

**IMPORTANT:** Update the Lambda URL in the script first!
```python
# In regenerate_templates.py line 18:
LAMBDA_URL = "https://YOUR-ACTUAL-URL.lambda-url.us-east-1.on.aws"
```

## STEP 4: Verify It's Working ✅

### A. Check CloudWatch Logs

Send a test email, then check logs for:

```
✅ GOOD - School name found:
Looking up school_code='AKN' in college-db-email table
Found school entry: school_code='AKN', school_name='Akron Zips'
Personalizing for school_code=AKN, team_name=Akron Zips

❌ BAD - School not found:
Looking up school_code='AKN' in college-db-email table
No entry found in college-db-email for school_code='AKN'
```

### B. Check Email Content

**Before Fix:**
```
Subject: New Collection Available!
Hi College Fans!
Discover exclusive gear for Akron Zips, ALS, BGU, or AKN supporters...
Featured AKN Collection
```

**After Fix:**
```
Subject: Hi Arturo, Akron Zips Collection Just Dropped!
Hi Arturo,
Discover exclusive Akron Zips gear designed for true fans!
Featured Akron Zips Collection
```

### C. Verification Checklist

- [ ] Deployed latest Lambda functions
- [ ] Ran populate_school_names.py successfully
- [ ] Regenerated templates (deleted old, created new)
- [ ] CloudWatch shows: "Found school entry... school_name='Akron Zips'"
- [ ] Test email shows full school name ("Akron Zips" not "AKN")
- [ ] Description is unique per school (not generic)
- [ ] Subject includes recipient name and school name
- [ ] Preview in Campaign Editor shows personalized content
- [ ] Each recipient gets content for THEIR school only

## Why This Happens

### How Templates Work:

1. **Template Creation (ONE TIME)**
   - AI analyzes campaign products
   - Generates base content (title, description, etc.)
   - Stores in template_config

2. **Email Sending (PER RECIPIENT)**
   - Starts with template_config
   - Personalizes per recipient:
     * Greeting → "Hi {name},"
     * Description → "Discover {school} gear..."
     * Products Title → "Featured {school} Collection"

### The Problem with Old Templates:

Old templates (created before fixes):
- Have generic AI descriptions in template_config
- These get applied to ALL recipients
- No per-recipient personalization

New templates (after regeneration):
- AI-generated base content (better quality)
- Per-recipient personalization
- School name resolution

## Alternative: Manual Fix (If Scripts Don't Work)

### Manually Add School Names to DynamoDB:

1. Go to AWS Console → DynamoDB → `college-db-email`
2. Click "Create item"
3. Add:
   ```json
   {
     "school_code": "AKN",
     "school_name": "Akron Zips",
     "school_page": "https://www.rrinconline.com/collections/akron",
     "school_logo": ""
   }
   ```
4. Repeat for each school

### Manually Regenerate Template:

1. Go to AWS Console → DynamoDB → `campaign_template_instances`
2. Find your campaign's template
3. Click "Delete item"
4. In Campaign Editor, reload the page
5. System will auto-create new template with product analysis

## Common Issues

### "Script says no campaigns found"
- Check AWS region matches your DynamoDB tables
- Verify `email_campaigns` table has data
- Check AWS credentials

### "Still seeing AKN instead of Akron Zips"
- Check CloudWatch logs for actual lookup results
- Verify `college-db-email` has the entry
- Make sure partition key is `school_code` (not `schoolCode`)

### "Template regeneration fails"
- Update Lambda URL in script
- Check Lambda function is deployed
- Verify campaign has product data

### "AI content still generic"
- Regenerate template (delete old one first)
- Check campaign has products in campaign_data table
- Verify products have school_code field

## Files Modified (for reference)

```
lambda_functions/
├── lambda_email_sender.py          # Per-recipient personalization
├── lambda_campaign_manager.py      # Preview personalization
└── lambda_ai_template_editor.py    # AI template generation

scripts/
├── populate_school_names.py        # Add school names to DB
└── regenerate_templates.py         # Recreate templates
```

## Quick Command Summary

```bash
# 1. Deploy Lambdas (manual via AWS Console)

# 2. Populate school names
cd /home/user/email-campaign-ai/scripts
python3 populate_school_names.py

# 3. Regenerate templates
python3 regenerate_templates.py

# 4. Test
# Send test email from Campaign Editor
# Check it shows full school names
```

## Need Help?

Check CloudWatch Logs and look for:
1. "Looking up school_code='AKN'" - Shows if lookup is happening
2. "Found school entry" or "No entry found" - Shows if data exists
3. "Personalizing for school_code=X, team_name=Y" - Shows what name was found
4. "AI generation failed" - Shows if template generation had issues

Share these logs if you need further help debugging!

---

**TL;DR:**
1. Run `populate_school_names.py` to add school data
2. Run `regenerate_templates.py` to recreate templates
3. Send test email - should show "Akron Zips" not "AKN"
4. Check CloudWatch logs to verify lookup is working
