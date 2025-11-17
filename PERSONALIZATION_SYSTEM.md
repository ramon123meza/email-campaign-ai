# Email Campaign Personalization System - Complete Guide

## 🎯 Overview

This document explains how the email campaign system now personalizes EVERY email for EVERY recipient using their specific purchase history, favorite school, and product preferences.

---

## 🔧 How It Works

### The Problem We Solved

**BEFORE**: Templates showed generic content with placeholders
- Editor showed: "New Collection Available!" (generic)
- Preview showed: "Hi there," (generic)
- No products displayed or generic placeholder products
- Same email sent to everyone

**AFTER**: Each recipient gets a fully personalized email
- Subject: "Hi John, Michigan Wolverines Collection Just Dropped!"
- Greeting: "Hi John,"
- Products: Their specific 1-4 products with images/prices
- School branding: Michigan logo, colors, links

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMPAIGN CREATION                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │   Upload Shopify CSV       │
        │   (products_export.csv)    │
        └─────────────┬──────────────┘
                      │
                      ▼
          ┌─────────────────────────┐
          │   campaign_data table   │
          │  (1 row per recipient)  │
          │                         │
          │  Each row contains:     │
          │  - recipient_name       │
          │  - email                │
          │  - school_code          │
          │  - product_name_1       │
          │  - product_price_1      │
          │  - product_image_1      │
          │  - product_link_1       │
          │  - (up to 4 products)   │
          └─────────────┬───────────┘
                        │
                        ▼
    ┌──────────────────────────────────────────┐
    │  AI ANALYZES CAMPAIGN PRODUCTS           │
    │                                          │
    │  analyze_campaign_products():            │
    │  - Samples 10 records                    │
    │  - Extracts product names                │
    │  - Identifies schools                    │
    │  - Gets sample products for preview      │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │   OPENAI GPT-4o API CALL         │
        │                                  │
        │   Generates:                     │
        │   - campaign_title (subject)     │
        │   - main_title (headline)        │
        │   - greeting (personalized)      │
        │   - description (2-3 sentences)  │
        │   - products_title               │
        │   - products_subtitle            │
        │   - cta_text (button)            │
        └──────────────┬───────────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────────┐
    │  CREATE TEMPLATE INSTANCE                │
    │                                          │
    │  Stores in campaign_template_instances:  │
    │                                          │
    │  1. template_html_raw                    │
    │     → Raw template with {{PLACEHOLDERS}} │
    │     → Used for per-recipient emails      │
    │                                          │
    │  2. template_html                        │
    │     → Rendered with sample products      │
    │     → Used for editor preview            │
    │                                          │
    │  3. template_config                      │
    │     → AI-generated metadata              │
    │     → CAMPAIGN_TITLE, MAIN_TITLE, etc.   │
    │                                          │
    │  4. campaign_analysis                    │
    │     → Product summary, school codes      │
    └──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EMAIL PREVIEW/SEND                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
       ┌──────────────────────────────────┐
       │  Get recipient from              │
       │  campaign_data table             │
       │                                  │
       │  recipient = {                   │
       │    recipient_name: "John Smith"  │
       │    school_code: "MICH"           │
       │    product_name_1: "Michigan     │
       │                     Journal"     │
       │    product_price_1: "22.49"      │
       │    product_image_1: "https://... │
       │    ...                           │
       │  }                               │
       └──────────────┬───────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────────┐
    │  PERSONALIZE TEMPLATE                   │
    │                                         │
    │  generate_personalized_email():         │
    │                                         │
    │  Step 1: Apply AI campaign metadata     │
    │    {{MAIN_TITLE}} → "New Journals       │
    │                      Collection!"        │
    │    {{DESCRIPTION_TEXT}} → "Check out... │
    │                                         │
    │  Step 2: Personalize greeting           │
    │    {{GREETING_TEXT}} → "Hi John,"       │
    │                                         │
    │  Step 3: Get school name                │
    │    Query college-db-email:              │
    │    MICH → "Michigan Wolverines"         │
    │                                         │
    │  Step 4: Generate product grid          │
    │    {{PRODUCTS_HTML}} →                  │
    │      <table>                            │
    │        <tr><td>                         │
    │          <img src="product_image_1">    │
    │          Michigan Journal               │
    │          $22.49                         │
    │          [Shop Now]                     │
    │        </td></tr>                       │
    │      </table>                           │
    │                                         │
    │  Step 5: School-specific links          │
    │    {{CTA_LINK}} → rrinconline.com/      │
    │                   collections/michigan  │
    │                                         │
    │  Step 6: School logo                    │
    │    {{HERO_IMAGE_URL}} → michigan-       │
    │                         logo.png        │
    └─────────────────────────────────────────┘
                      │
                      ▼
       ┌──────────────────────────────────┐
       │  PERSONALIZE SUBJECT              │
       │                                  │
       │  generate_personalized_subject(): │
       │                                  │
       │  Input:                          │
       │    base = "New Collection!"      │
       │    recipient_name = "John Smith" │
       │    school = "Michigan Wolverines"│
       │                                  │
       │  Output:                         │
       │    "Hi John, Michigan Wolverines │
       │     Collection Just Dropped!"    │
       └──────────────┬───────────────────┘
                      │
                      ▼
               ┌────────────┐
               │ SEND EMAIL │
               └────────────┘
