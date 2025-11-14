# 🚀 AI-Powered Email Campaign Management System

A modern, **AI-enhanced** React-based system for creating and managing beautiful email campaigns with **Claude Sonnet 4.5** integration, visual canvas editor, and AWS infrastructure.

## ✨ **NEW: AI-Powered Features**

- 🤖 **Claude Sonnet 4.5 Integration** - Natural language email editing
- 🎨 **Visual Canvas Editor** - Mailchimp-style email builder
- ↩️ **Undo/Redo System** - Version history with instant restore
- 👁️ **Live Preview** - See exactly what customers will receive
- 🛡️ **Safety Mechanisms** - Pre-send checklist and confirmations
- 🗑️ **Full Delete Support** - Clean campaign removal
- 🎭 **Modern UI** - Beautiful gradients and glass morphism

## 🏗️ System Architecture

```
Frontend (React + Vite)           Backend (AWS Lambda + AI)         Storage
├── Visual Canvas Editor          ├── Campaign Manager API         ├── DynamoDB Tables
├── AI Chat Assistant             ├── Email Sending Engine         │   ├── email_campaigns
├── Template Editor               ├── File Processing Service      │   ├── campaign_batches
├── File Upload Manager           ├── Claude Sonnet 4.5 (Bedrock) │   ├── campaign_data
├── Progress Dashboard            └── Database Management          │   ├── campaign_templates (NEW)
└── Test Email Interface                                           │   ├── template_versions (NEW)
                                                                   │   ├── test_users
                                                                   │   ├── template_components
                                                                   │   ├── college-db-email (existing)
                                                                   │   └── college_email_campaign (existing)
                                                                   └── S3 (file storage)
```

## 🚀 Quick Setup Guide

### 1. Database Setup

**IMPORTANT:** This preserves your existing DynamoDB tables.

```bash
# Install dependencies for database setup
pip install boto3 pandas

# Update AWS credentials in setup_database.py (lines 13-15)
AWS_ACCESS_KEY_ID = 'YOUR_ACCESS_KEY'
AWS_SECRET_ACCESS_KEY = 'YOUR_SECRET_KEY'
AWS_REGION = 'us-east-1'

# Run database setup
python setup_database.py
```

### 2. Lambda Function Deployment

#### Campaign Manager Lambda:
```bash
# Package dependencies as Lambda layer:
# - boto3
# - pandas 
# - requests

# Environment Variables:
AWS_REGION=us-east-1
COLLEGE_TABLE=college-db-email
EMAIL_CAMPAIGN_TABLE=college_email_campaign
S3_BUCKET=your-campaign-files-bucket

# Deploy lambda_campaign_manager.py
```

#### Email Sender Lambda:
```bash
# Package dependencies as Lambda layer:
# - boto3
# - jinja2 (for template rendering)

# Environment Variables:
AWS_REGION=us-east-1
SES_SENDER="R and R Imports INC" <hello@rrinconline.com>
SES_REPLY_TO=hello@rrinconline.com

# Deploy lambda_email_sender.py
```

### 3. Frontend Setup

```bash
# Install Node.js dependencies
npm install

# Update API endpoints in src/config/api.js
export const API_CONFIG = {
  CAMPAIGN_API: 'https://YOUR_CAMPAIGN_LAMBDA_URL/api',
  EMAIL_API: 'https://YOUR_EMAIL_LAMBDA_URL/api',
  // ... rest of config
}

# Start development server
npm run dev

# Build for production
npm run build
```

## 🤖 AI Features (NEW)

### Claude Sonnet 4.5 Integration
- **Model**: `anthropic.claude-sonnet-4-5-20250929-v1:0` via AWS Bedrock
- **Natural Language Editing**: "Make the title bigger and blue" - AI understands and applies changes
- **Content Generation**: Automatically creates campaign titles, subject lines (5 variations), headlines, descriptions, and CTA text from product CSV
- **Context-Aware**: Analyzes current template and makes minimal, targeted changes
- **Conversation Memory**: AI remembers conversation context for iterative edits

### Visual Canvas Editor
- **Mailchimp-Style Interface**: Component-based email builder
- **Live Preview**: See changes instantly in desktop/mobile views
- **Drag & Drop**: Easily reorder email sections
- **Component Palette**: Header, Hero, Products, CTA, Footer templates
- **Inline Editing**: Click to edit any component directly

### Version Control & Undo
- **Automatic Versioning**: Every AI edit creates a new version
- **Version History**: View all past versions with timestamps
- **One-Click Undo**: Instantly restore any previous version
- **Change Descriptions**: AI explains what was modified

### Safety & Preview
- **Pre-Send Checklist**: Required confirmations before sending
- **Customer Preview**: See exactly what each recipient will receive
- **Type-to-Confirm**: Must type "SEND" to proceed
- **Template Locking**: Prevent accidental edits during sending
- **Test Mode**: Send to test users without affecting production

### Delete Campaign
- **Full Cleanup**: Removes campaign, batches, data, templates, versions, and S3 files
- **Safety Check**: Cannot delete campaigns currently sending
- **Cascade Delete**: Automatically cleans all related records

## 📋 Features Overview

