# Troubleshooting: "AKN" Shows Instead of "Akron Zips"

## Problem
You're seeing school codes (AKN, RAD, ALA) instead of full school names (Akron Zips, Radford University, Alabama Crimson Tide) in your emails.

**Example of the problem:**
```
❌ Discover exclusive AKN gear...
❌ Featured AKN Collection
```

**What it should say:**
```
✅ Discover exclusive Akron Zips gear...
✅ Featured Akron Zips Collection
```

---

## Root Cause
The code is looking up school names in the `college-db-email` DynamoDB table, but either:
1. The entry doesn't exist for that school_code
2. The entry exists but `school_name` is empty
3. The entry exists but `school_name` equals the code (e.g., "AKN")

---

## Step 1: Deploy Updated Lambda Functions

The latest code has enhanced logging to diagnose this issue.

**Deploy these files:**
- `lambda_functions/lambda_email_sender.py`
- `lambda_functions/lambda_campaign_manager.py`

---

## Step 2: Send a Test Email

1. Go to Campaign Editor
2. Click "Send Test" button
3. Wait for test email to be sent

---

## Step 3: Check CloudWatch Logs

### Finding the Logs:

1. Go to AWS Console → CloudWatch → Log groups
2. Find `/aws/lambda/lambda_email_sender` (or your function name)
3. Click on the most recent log stream
4. Search for: `Looking up school_code`

### What to Look For:

Search for lines like:
```
Looking up school_code='AKN' in college-db-email table
```

---

## Step 4: Identify the Scenario

### **SCENARIO A: Working Correctly** ✅
```
Looking up school_code='AKN' in college-db-email table
Found school entry: school_code='AKN', school_name='Akron Zips'
Personalizing for school_code=AKN, team_name=Akron Zips
```

**Result:** Email shows "Akron Zips" ✅
**Action:** No fix needed!

---

### **SCENARIO B: No Entry in Table** ❌
```
Looking up school_code='AKN' in college-db-email table
No entry found in college-db-email for school_code='AKN'
Personalizing for school_code=AKN, team_name=AKN
```

**Result:** Email shows "AKN" ❌
**Action:** Add entry to `college-db-email` table (see Step 5)

---

### **SCENARIO C: Entry Exists but school_name is Empty** ❌
```
Looking up school_code='AKN' in college-db-email table
Found school entry: school_code='AKN', school_name=''
School entry exists but school_name is empty or equals code
Personalizing for school_code=AKN, team_name=AKN
```

**Result:** Email shows "AKN" ❌
**Action:** Update `school_name` field in `college-db-email` table (see Step 6)

---

### **SCENARIO D: school_name Equals Code** ❌
```
Looking up school_code='AKN' in college-db-email table
Found school entry: school_code='AKN', school_name='AKN'
School entry exists but school_name is empty or equals code
Personalizing for school_code=AKN, team_name=AKN
```

**Result:** Email shows "AKN" ❌
**Action:** Update `school_name` field in `college-db-email` table (see Step 6)

---

## Step 5: Add Missing Entry to college-db-email Table

If you see **SCENARIO B** (no entry found):

### Using AWS Console:

1. Go to AWS Console → DynamoDB → Tables
2. Click `college-db-email`
3. Click "Explore table items"
4. Click "Create item"
5. Add these attributes:

```json
{
  "school_code": "AKN",
  "school_name": "Akron Zips",
  "school_logo": "https://your-bucket.s3.amazonaws.com/logos/akron.png",
  "school_page": "https://www.rrinconline.com/collections/akron"
}
```

### Using AWS CLI:

```bash
aws dynamodb put-item \
  --table-name college-db-email \
  --item '{
    "school_code": {"S": "AKN"},
    "school_name": {"S": "Akron Zips"},
    "school_logo": {"S": "https://your-bucket.s3.amazonaws.com/logos/akron.png"},
    "school_page": {"S": "https://www.rrinconline.com/collections/akron"}
  }'
```

---

## Step 6: Update Existing Entry

If you see **SCENARIO C or D** (entry exists but name is wrong):

### Using AWS Console:

1. Go to AWS Console → DynamoDB → Tables
2. Click `college-db-email`
3. Click "Explore table items"
4. Find the item with `school_code = AKN`
5. Click "Edit"
6. Update `school_name` to `Akron Zips`
7. Click "Save changes"

### Using AWS CLI:

```bash
aws dynamodb update-item \
  --table-name college-db-email \
  --key '{"school_code": {"S": "AKN"}}' \
  --update-expression "SET school_name = :name" \
  --expression-attribute-values '{":name": {"S": "Akron Zips"}}'
```

---

## Step 7: Test Again

1. Send another test email
2. Check that it now shows "Akron Zips" instead of "AKN"
3. Verify in preview as well

---

## Common School Codes to Add

Here are some common school codes you might need:

```json
// Akron
{"school_code": "AKN", "school_name": "Akron Zips"}

// Alabama
{"school_code": "ALA", "school_name": "Alabama Crimson Tide"}

// Radford
{"school_code": "RAD", "school_name": "Radford University"}

// Auburn
{"school_code": "AUB", "school_name": "Auburn Tigers"}

// Clemson
{"school_code": "CLE", "school_name": "Clemson Tigers"}

// Michigan
{"school_code": "MI", "school_name": "Michigan Wolverines"}

// Ohio State
{"school_code": "OSU", "school_name": "Ohio State Buckeyes"}
```

---

## Verification Checklist

After fixing the table, verify:

- [ ] CloudWatch logs show: `Found school entry: school_code='AKN', school_name='Akron Zips'`
- [ ] CloudWatch logs show: `Personalizing for school_code=AKN, team_name=Akron Zips`
- [ ] Test email greeting shows full name: "Discover exclusive Akron Zips gear..."
- [ ] Test email title shows full name: "Featured Akron Zips Collection"
- [ ] Preview in Campaign Editor shows full name
- [ ] No more mentions of "AKN" (only "Akron Zips")

---

## Quick Reference: DynamoDB Table Structure

**Table Name:** `college-db-email`

**Partition Key:** `school_code` (String)

**Required Attributes:**
- `school_code` (String) - The short code (e.g., "AKN")
- `school_name` (String) - Full team name (e.g., "Akron Zips")

**Optional Attributes:**
- `school_logo` (String) - URL to school logo image
- `school_page` (String) - URL to school's product page

---

## Still Not Working?

If you've followed all steps and still see codes instead of names:

1. **Check table name:** Make sure it's exactly `college-db-email` (case-sensitive)
2. **Check partition key:** Must be `school_code` (not `schoolCode` or `school_id`)
3. **Check permissions:** Lambda function needs read permissions on the table
4. **Check region:** Table must be in the same region as Lambda function
5. **Check logs again:** Look for error messages like "Error getting school name"

---

## Contact

If you need help, check the CloudWatch logs and share:
- The exact log lines showing the lookup
- A screenshot of the DynamoDB item
- The school_code you're testing with

This will help diagnose the issue quickly!
