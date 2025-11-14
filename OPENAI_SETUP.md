# OpenAI Integration Setup Guide

## Overview

This email campaign system now uses **OpenAI GPT-4o** for generating campaign metadata, with **pre-built HTML templates** from the database for professional email design.

### What AI Does vs. What Templates Do

**AI Generates (Metadata Only):**
- Campaign title
- 5 subject line variations
- Main email headline
- Product collection description
- Call-to-action button text
- Product type detection

**Pre-Built Templates Handle (No AI):**
- Professional HTML email structure
- Header with logo
- Product grid layouts (1, 2, or 4 products)
- Footer with social links
- Responsive design
- All styling and formatting

## Setting Up OpenAI API

### Step 1: Get Your OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)
5. **IMPORTANT**: Save it securely - you can't view it again!

### Step 2: Add API Key to Lambda Environment

#### Via AWS Console:

1. Go to **AWS Lambda Console**
2. Find your campaign manager function
3. Click on "Configuration" tab
4. Click "Environment variables"
5. Click "Edit"
6. Click "Add environment variable"
7. Set:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (sk-...)
8. Click "Save"

####Via AWS CLI:

```bash
aws lambda update-function-configuration \
  --function-name YOUR-CAMPAIGN-MANAGER-FUNCTION-NAME \
  --environment "Variables={OPENAI_API_KEY=sk-YOUR-API-KEY-HERE,AWS_REGION=us-east-1,COLLEGE_TABLE=college-db-email,EMAIL_CAMPAIGN_TABLE=college_email_campaign,S3_BUCKET=layout-tool-randr}" \
  --region us-east-1
```

## How It Works

### Campaign Creation Flow

1. **User uploads product CSV**
   - System extracts first 5 products for analysis

2. **AI analyzes products** (via OpenAI)
   - Identifies product type (hats, apparel, accessories, etc.)
   - Generates catchy campaign title
   - Creates 5 subject line variations
   - Writes compelling description (generic, no school names)
   - Suggests CTA button text

3. **System assembles email** (from database templates)
   - Loads professional HTML components
   - Header with logo
   - Dynamic product grid based on count
   - Footer with social links and unsubscribe
   - **NO AI-GENERATED HTML** - all from template_components table

4. **User customizes**
   - Upload campaign header image
   - Edit any metadata fields
   - Preview email before sending

### Template Components in Database

The system uses these pre-built components from `template_components` table:

```
┌─────────────────────────┐
│ HEADER                  │  Logo, branding
├─────────────────────────┤
│ HERO IMAGE (uploaded)   │  User's campaign image
├─────────────────────────┤
│ MAIN TITLE (AI)         │  AI-generated headline
├─────────────────────────┤
│ DESCRIPTION (AI)        │  AI-generated copy
├─────────────────────────┤
│ PRODUCT GRID (template) │  Pre-built layout
│ ┌───┬───┐              │
│ │ 1 │ 2 │              │
│ ├───┼───┤              │
│ │ 3 │ 4 │              │
│ └───┴───┘              │
├─────────────────────────┤
│ CTA BUTTON (AI)         │  AI-generated text
├─────────────────────────┤
│ FOOTER (template)       │  Social links, address
└─────────────────────────┘
```

## API Costs & Usage

### OpenAI Pricing (GPT-4o)

- **Input**: ~$5 per 1M tokens
- **Output**: ~$15 per 1M tokens

### Per Campaign Estimate:

- Input: ~500 tokens (product data + prompt)
- Output: ~200 tokens (JSON metadata)
- **Cost per campaign**: ~$0.005 (half a cent)

### Example Monthly Cost:

- 100 campaigns/month = **$0.50**
- 500 campaigns/month = **$2.50**
- 1,000 campaigns/month = **$5.00**

**Much cheaper than Bedrock Claude Sonnet 4.5!**

## Testing the Integration

### 1. Test AI Generation Endpoint

```bash
# Replace with your campaign ID and Lambda URL
curl -X POST \
  https://YOUR-LAMBDA-URL.lambda-url.us-east-1.on.aws/api/campaigns/YOUR-CAMPAIGN-ID/ai-generate \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "message": "Metadata generated successfully",
  "content": {
    "campaign_title": "Exclusive College Merchandise Collection",
    "subject_lines": [
      "New Arrival Alert!",
      "Your Team, Your Style",
      "Limited Edition Gear Inside",
      "Show Your School Spirit",
      "Fresh Styles Just Dropped"
    ],
    "main_headline": "Represent Your School in Style",
    "description": "Discover our latest collection...",
    "cta_text": "Shop Now",
    "product_type": "hats"
  },
  "note": "Email template will use pre-built HTML components from database"
}
```

