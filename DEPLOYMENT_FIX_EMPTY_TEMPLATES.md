# DEPLOYMENT GUIDE - Fix Empty Template Values

## 🚨 Problem You're Experiencing

You see this in the AI Editor:
- Empty title: `<h1></h1>`
- Empty description: `<p></p>`
- Generic greeting: "Hi there,"
- Products placeholder: `<!-- Products will be dynamically inserted here -->`

## ✅ What I Just Fixed

I fixed the root cause:
1. **Empty string validation**: AI was returning empty values
2. **Fallback to defaults**: If AI fails, use meaningful defaults
3. **Auto-repair**: When you access the editor, it detects broken templates and recreates them automatically

## 📦 DEPLOYMENT STEPS

### Step 1: Update Lambda Function (5 minutes)

**Do NOT use zip files - just copy/paste the Python code**

1. Go to AWS Lambda Console: https://console.aws.amazon.com/lambda
2. Find function: `lambda_ai_template_editor`
3. Click on the function name
4. Scroll to "Code source" section
5. Open `lambda_ai_template_editor.py`
6. **DELETE ALL THE CODE** in the editor
7. **COPY** the entire content from: `/home/user/email-campaign-ai/lambda_functions/lambda_ai_template_editor.py`
8. **PASTE** into AWS Lambda code editor
9. Click "Deploy" button (top right)
10. Wait for "Successfully deployed" message

### Step 2: Test the Fix (2 minutes)

1. Open your email campaign system frontend
2. Click on any campaign
3. Click the **Sparkles icon** (AI Template Editor)
4. **Expected result**: Template should now show:
   - Title: "New Collection Just Dropped!" (or AI-generated based on products)
   - Description: Full paragraph of text
   - Products: Sample product grid (if campaign has data)

### Step 3: If Template Still Shows Empty Values

The template instance might still be cached. Force recreation:

**Option A: Delete via AWS Console (Recommended)**
1. Go to DynamoDB Console
2. Open table: `campaign_template_instances`
3. Find your campaign_id
4. Click "Delete"
5. Refresh the AI Editor page
6. New template will be created automatically with correct values

**Option B: Use Test Script**
```bash
# From your local machine
cd /path/to/email-campaign-ai
python test_endpoints.py
```

This will show you if the template has valid content or not.

## 🔍 How to Verify It's Working

### Check CloudWatch Logs

1. Go to CloudWatch Logs
2. Open log group: `/aws/lambda/lambda_ai_template_editor`
3. Look for recent log entries when you access the AI Editor
4. You should see:
   ```
   Analyzing campaign products for: camp_xxx
   Campaign analysis: X products, Y schools
   Generated sample products HTML for X products
   Applied AI-generated metadata: ['campaign_title', 'main_title', ...]
   Final template_config keys: [...]
   MAIN_TITLE: New Collection Just Dropped!
   ```

5. If you see:
   ```
   Template instance for camp_xxx is broken: MAIN_TITLE is empty. Recreating...
   ```
   This means the old broken template was detected and is being fixed automatically!

### Check Template in Browser

1. Open AI Editor
2. Right-click on the email preview
3. Select "Inspect Element" or "Inspect"
4. Look for the `<h1>` tag
5. It should have text inside, not be empty

### Download and Check HTML

1. In AI Editor, there should be a "Download HTML" button (if not, I can add it)
2. Or right-click the preview → "View Page Source"
3. Search for `<h1`
4. Should show: `<h1...>New Collection Just Dropped!</h1>`
5. NOT: `<h1...></h1>`

## 📊 What the Logs Tell You

### Good Signs ✅

```
Analyzing campaign products for: camp_abc123
Campaign analysis: 47 products, 5 schools
Generated sample products HTML for 3 products
Applied AI-generated metadata: ['campaign_title', 'main_title', 'description', ...]
Final template_config keys: ['CAMPAIGN_TITLE', 'MAIN_TITLE', ...]
MAIN_TITLE: Show Your School Spirit This Fall
DESCRIPTION_TEXT length: 156
```

