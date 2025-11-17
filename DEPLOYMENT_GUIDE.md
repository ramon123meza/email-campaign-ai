# Email Campaign AI - Deployment Guide

## 📋 Prerequisites

- AWS Account with permissions for Lambda, DynamoDB, and SES
- AWS CLI configured
- Node.js 18+ installed
- Python 3.9+ installed (for Lambda functions)
- OpenAI API Key (for AI features)

---

## 🚀 Deployment Steps

### **1. Deploy Lambda Functions**

#### A. Update Lambda Function: `lambda_campaign_manager`

**Function URL:** `https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws/`

```bash
# Navigate to lambda functions directory
cd lambda_functions

# Create deployment package for campaign manager
zip -r campaign_manager.zip lambda_campaign_manager.py

# Upload to AWS Lambda (via AWS CLI)
aws lambda update-function-code \
  --function-name lambda_campaign_manager \
  --zip-file fileb://campaign_manager.zip \
  --region us-east-1

# Or upload via AWS Console:
# 1. Go to AWS Lambda Console
# 2. Find "lambda_campaign_manager" function
# 3. Click "Upload from" > ".zip file"
# 4. Select campaign_manager.zip
# 5. Click "Save"
```

**Environment Variables Required:**
```
AWS_REGION=us-east-1
COLLEGE_TABLE=college-db-email
EMAIL_CAMPAIGN_TABLE=college_email_campaign
S3_BUCKET=layout-tool-randr
OPENAI_API_KEY=sk-your-openai-api-key
```

**New Endpoints Added:**
- `GET /api/campaigns/{id}/batches/{batch}/recipients` - Get batch recipients
- `GET /api/campaigns/{id}/preview/{record_id}` - Preview recipient email

---

#### B. Update Lambda Function: `lambda_ai_template_editor`

**Function URL:** `https://jya2onwln6iewhxhxbrjwzpd7a0oudxo.lambda-url.us-east-1.on.aws/`

```bash
# Create deployment package for AI template editor
zip -r ai_template_editor.zip lambda_ai_template_editor.py

# Upload to AWS Lambda
aws lambda update-function-code \
  --function-name lambda_ai_template_editor \
  --zip-file fileb://ai_template_editor.zip \
  --region us-east-1
```

**Environment Variables Required:**
```
AWS_REGION=us-east-1
OPENAI_API_KEY=sk-your-openai-api-key
CLAUDE_API_KEY=sk-ant-your-claude-key (optional)
```

**New Features:**
- AI-powered campaign analysis
- Automatic metadata generation from products
- Intelligent template creation with product-specific content

---

#### C. Lambda Function: `lambda_email_sender` (No changes needed)

**Function URL:** `https://myylk2rmfu3njaqfxzwyvmyaru0sgwlv.lambda-url.us-east-1.on.aws/`

This function already supports the new template system and doesn't require updates.

---

### **2. Deploy Frontend Application**

#### Build Production Bundle:

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

#### Deploy to Your Platform:

**Option A: Netlify**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

**Option B: Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