### 2. Test Full Campaign Flow

1. Go to **Create Campaign**
2. Upload a product CSV
3. Wait for processing (you'll see AI generating metadata)
4. Check campaign detail page
5. Verify:
   - Campaign has AI-generated title
   - Subject line is populated
   - Description looks good
   - Email preview shows professional template

### 3. Test Image Upload

1. Go to campaign detail page
2. Click "Edit Template"
3. Click "Upload Image" in the Main Campaign Image section
4. Upload a JPG or PNG (max 5MB)
5. Image should appear in preview
6. Click "Save Changes"

## Troubleshooting

### Error: "OPENAI_API_KEY environment variable not set"

**Solution**: Add the API key to Lambda environment variables (see Step 2 above)

### Error: "OpenAI API request failed: 401"

**Causes**:
- Invalid API key
- API key not activated
- Billing not set up

**Solution**:
1. Verify API key is correct
2. Check [OpenAI Platform](https://platform.openai.com/account/billing) billing settings
3. Ensure you have credits or payment method added

### Error: "OpenAI API request failed: 429"

**Cause**: Rate limit exceeded

**Solution**:
- Wait a few seconds and retry
- Upgrade OpenAI tier if needed
- System automatically retries with backoff

### AI generates incomplete metadata

**Cause**: Model might return invalid JSON

**Solution**: System has fallback values built-in:
```javascript
{
  campaign_title: 'New Collection Available',
  subject_lines: ['Check out our latest collection!'],
  main_headline: 'New Products Just Dropped!',
  description: 'Discover our latest collection...',
  cta_text: 'Shop Now',
  product_type: 'merchandise'
}
```

### Template doesn't look professional

**Cause**: Template components might not be loaded

**Solution**:
1. Run the database setup script:
   ```bash
   python setup_database.py
   ```
2. This creates template_components table with professional HTML
3. Check DynamoDB console to verify components exist

## Database Template Components

### Viewing Templates

1. Go to **DynamoDB Console**
2. Select `template_components` table
3. Click "Explore table items"
4. You should see:
   - `header` - Email header with logo
   - `footer` - Footer with social links
   - `single_product` - Layout for 1 product
   - `multi_product` - Layout for 2-4 products

### Template Structure

Each component has:
```json
{
  "component_id": "header",
  "component_type": "header",
  "name": "Standard Header",
  "html_template": "<table>...</table>",
  "editable_fields": ["logo_url"],
  "default_values": {
    "logo_url": "https://..."
  }
}
```

## Best Practices

### 1. API Key Security

- ✅ **DO**: Store in Lambda environment variables
- ✅ **DO**: Use AWS Secrets Manager for production
- ❌ **DON'T**: Hard-code in source code
- ❌ **DON'T**: Commit to Git

### 2. Cost Optimization

- AI analyzes only first 5 products (not all)
- Metadata is cached in database
- Re-generation only when needed
- Uses GPT-4o (cheaper than GPT-4)

### 3. Template Quality

- Pre-built templates are production-ready
- Based on successful email campaigns
- Mobile-responsive design
- Email client tested (Gmail, Outlook, etc.)

### 4. Error Handling

- System has fallback values if AI fails
- Retries with exponential backoff
- User-friendly error messages
- Logs all AI interactions for debugging

## Deployment Checklist

- [ ] OpenAI API key obtained
- [ ] API key added to Lambda environment
- [ ] Lambda function code updated
- [ ] Database setup script run (template_components created)
- [ ] Test endpoint responds successfully
- [ ] Full campaign flow tested
- [ ] Image upload tested
- [ ] Email preview looks professional
- [ ] Test email sent and received
- [ ] Cost monitoring set up

## Support

If you encounter issues:

1. Check Lambda CloudWatch logs
2. Verify environment variables are set
3. Test OpenAI API key directly:
   ```bash
   curl https://api.openai.com/v1/chat/completions \
     -H "Authorization: Bearer YOUR-API-KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
   ```
4. Ensure template_components table exists and has data

## Next Steps

1. **Deploy Lambda function** with updated code
2. **Set OpenAI API key** in environment
3. **Test campaign creation** end-to-end
4. **Monitor costs** in OpenAI dashboard
5. **Customize templates** if needed (in database)

---

**System Status**: ✅ Ready for production
**AI Provider**: OpenAI GPT-4o
**Template System**: Pre-built HTML components
**Dependencies**: None (pure REST API)