### ✅ Campaign Management
- **AI-Powered Content Generation**: Claude Sonnet 4.5 creates compelling campaign content
- **Visual Canvas Editor**: Mailchimp-style email builder with live preview
- **Dynamic Template Builder**: Component-based email construction
- **File Processing**: Upload product CSV files (follows existing logic)
- **Batch Management**: 2,000 emails per batch (configurable in Lambda)
- **Progress Tracking**: Real-time batch processing status
- **Campaign Analytics**: Detailed performance metrics
- **Delete Campaigns**: Complete removal with cascade delete

### ✅ Email Sending System
- **Batch Processing**: Prevents Lambda timeouts with 10-minute max runtime
- **Rate Limiting**: 14 emails/second (AWS SES compliance)
- **Duplicate Prevention**: Records marked as sent won't be processed again
- **Individual Batch Control**: Each batch has its own "Send" button
- **Test Email System**: Send to test users before production

### ✅ Data Management
- **College Database**: Visual management of school data with logos
- **Email Campaign Data**: Paginated view with source breakdown (Shopify/Etsy)
- **Test Users**: Manage test email recipients
- **File Upload**: Handles CSV files with product collections

### ✅ Template System
- **Dynamic Product Sections**: Automatically adapts to 1-4 products per email
- **Customizable Components**: Header, footer, product layouts
- **Image Upload**: Main campaign images (.jpg, .png, .tiff)
- **Personalization**: Customer names, school/team information

## 🔧 Configuration

### Batch Size Configuration
In `lambda_email_sender.py` (line 16):
```python
EMAILS_PER_BATCH = 2000  # Change this value to adjust batch size
```

### Email Rate Limiting
In both Lambda functions (lines 17-18):
```python
EMAILS_PER_SECOND = 14   # AWS SES rate limit
BATCH_TIMEOUT_MINUTES = 10  # Maximum processing time per batch
```

## 📊 Database Tables

### New Tables Created:
- **`email_campaigns`**: Campaign metadata and tracking
- **`campaign_batches`**: Batch processing management
- **`campaign_data`**: Processed email data (replaces CSV output)
- **`campaign_templates`** ✨ NEW: Visual canvas email templates
- **`template_versions`** ✨ NEW: Version history for undo/redo
- **`test_users`**: Test email recipients
- **`template_components`**: Reusable email components

### Existing Tables Preserved:
- **`college-db-email`**: School data (NOT modified)
- **`college_email_campaign`**: Customer data (NOT modified)

## 🎯 How It Works

### 1. Campaign Setup
1. Create new campaign with template configuration
2. Upload product CSV file (same format as existing system)
3. System processes file using existing logic from `generate_email_campain_data_ready.py`
4. Data enriched with college information and saved to `campaign_data` table
5. Batches created automatically (2,000 emails each)

### 2. Email Generation
- Dynamic HTML templates with 1-4 product slots
- Personalized greetings and school/team information
- Product images, names, prices, and links automatically inserted
- Template components stored in database for reusability

### 3. Batch Sending
- Each batch has individual "Send" button in dashboard
- Lambda function processes one batch at a time
- Records marked as sent to prevent duplicates
- Progress tracking with real-time status updates
- Failed sends tracked separately

### 4. Test System
- Separate test user management
- Send test campaigns to verify before production
- Test emails use same template but don't affect production data

## 🛠️ Development Setup

```bash
# Clone and setup
git clone <repository>
cd email-campaign-manager

# Install dependencies
npm install

# Start development server
npm run dev

# The app will be available at http://localhost:3000
```

## 🔍 File Structure

```
├── setup_database.py              # Database initialization script
├── lambda_campaign_manager.py     # Campaign management Lambda
├── lambda_email_sender.py         # Email sending Lambda  
├── src/
│   ├── config/api.js              # API configuration
│   ├── utils/api.js               # API utilities
│   ├── components/
│   │   └── Layout/                # Main layout component
│   ├── pages/
│   │   ├── Dashboard.jsx          # Main dashboard
│   │   ├── Campaigns.jsx          # Campaign list
│   │   ├── CampaignBuilder.jsx    # Campaign creation/editing
│   │   ├── CampaignDetail.jsx     # Campaign details & batch management
│   │   ├── CollegeManager.jsx     # College database management
│   │   ├── EmailData.jsx          # Email campaign data viewer
│   │   └── TestUsers.jsx          # Test user management
│   └── ...
├── package.json
├── vite.config.js
└── README.md
```

## 🚨 Important Notes

### Security
- AWS credentials are configured in Lambda environment variables
- No credentials stored in frontend code
- API endpoints use CORS for browser security

### Performance
- Batch size optimized for Lambda 10-minute timeout
- Database queries use pagination for large datasets
- File uploads handled via S3 for reliability

### Data Preservation
- **CRITICAL**: Existing DynamoDB tables are never modified
- New system works alongside existing infrastructure
- Original product processing logic preserved

### Error Handling
- Comprehensive error tracking and logging
- Failed batches can be retried individually
- Network errors handled gracefully with user feedback

## 📞 Support

For setup assistance or feature requests, ensure you have:
1. AWS Lambda endpoints configured
2. DynamoDB tables created successfully
3. S3 bucket for file storage
4. SES configured for email sending

## 🎯 Key Benefits

- **Dynamic**: No more hardcoded campaign scripts
- **Scalable**: Handles thousands of emails efficiently  
- **User-Friendly**: Visual interface for campaign management
- **Reliable**: Batch system prevents Lambda timeouts
- **Flexible**: Supports 1-4 products per email automatically
- **Safe**: Preserves existing data and infrastructure