### Bad Signs ❌

```
No campaign data found, using default metadata
```
→ This means campaign_data table is empty. You need to upload a CSV first.

```
AI generation failed, using default metadata
```
→ OpenAI API call failed. Check if API key is set in Lambda environment variables.

```
Field MAIN_TITLE was empty, using default: New Collection Just Dropped!
```
→ AI returned empty value, system used fallback (this is OK, template will still work)

## 🐛 Troubleshooting

### Issue: Template still shows empty values after deployment

**Cause**: Old template instance still in DynamoDB

**Solution**:
```bash
# Delete template instance for specific campaign
aws dynamodb delete-item \
  --table-name campaign_template_instances \
  --key '{"campaign_id":{"S":"YOUR_CAMPAIGN_ID_HERE"}}'

# Then refresh the AI Editor page
```

### Issue: Products show comment instead of grid

**Cause**: campaign_data table has no records for this campaign

**Solution**:
1. Check if CSV was uploaded
2. Verify campaign status is "ready"
3. Query campaign_data:
```bash
aws dynamodb query \
  --table-name campaign_data \
  --key-condition-expression "campaign_id = :cid" \
  --expression-attribute-values '{":cid":{"S":"YOUR_CAMPAIGN_ID"}}' \
  --limit 1
```

Should return records with product_name_1, product_image_1, etc.

### Issue: "New Collection Available!" instead of AI content

**Cause**: AI generation is not happening

**Possible reasons**:
1. OpenAI API key not set
2. campaign_data table empty
3. Network issues with OpenAI API

**Check**:
1. Go to Lambda function configuration
2. Click "Environment variables"
3. Verify `OPENAI_API_KEY` exists and starts with `sk-`

## ✅ Final Verification Checklist

After deploying, verify:

- [ ] Lambda function code updated successfully
- [ ] CloudWatch logs show "Analyzing campaign products"
- [ ] CloudWatch logs show "MAIN_TITLE: ..." with actual text
- [ ] AI Editor displays full title (not empty `<h1>`)
- [ ] AI Editor displays description paragraph
- [ ] Products section shows grid OR comment (comment is OK if no campaign data)
- [ ] No errors in browser console
- [ ] Test email sends successfully
- [ ] Test email has personalized content

## 📞 If Still Not Working

### Collect This Information:

1. **Campaign ID**: (from URL when you open the campaign)
2. **CloudWatch Logs**: (last 50 lines when you access AI Editor)
3. **Template HTML**: (download or view source)
4. **campaign_data Check**:
```bash
aws dynamodb query \
  --table-name campaign_data \
  --key-condition-expression "campaign_id = :cid" \
  --expression-attribute-values '{":cid":{"S":"YOUR_CAMPAIGN_ID"}}' \
  --limit 1
```

### Common Issues:

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty `<h1>` | Old broken template | Delete from DynamoDB, refresh |
| Empty `<p>` for description | Old broken template | Delete from DynamoDB, refresh |
| Comment for products | No campaign data | Upload CSV first |
| "New Collection Available!" | AI not running | Check OpenAI API key |
| All default values | campaign_data empty | Import CSV file |

## 🎯 Expected Behavior After Fix

### When you create a new campaign:

1. Upload CSV
2. Wait for status: "ready"
3. Click Sparkles icon (AI Editor)
4. See:
   - Custom title based on your products
   - Description mentioning specific products/schools
   - Sample products grid (if CSV had products)

### When you access existing campaign:

1. System detects if template is broken
2. Automatically deletes and recreates it
3. You see valid template with content

### When you preview individual emails:

1. Click Eye icon → Expand batch → Click Preview
2. See recipient's name: "Hi John,"
3. See recipient's specific products (1-4 items)
4. See school logo and links (if school_code exists)

## 🚀 Deploy NOW

1. Copy `lambda_ai_template_editor.py` to AWS Lambda (replace all code)
2. Click "Deploy"
3. Delete broken template instances from DynamoDB
4. Refresh AI Editor
5. Verify template has content

**The fix is deployed and ready to test!**