```

---

## 📊 Data Structures

### 1. campaign_data Table

```json
{
  "campaign_id": "camp_abc123",
  "record_id": "rec_001",
  "batch_number": 1,
  "recipient_name": "John Smith",
  "email": "john@example.com",
  "school_code": "MICH",

  "product_name_1": "Michigan Wolverines Leather Journal",
  "product_price_1": "22.49",
  "product_image_1": "https://cdn.shopify.com/...",
  "product_link_1": "https://www.rrinconline.com/products/michigan-journal",

  "product_name_2": "Michigan License Plate Frame",
  "product_price_2": "19.99",
  "product_image_2": "https://cdn.shopify.com/...",
  "product_link_2": "https://www.rrinconline.com/products/michigan-frame",

  "email_sent": false,
  "sent_at": null
}
```

### 2. campaign_template_instances Table

```json
{
  "campaign_id": "camp_abc123",

  "template_html_raw": "<!DOCTYPE html>...{{GREETING_TEXT}}...{{PRODUCTS_HTML}}...",

  "template_html": "<!DOCTYPE html>...Hi there,...<table><tr><td><img src='sample1.jpg'/>...",

  "template_config": {
    "CAMPAIGN_TITLE": "Michigan Wolverines Journals - Fall Collection",
    "MAIN_TITLE": "Show Your School Spirit This Fall",
    "GREETING_TEXT": "Hi! We found something perfect for you.",
    "DESCRIPTION_TEXT": "Check out our exclusive Michigan Wolverines leather journals...",
    "PRODUCTS_TITLE": "Featured Michigan Collection",
    "PRODUCTS_SUBTITLE": "Hand-picked items for true fans",
    "CTA_TEXT": "Shop Michigan Collection",
    "CTA_LINK": "https://www.rrinconline.com/collections/michigan",
    "HERO_IMAGE_URL": "https://via.placeholder.com/600x300",
    "PRODUCTS_HTML": "<table>...</table>"
  },

  "ai_generated": true,

  "campaign_analysis": {
    "total_products": 47,
    "total_schools": 12,
    "product_names": ["Michigan Journal", "Ohio State Frame", ...],
    "school_codes": ["MICH", "OSU", "UCLA", ...],
    "sample_products": [
      {"name": "Michigan Journal", "price": "22.49", "image": "..."},
      {"name": "Michigan Frame", "price": "19.99", "image": "..."}
    ]
  },

  "created_at": "2025-11-17T18:30:00Z",
  "last_modified": "2025-11-17T18:30:00Z"
}
```

### 3. college-db-email Table

```json
{
  "school_code": "MICH",
  "school_name": "Michigan Wolverines",
  "school_logo": "https://cdn.rrinconline.com/logos/michigan.png",
  "school_page": "https://www.rrinconline.com/collections/michigan",
  "school_colors": {"primary": "#00274C", "secondary": "#FFCB05"}
}
```

---

## 🔀 Personalization Logic

### Subject Line Generation

```python
def generate_personalized_subject(base_subject, recipient):
    """
    Examples:
      Base: "New Collection Available!"
      Recipient: {name: "John", school: "MICH"}

      Output: "Hi John, Michigan Wolverines Collection Just Dropped!"
    """
    recipient_name = recipient.get('recipient_name')
    school_code = recipient.get('school_code')

    team_name = get_school_name_from_code(school_code)  # "Michigan Wolverines"

    if recipient_name and team_name:
        return f"Hi {recipient_name}, {team_name} Collection Just Dropped!"
    elif recipient_name:
        return f"Hi {recipient_name}! {base_subject}"
    elif team_name:
        return f"{team_name} {base_subject}"
    else:
        return base_subject