**Option C: AWS S3 + CloudFront**
```bash
# Sync to S3
aws s3 sync dist/ s3://your-bucket-name/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

### **3. Verify Deployment**

#### Test Lambda Functions:

**Campaign Manager - Test Batch Recipients:**
```bash
curl https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws/api/campaigns/YOUR_CAMPAIGN_ID/batches/1/recipients
```

**Expected Response:**
```json
[
  {
    "campaign_id": "...",
    "record_id": "...",
    "customer_email": "test@example.com",
    "customer_name": "John",
    "school_code": "HOUS",
    "product_image_1": "https://...",
    "product_name_1": "...",
    ...
  }
]
```

**AI Template Editor - Test Template Creation:**
```bash
curl -X POST https://jya2onwln6iewhxhxbrjwzpd7a0oudxo.lambda-url.us-east-1.on.aws/api/campaigns/YOUR_CAMPAIGN_ID/create-template-instance
```

**Expected Response:**
```json
{
  "message": "Template instance created successfully",
  "template_instance": { ... },
  "ai_generated": true
}
```

---

### **4. Database Verification**

Ensure these DynamoDB tables exist with correct indexes:

1. **campaign_data**
   - Partition Key: `campaign_id`
   - Sort Key: `record_id`
   - GSI: `BatchIndex` (campaign_id + batch_number)

2. **campaign_template_instances**
   - Partition Key: `campaign_id`

3. **campaign_batches**
   - Partition Key: `campaign_id`
   - Sort Key: `batch_number`

4. **email_campaigns**
   - Partition Key: `campaign_id`

5. **test_users**
   - Partition Key: `email`

---

## 🔧 Configuration Files

### API Endpoints (Frontend)

File: `src/config/api.js`

Verify these endpoints match your Lambda Function URLs:

```javascript
export const API_CONFIG = {
  CAMPAIGN_API: 'https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws',
  EMAIL_API: 'https://myylk2rmfu3njaqfxzwyvmyaru0sgwlv.lambda-url.us-east-1.on.aws',
  AI_TEMPLATE_API: 'https://jya2onwln6iewhxhxbrjwzpd7a0oudxo.lambda-url.us-east-1.on.aws',
  TIMEOUT: 30000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
}
```

---

## 🧪 Post-Deployment Testing

After deployment, test these workflows:

### 1. **Create Campaign**
- ✅ Navigate to Dashboard
- ✅ Click "Create Campaign"
- ✅ Enter campaign name
- ✅ Upload Shopify CSV
- ✅ Verify campaign created

### 2. **AI Template Generation**
- ✅ Open campaign (Eye icon)
- ✅ Click "AI Template Editor"
- ✅ Verify template shows AI-generated content
- ✅ Check if title/description match products

### 3. **Batch Preview**
- ✅ Expand batch in campaign detail
- ✅ See all recipients
- ✅ Click "Preview" on a recipient
- ✅ Verify personalized email shows correctly

### 4. **Test Email**
- ✅ Click "Send Test" button
- ✅ Wait for confirmation
- ✅ Check test inbox
- ✅ Verify email rendering and personalization

### 5. **Send Campaign**
- ✅ Click "Send Batch" on first batch
- ✅ Monitor progress in real-time
- ✅ Verify emails are sent
- ✅ Check SES metrics

---

## 🐛 Troubleshooting

### Lambda Function Errors

**Issue:** "OPENAI_API_KEY not set"
**Solution:** Add OpenAI API key to Lambda environment variables

**Issue:** "Campaign data not found"
**Solution:** Ensure campaign_data table is populated after uploading CSV

**Issue:** "Template instance not found"
**Solution:** Manually trigger template creation via API or recreate campaign

### Frontend Errors

**Issue:** "Network error - API endpoints"
**Solution:** Check API_CONFIG in `src/config/api.js` matches your Lambda URLs

**Issue:** "CORS errors"
**Solution:** Verify Lambda functions have CORS headers enabled

### Email Sending Issues

**Issue:** "SES sending failed"
**Solution:**
- Verify SES is out of sandbox mode
- Check sender email is verified
- Ensure rate limits not exceeded (14/second)

---

## 📊 Monitoring

### CloudWatch Logs

Monitor Lambda execution:

```bash
# Campaign Manager logs
aws logs tail /aws/lambda/lambda_campaign_manager --follow

# AI Template Editor logs
aws logs tail /aws/lambda/lambda_ai_template_editor --follow

# Email Sender logs
aws logs tail /aws/lambda/lambda_email_sender --follow
```

### Key Metrics to Watch

- **Lambda Invocations:** Should increase with usage
- **Lambda Errors:** Should be <1%
- **Lambda Duration:** Should be <5s for most operations
- **SES Sent:** Track successful email deliveries
- **SES Bounces/Complaints:** Should be <5%

---

## 🔐 Security Checklist

- ✅ OpenAI API key stored as environment variable (not in code)
- ✅ AWS credentials use IAM roles (not hardcoded)
- ✅ Lambda functions have minimum required permissions
- ✅ CORS configured to allow only your frontend domain
- ✅ SES verified sender identity
- ✅ DynamoDB tables have backup enabled
- ✅ CloudWatch logging enabled for all Lambda functions

---

## 📞 Support

For issues or questions:
1. Check CloudWatch logs for detailed error messages
2. Review DynamoDB tables for data integrity
3. Test Lambda functions individually via AWS Console
4. Verify environment variables are set correctly

---

## 🎉 Deployment Complete!

Your enhanced email campaign system is now live with:
- ✅ AI-powered template generation
- ✅ Batch recipient preview
- ✅ Individual email preview
- ✅ Test email functionality in editor
- ✅ Blue theme sidebar
- ✅ Dynamic product grids (1-4 products)
- ✅ School-specific personalization

**Next Steps:**
1. Upload a real Shopify product export
2. Let AI generate the template
3. Send test emails to verify
4. Launch your first campaign!