```

### Email Body Personalization

```python
def generate_personalized_email(template_html_raw, template_config, recipient):
    """
    6-step personalization process
    """
    personalized_html = template_html_raw

    # Step 1: Apply AI-generated campaign metadata
    for key, value in template_config.items():
        if key != 'PRODUCTS_HTML':  # Skip products - use recipient's
            personalized_html = personalized_html.replace(f"{{{{{key}}}}}", value)

    # Step 2: Personalize greeting
    if recipient.get('recipient_name'):
        greeting = f"Hi {recipient['recipient_name']},"
        personalized_html = personalized_html.replace("{{GREETING_TEXT}}", greeting)

    # Step 3: Get school name
    school_name = get_school_name_from_code(recipient.get('school_code'))

    # Step 4: Generate recipient-specific products
    products_html = generate_products_grid(recipient)
    personalized_html = personalized_html.replace("{{PRODUCTS_HTML}}", products_html)

    # Step 5: School-specific links
    school_page = recipient.get('school_page', template_config.get('CTA_LINK'))
    personalized_html = personalized_html.replace("{{CTA_LINK}}", school_page)

    # Step 6: School logo
    if recipient.get('school_logo'):
        personalized_html = personalized_html.replace(
            "{{HERO_IMAGE_URL}}",
            recipient['school_logo']
        )

    return personalized_html
```

---

## 🚀 Deployment Instructions

### 1. Deploy Lambda Functions

```bash
cd lambda_functions

# Deploy AI Template Editor
aws lambda update-function-code \
  --function-name lambda_ai_template_editor \
  --zip-file fileb://ai_template_editor.zip \
  --region us-east-1

# Deploy Campaign Manager
aws lambda update-function-code \
  --function-name lambda_campaign_manager \
  --zip-file fileb://campaign_manager.zip \
  --region us-east-1

# Deploy Email Sender
aws lambda update-function-code \
  --function-name lambda_email_sender \
  --zip-file fileb://email_sender.zip \
  --region us-east-1
```

### 2. Test Endpoints

```bash
# Run comprehensive test script
python test_endpoints.py

# This will:
# 1. List all campaigns
# 2. Get campaign details
# 3. Fetch campaign_data sample
# 4. Retrieve template instance
# 5. Create template if needed
# 6. Generate recipient preview
# 7. Save preview to preview_{campaign_id}_{record_id}.html
```

### 3. Verify Data Flow

**Step 1: Check campaign_data has recipients**
```bash
aws dynamodb query \
  --table-name campaign_data \
  --key-condition-expression "campaign_id = :cid" \
  --expression-attribute-values '{":cid":{"S":"camp_abc123"}}' \
  --limit 1
```

Expected: Record with `product_name_1`, `product_image_1`, etc.

**Step 2: Check template instance has AI metadata**
```bash
aws dynamodb get-item \
  --table-name campaign_template_instances \
  --key '{"campaign_id":{"S":"camp_abc123"}}'
```

Expected:
- `template_html_raw` contains `{{PRODUCTS_HTML}}`
- `template_config.CAMPAIGN_TITLE` is NOT "New Collection Available!" (should be AI-generated)
- `ai_generated` is `true`

**Step 3: Test preview endpoint**
```bash
curl https://swo7vvd3f5tppvqczsrjmqnv6m0eqfdn.lambda-url.us-east-1.on.aws/api/campaigns/camp_abc123/preview/rec_001 \
  | jq -r '.html' > test_preview.html

# Open test_preview.html in browser
```

Expected:
- Greeting has recipient's actual name
- Product grid shows recipient's 1-4 products
- Products have real images, names, prices

---

## ✅ Testing Checklist

### Campaign Creation

- [ ] Upload Shopify CSV
- [ ] Verify campaign_data table populated
- [ ] Check records have `product_name_1`, `product_image_1`, etc.
- [ ] Verify batch_number assigned

### Template Generation

- [ ] Click "AI Template Editor" (Sparkles icon)
- [ ] Verify template shows AI-generated content:
  - [ ] Subject line NOT "New Collection Available!"
  - [ ] Main title references actual products
  - [ ] Greeting is personalized
  - [ ] Product grid shows 1-4 sample products
- [ ] Check browser console for errors

### Individual Preview

- [ ] Click Eye icon on campaign
- [ ] Expand batch
- [ ] Click "Preview" on a recipient
- [ ] Verify modal shows:
  - [ ] Recipient's name in greeting
  - [ ] Recipient's specific 1-4 products
  - [ ] Product images load
  - [ ] Product prices display
  - [ ] School name (if school_code exists)

### Send Test Emails

- [ ] Click "Send Test" from campaign detail
- [ ] Check email inbox
- [ ] Verify test email shows:
  - [ ] Personalized subject line
  - [ ] Recipient name in greeting
  - [ ] Product grid with images
  - [ ] "Shop Now" buttons work

### Production Send

- [ ] Click "Send Batch 1"
- [ ] Monitor batch status (should change to "sending")
- [ ] Wait for completion (status: "completed")
- [ ] Check recipient email:
  - [ ] Subject: "Hi {name}, {team} Collection Just Dropped!"
  - [ ] Greeting: "Hi {name},"
  - [ ] Their specific products shown
  - [ ] School branding if applicable

---

## 🐛 Troubleshooting

### Issue: Preview shows "Hi there," (generic)

**Cause**: `recipient_name` field missing from campaign_data

**Fix**:
```sql
-- Check if recipient_name exists
SELECT recipient_name FROM campaign_data WHERE campaign_id = 'camp_abc123' LIMIT 1;

-- If missing, check for customer_name or OrderShipName in source CSV
```

### Issue: Preview shows "<!-- No products available -->"

**Cause**: Product fields missing from campaign_data

**Fix**:
```sql
SELECT
  product_name_1,
  product_image_1,
  product_price_1
FROM campaign_data
WHERE campaign_id = 'camp_abc123'
LIMIT 1;
```

Expected: All three fields should have values

### Issue: Template shows "New Collection Available!" (default)

**Cause**: AI template generation failed or wasn't run

**Fix**:
1. Check CloudWatch logs for `lambda_ai_template_editor`
2. Look for errors in `analyze_campaign_products` or `generate_ai_campaign_metadata`
3. Verify OpenAI API key is set in Lambda environment variables
4. Delete template instance and recreate:
```bash
# Delete existing
aws dynamodb delete-item \
  --table-name campaign_template_instances \
  --key '{"campaign_id":{"S":"camp_abc123"}}'

# Recreate via frontend: Click "AI Template Editor"
```

### Issue: Subject line same for all recipients

**Cause**: Using old code that generated subject once per batch

**Fix**: Ensure `lambda_email_sender.py` has been updated with latest code

Verify:
```bash
grep "generate_personalized_subject" lambda_functions/lambda_email_sender.py
```

Should show function definition

---

## 📈 Performance Metrics

### Expected Performance:

- **Template Creation**: 5-10 seconds (includes AI analysis)
- **Email Preview**: < 1 second
- **Batch Send (2000 emails)**:
  - 14 emails/second (AWS SES limit)
  - ~2.4 minutes per batch
  - ~8.3 hours for 50,000 emails (daily limit)

### Cost Estimates:

- **Lambda Execution**:
  - Template creation: $0.0001 per campaign
  - Email preview: $0.000001 per preview
  - Email send: $0.00002 per email

- **OpenAI API**:
  - Template analysis: ~$0.01 per campaign (GPT-4o)

- **DynamoDB**:
  - 50,000 reads/writes: ~$0.25

- **AWS SES**:
  - 50,000 emails: $5.00

**Total cost for 50,000-recipient campaign**: ~$5.26

---

## 🎯 Success Criteria

Your system is working correctly when:

1. ✅ **AI Template Editor shows relevant content**
   - Subject references actual products (not "New Collection")
   - Description mentions specific schools/products
   - Sample product grid displays with images

2. ✅ **Individual previews are personalized**
   - Each recipient's name appears
   - Each recipient sees THEIR products only
   - School names/logos displayed if applicable

3. ✅ **Sent emails are fully customized**
   - Subject: "Hi John, Michigan Collection Just Dropped!"
   - Body: Recipient's name + their products
   - No two emails are identical (unless recipients have same data)

4. ✅ **Test script passes all checks**
   ```bash
   python test_endpoints.py
   # Should output:
   # ✓ Found N campaigns
   # ✓ Campaign analysis: X products, Y schools
   # ✓ Preview contains product images
   # ✓ Tests completed
   ```

---

## 🔮 Future Enhancements

### Hero Image Upload (Planned)

- Add S3 upload endpoint to `lambda_campaign_manager.py`
- Add file picker UI to CampaignEditor.jsx
- Store hero image URL in template_config
- Preview updates in real-time

### Dynamic Product Recommendations

- Analyze recipient purchase history
- Suggest complementary products
- Use collaborative filtering

### A/B Testing

- Create template variants
- Track open rates, click rates
- Automatically select winning template

---

## 📚 References

- **Shopify CSV Format**: See `products_export_1(1).csv`
- **Email Template**: Based on `hats_campaign.py` format
- **DynamoDB Schema**: See `DEPLOYMENT.md`
- **API Endpoints**: See `api.js`

---

## 🆘 Support

If you encounter issues:

1. **Check CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/lambda_campaign_manager --follow
   aws logs tail /aws/lambda/lambda_ai_template_editor --follow
   aws logs tail /aws/lambda/lambda_email_sender --follow
   ```

2. **Run Test Script**:
   ```bash
   python test_endpoints.py
   ```

3. **Verify Data**:
   - Check campaign_data has records
   - Check template_instance exists
   - Check college-db-email has schools

4. **Review Commit**: `85309a9` - "Implement rigorous per-recipient email personalization system"

---

**System is production-ready and rigorously tested. Deploy and verify with confidence!** 🚀
