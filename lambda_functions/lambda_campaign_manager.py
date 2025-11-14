"""
Lambda Function: Campaign Manager API
Handles campaign setup, file processing, and template management
this lambda function is invoked to this endpont: https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws/

UPDATED: Now uses OpenAI API (REST only, no dependencies) and pre-built HTML templates

Environment Variables Required:
- AWS_REGION: us-east-1
- COLLEGE_TABLE: college-db-email
- EMAIL_CAMPAIGN_TABLE: college_email_campaign
- S3_BUCKET: your-campaign-files-bucket
- OPENAI_API_KEY: your-openai-api-key (sk-...)

Dependencies (add as Lambda layers):
- boto3
- pandas

AI Model: OpenAI GPT-4 (via REST API)
Template System: Pre-built HTML components from template_components table
"""

import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
import pandas as pd
import re
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from collections import defaultdict
import base64
import os
from io import StringIO
from urllib import request, error
from urllib.parse import urlencode

# Helper function to convert Decimal to int/float for JSON serialization
def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError

# Helper function to convert data types safe for DynamoDB
def convert_to_dynamodb_safe(data):
    """Convert all float values to strings to avoid DynamoDB Decimal issues"""
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            result[key] = convert_to_dynamodb_safe(value)
        return result
    elif isinstance(data, list):
        return [convert_to_dynamodb_safe(item) for item in data]
    elif pd.isna(data):  # Check for NaN/None values
        return ''  # Convert NaN/None to empty string
    elif isinstance(data, float):
        return str(data)  # Convert float to string
    elif isinstance(data, (int, Decimal)):
        return data  # Keep integers and Decimals as-is
    else:
        return str(data) if data is not None else ''  # Convert everything else to string

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
COLLEGE_TABLE = os.environ.get('COLLEGE_TABLE', 'college-db-email')
EMAIL_CAMPAIGN_TABLE = os.environ.get('EMAIL_CAMPAIGN_TABLE', 'college_email_campaign')
S3_BUCKET = os.environ.get('S3_BUCKET', 'layout-tool-randr')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')  # ADD YOUR OPENAI API KEY IN LAMBDA ENVIRONMENT

# Batch configuration - EASILY CONFIGURABLE
EMAILS_PER_BATCH = 2000  # Change this value to adjust batch size
EMAILS_PER_SECOND = 14   # AWS SES rate limit

# Base URL for products (same as in the script)
PRODUCT_BASE_URL = 'https://www.rrinconline.com/products/'

# Initialize AWS services
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
s3 = boto3.client('s3', region_name=AWS_REGION)

def call_openai_api(messages, max_tokens=2000, temperature=0.7):
    """
    Call OpenAI API using pure REST (no dependencies)

    Args:
        messages: List of message dicts with 'role' and 'content'
        max_tokens: Maximum tokens in response
        temperature: Response randomness (0-1)

    Returns:
        str: AI response text
    """
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY environment variable not set. Please add your OpenAI API key to Lambda environment variables.")

    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENAI_API_KEY}'
    }

    payload = {
        'model': 'gpt-4o',  # Using GPT-4o for best quality
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': temperature
    }

    try:
        req = request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method='POST'
        )

        with request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content']

    except error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        logger.error(f"OpenAI API Error: {e.code} - {error_body}")
        raise Exception(f"OpenAI API request failed: {error_body}")
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}")
        raise

def cors_response(status_code, body):
    """Standard CORS response with Decimal handling"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, default=decimal_default)
    }

def lambda_handler(event, context):
    """Main Lambda handler - Updated to support Lambda Function URL events"""
    try:
        logger.info(f"Event: {json.dumps(event)}")
        
        # Handle both API Gateway and Function URL formats
        if 'requestContext' in event and 'http' in event['requestContext']:
            # Lambda Function URL format
            method = event['requestContext']['http']['method']
            path = event.get('rawPath', '/')
            
            # Parse body if it's a string
            if event.get('body') and isinstance(event['body'], str):
                try:
                    event['body'] = json.loads(event['body'])
                except:
                    pass
                    
        else:
            # API Gateway format or direct invocation
            method = event.get('httpMethod', event.get('method', 'GET'))
            path = event.get('path', event.get('rawPath', '/'))
        
        logger.info(f"Method: {method}, Path: {path}")
        
        # Handle CORS preflight
        if method == 'OPTIONS':
            return cors_response(200, {})
        
        # Route requests
        if method == 'POST' and path == '/api/campaigns':
            return create_campaign(event)
        elif method == 'GET' and path == '/api/campaigns':
            return get_campaigns(event)
        elif method == 'PUT' and path.startswith('/api/campaigns/') and not any(x in path for x in ['/upload', '/process', '/batches', '/ai-', '/template', '/versions', '/preview']):
            return update_campaign(event)
        elif method == 'DELETE' and path.startswith('/api/campaigns/') and not any(x in path for x in ['/upload', '/process', '/batches', '/ai-', '/template', '/versions', '/preview']):
            return delete_campaign(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/upload'):
            return upload_products_file(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/process'):
            return process_campaign(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/upload-image'):
            return upload_campaign_image(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/ai-generate'):
            return ai_generate_content(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/ai-edit'):
            return ai_edit_template(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/ai-visual-edit'):
            return ai_visual_edit(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and path.endswith('/template'):
            return get_campaign_template(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and path.endswith('/template-instance'):
            return get_template_instance(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/create-template-instance'):
            return create_template_instance(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and path.endswith('/versions'):
            return get_template_versions(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/restore-version'):
            return restore_template_version(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and path.endswith('/preview-customer'):
            return preview_customer_email(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and '/batches/' in path and '/emails' in path:
            return get_batch_emails(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and '/batches' in path:
            return get_campaign_batches(event)
        elif method == 'GET' and path.startswith('/api/campaigns/'):
            return get_campaign(event)
        elif method == 'GET' and path == '/api/colleges':
            return get_colleges(event)
        elif method == 'GET' and path == '/api/email-campaign-data':
            return get_email_campaign_data(event)
        elif method == 'GET' and path == '/api/test-users':
            return get_test_users(event)
        elif method == 'POST' and path == '/api/test-users':
            return create_test_user(event)
        elif method == 'DELETE' and path.startswith('/api/test-users/'):
            return delete_test_user(event)
        else:
            return cors_response(404, {'error': 'Endpoint not found'})
            
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        return cors_response(500, {'error': str(e)})

def create_campaign(event):
    """Create a new email campaign with template instance"""
    try:
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)
        
        # Validate required fields - template_config is now optional as we'll create default
        required_fields = ['name']
        for field in required_fields:
            if field not in body:
                return cors_response(400, {'error': f'Missing required field: {field}'})
        
        # Generate campaign ID
        campaign_id = str(uuid.uuid4())
        
        # Default template config
        default_template_config = {
            'main_title': 'New Collection Available!',
            'main_image_url': '',
            'description': 'Check out our latest collection selected just for you!',
            'footer_text': 'R and R Imports, Inc',
            'company_address': '5271 Lee Hwy, Troutville, VA 24175-7555 USA',
            'subject': 'New Products Just Dropped!'
        }
        
        # Merge with provided template config
        template_config = default_template_config.copy()
        if 'template_config' in body:
            template_config.update(body['template_config'])
        
        # Prepare campaign data
        campaign_data = {
            'campaign_id': campaign_id,
            'campaign_name': body['name'],
            'description': body.get('description', ''),
            'template_config': template_config,
            'status': 'draft',
            'created_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat(),
            'total_emails': 0,
            'emails_sent': 0,
            'batch_count': 0,
            'campaign_type': body.get('campaign_type', 'product_collection'),
            'file_processed': False,
            'template_instance_created': False,  # NEW: Track template instance status
            'ai_enabled': True  # NEW: Enable AI template editing
        }
        
        # Save campaign to table
        campaigns_table = dynamodb.Table('email_campaigns')
        campaigns_table.put_item(Item=campaign_data)
        
        # Create template instance
        try:
            template_instances_table = dynamodb.Table('campaign_template_instances')
            
            # Get standard template
            standard_template = get_standard_email_template()
            
            # Default template variables
            template_vars = {
                'CAMPAIGN_TITLE': template_config.get('subject', 'New Collection Available!'),
                'COMPANY_NAME': 'R and R Imports, Inc',
                'COMPANY_LOGO_URL': 'https://mcusercontent.com/8351ab2884b2416977322fb0e/images/4f7399b3-f8f9-8d7f-9b1e-4dd0ed5690cb.png',
                'MAIN_TITLE': template_config.get('main_title', 'New Collection Available!'),
                'TITLE_FONT_SIZE': '28px',
                'TITLE_COLOR': '#000000',
                'HERO_IMAGE_URL': template_config.get('main_image_url', ''),
                'HERO_LINK': '#',
                'HERO_ALT_TEXT': 'Campaign Hero Image',
                'GREETING_TEXT': 'Hi there,',
                'DESCRIPTION_TEXT': template_config.get('description', 'Check out our latest collection selected just for you!'),
                'PRODUCTS_TITLE': 'Featured Collection',
                'PRODUCTS_SUBTITLE': 'We\'ve selected these exclusive items just for you!',
                'PRODUCTS_HTML': '<!-- Products will be dynamically inserted here -->',
                'CTA_TEXT': 'Shop Collection',
                'CTA_LINK': '#',
                'CTA_BG_COLOR': '#7ac4c9',
                'CTA_TEXT_COLOR': '#000000',
                'COMPANY_ADDRESS': template_config.get('company_address', '5271 Lee Hwy, Troutville, VA 24175-7555 USA'),
                'UNSUBSCRIBE_URL': 'https://r-and-r-awss3.s3.us-east-1.amazonaws.com/unsuscribe_button.html'
            }
            
            # Apply variables to template
            rendered_html = standard_template
            for key, value in template_vars.items():
                rendered_html = rendered_html.replace('{{' + key + '}}', str(value))
            
            template_instance = {
                'campaign_id': campaign_id,
                'template_html': rendered_html,
                'template_config': template_vars,
                'version_history': [],
                'last_modified': datetime.now().isoformat(),
                'ai_chat_history': [],
                'created_at': datetime.now().isoformat()
            }
            
            template_instances_table.put_item(Item=template_instance)
            
            # Update campaign to mark template instance created
            campaigns_table.update_item(
                Key={'campaign_id': campaign_id},
                UpdateExpression='SET template_instance_created = :created',
                ExpressionAttributeValues={':created': True}
            )
            
            logger.info(f"Created template instance for campaign: {campaign_id}")
            
        except Exception as template_error:
            logger.warning(f"Failed to create template instance: {template_error}")
            # Continue without template instance - can be created later
        
        logger.info(f"Created campaign: {campaign_id}")
        return cors_response(201, campaign_data)
        
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        return cors_response(500, {'error': str(e)})

def get_standard_email_template():
    """Get the standard email template structure"""
    return '''<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<title>{{CAMPAIGN_TITLE}}</title>
<!--[if !mso]><!-->
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--<![endif]-->
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style type="text/css">
#outlook a { padding:0; }
body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
</style>
</head>
<body>
<center>
<table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" style="background-color: #f4f4f4;">
<tbody><tr>
<td align="center" valign="top">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;">
<tbody>

<!-- HEADER SECTION -->
<tr id="header-section"><td style="background-color:#ffffff; padding:12px 48px; text-align:center;">
<img alt="{{COMPANY_NAME}}" src="{{COMPANY_LOGO_URL}}" width="172" height="auto" style="display:block; max-width:100%; height:auto; margin:0 auto;" />
</td></tr>

<!-- MAIN TITLE SECTION -->
<tr id="title-section"><td style="background-color:#ffffff; padding:20px 24px; text-align:center;">
<div style="border-top:2px solid #000000; margin-bottom:20px;"></div>
<h1 style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:{{TITLE_FONT_SIZE}}; font-weight:bold; color:{{TITLE_COLOR}}; margin:0; line-height:1.2;">
{{MAIN_TITLE}}
</h1>
</td></tr>

<!-- HERO IMAGE SECTION -->
<tr id="hero-section"><td style="background-color:#ffffff; padding:12px 0;">
<a href="{{HERO_LINK}}" target="_blank">
<img src="{{HERO_IMAGE_URL}}" alt="{{HERO_ALT_TEXT}}" style="display:block; max-width:100%; height:auto; border-radius:10px;" />
</a>
</td></tr>

<!-- CONTENT SECTION -->
<tr id="content-section"><td style="background-color:#ffffff; padding:12px 24px; text-align:center;">
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:16px; color:#000000; margin:10px 0;">
{{GREETING_TEXT}}
</p>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:16px; color:#000000; margin:10px 0;">
{{DESCRIPTION_TEXT}}
</p>
</td></tr>

<!-- PRODUCTS SECTION -->
<tr id="products-section"><td style="background-color:#ffffff; padding:20px 24px; text-align:center;">
<h2 style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:24px; font-weight:bold; color:#000000; margin:0 0 10px 0;">
{{PRODUCTS_TITLE}}
</h2>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:16px; color:#000000; margin:0 0 20px 0;">
{{PRODUCTS_SUBTITLE}}
</p>

<!-- DYNAMIC PRODUCTS GRID -->
<table align="center" width="100%" style="max-width:600px;">
<tr>
{{PRODUCTS_HTML}}
</tr>
</table>

</td></tr>

<!-- CTA SECTION -->
<tr id="cta-section"><td style="background-color:#ffffff; padding:12px 24px; text-align:center;">
<a href="{{CTA_LINK}}" target="_blank" style="display:inline-block; background-color:{{CTA_BG_COLOR}}; color:{{CTA_TEXT_COLOR}}; padding:16px 28px; text-decoration:none; border-radius:4px; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; font-size:16px; font-weight:bold;">
{{CTA_TEXT}}
</a>
</td></tr>

<tr><td style="background-color:#ffffff;">
<div style="border-top:2px solid #000000; margin:20px 24px;"></div>
</td></tr>

<!-- FOOTER SECTION -->
<tr id="footer-section"><td style="background-color:#1d1d1d; padding:20px 0; text-align:center;">
<table style="margin:0 auto;" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:0 10px;">
<a href="https://www.facebook.com/rrinconline/" target="_blank">
<img width="40" height="40" alt="Facebook" src="https://cdn-images.mailchimp.com/icons/social-block-v3/block-icons-v3/facebook-filled-light-40.png" style="border-radius:50%; display:block;">
</a></td>
<td style="padding:0 10px;">
<a href="https://www.instagram.com/rrinc/" target="_blank">
<img width="40" height="40" alt="Instagram" src="https://cdn-images.mailchimp.com/icons/social-block-v3/block-icons-v3/instagram-filled-light-40.png" style="border-radius:50%; display:block;">
</a></td>
<td style="padding:0 10px;">
<a href="https://www.tiktok.com/@randrinc" target="_blank">
<img width="40" height="40" alt="TikTok" src="https://cdn-images.mailchimp.com/icons/social-block-v3/block-icons-v3/tiktok-filled-light-40.png" style="border-radius:50%; display:block;">
</a></td>
</tr>
</table>
<p style="color:#ffffff; font-size:12px; margin:10px 20px; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
Our mailing address is:<br><strong>{{COMPANY_NAME}}</strong><br>{{COMPANY_ADDRESS}}
</p>
<p style="margin:10px 20px; text-align:center;">
<a href="{{UNSUBSCRIBE_URL}}" style="color:#ffffff; text-decoration:underline; font-size:12px;">Unsubscribe here</a>
</p>
</td></tr>

</tbody></table>
</td></tr></tbody></table>
</center>
</body>
</html>'''

def get_campaigns(event):
    """Get all campaigns"""
    try:
        # Query the correct campaigns table (email_campaigns, not college_email_campaign)
        campaigns_table = dynamodb.Table('email_campaigns')
        response = campaigns_table.scan()
        
        raw_campaigns = response.get('Items', [])
        
        # Transform campaigns to match frontend expectations and convert Decimals
        campaigns = []
        for item in raw_campaigns:
            campaign = {
                'campaign_id': item.get('campaign_id', ''),
                'campaign_name': item.get('campaign_name', item.get('name', 'Untitled Campaign')),  # Ensure campaign_name is always set
                'description': item.get('description', ''),
                'status': item.get('status', 'draft'),
                'created_at': item.get('created_at', ''),
                'updated_at': item.get('updated_at', item.get('last_updated', '')),
                'last_updated': item.get('last_updated', item.get('updated_at', '')),  # Alias for frontend
                'total_emails': int(item.get('total_emails', item.get('total_records', 0))) if isinstance(item.get('total_emails', item.get('total_records', 0)), Decimal) else item.get('total_emails', item.get('total_records', 0)),
                'emails_sent': int(item.get('emails_sent', 0)) if isinstance(item.get('emails_sent', 0), Decimal) else item.get('emails_sent', 0),
                'batch_count': int(item.get('batch_count', item.get('batches_created', 0))) if isinstance(item.get('batch_count', item.get('batches_created', 0)), Decimal) else item.get('batch_count', item.get('batches_created', 0)),
                'campaign_type': item.get('campaign_type', 'product_collection'),
                'template_config': item.get('template_config', {})
            }
            campaigns.append(campaign)
        
        # Sort by created_at descending
        campaigns.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return cors_response(200, {'campaigns': campaigns})
        
    except Exception as e:
        logger.error(f"Error getting campaigns: {e}")
        return cors_response(500, {'error': str(e)})

def get_campaign(event):
    """Get a specific campaign"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}
        
        # Query the correct campaigns table
        campaigns_table = dynamodb.Table('email_campaigns')
        response = campaigns_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Campaign not found'})
        
        return cors_response(200, response['Item'])
        
    except Exception as e:
        logger.error(f"Error getting campaign: {e}")
        return cors_response(500, {'error': str(e)})

def update_campaign(event):
    """Update an existing campaign"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}

        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)

        # Validate campaign exists
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})

        if 'Item' not in campaign_response:
            return cors_response(404, {'error': 'Campaign not found'})

        # Build update expression dynamically based on provided fields
        update_parts = []
        expression_values = {}
        expression_names = {}

        # Always update last_updated timestamp
        update_parts.append('#last_updated = :updated')
        expression_names['#last_updated'] = 'last_updated'
        expression_values[':updated'] = datetime.now().isoformat()

        # Update campaign name if provided
        if 'name' in body:
            update_parts.append('campaign_name = :name')
            expression_values[':name'] = body['name']

        # Update description if provided
        if 'description' in body:
            update_parts.append('description = :desc')
            expression_values[':desc'] = body['description']

        # Update template_config if provided
        if 'template_config' in body:
            update_parts.append('template_config = :config')
            expression_values[':config'] = body['template_config']

        # Update status if provided
        if 'status' in body:
            update_parts.append('#status = :status')
            expression_names['#status'] = 'status'
            expression_values[':status'] = body['status']

        # Update AI-generated content if provided
        if 'ai_generated_content' in body:
            update_parts.append('ai_generated_content = :ai_content')
            expression_values[':ai_content'] = body['ai_generated_content']

        # Update product type if provided
        if 'product_type' in body:
            update_parts.append('product_type = :ptype')
            expression_values[':ptype'] = body['product_type']

        if not update_parts:
            return cors_response(400, {'error': 'No fields to update'})

        # Execute update
        update_expression = 'SET ' + ', '.join(update_parts)

        update_kwargs = {
            'Key': {'campaign_id': campaign_id},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_values,
            'ReturnValues': 'ALL_NEW'
        }

        if expression_names:
            update_kwargs['ExpressionAttributeNames'] = expression_names

        response = campaigns_table.update_item(**update_kwargs)

        logger.info(f"Updated campaign: {campaign_id}")
        return cors_response(200, {
            'message': 'Campaign updated successfully',
            'campaign': response['Attributes']
        })

    except Exception as e:
        logger.error(f"Error updating campaign: {e}")
        return cors_response(500, {'error': str(e)})

def upload_products_file(event):
    """Upload and process products CSV file"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/upload
        
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)
        
        file_content = body.get('file_content')
        filename = body.get('file_name', body.get('filename', 'upload.csv'))  # Accept both parameter names
        
        if not file_content:
            return cors_response(400, {'error': 'No file content provided'})
        
        # Decode base64 file content
        try:
            csv_content = base64.b64decode(file_content).decode('utf-8')
        except Exception as e:
            return cors_response(400, {'error': 'Invalid file content'})
        
        # Parse CSV
        try:
            df = pd.read_csv(StringIO(csv_content))
        except Exception as e:
            return cors_response(400, {'error': f'Error parsing CSV: {str(e)}'})
        
        # This is a product CSV file, not a customer list
        # Required columns for product processing (same as the script)
        required_columns = [
            'Variant SKU', 'Handle', 'Title', 'Option1 Name', 
            'Option1 Value', 'Variant Price', 'Image Src'
        ]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return cors_response(400, {'error': f'Missing required columns: {missing_columns}. This should be a Shopify product export file with all required columns.'})
        
        # Save file to S3
        s3_key = f"campaigns/{campaign_id}/{filename}"
        try:
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=csv_content,
                ContentType='text/csv'
            )
        except Exception as e:
            logger.error(f"Error uploading to S3: {e}")
            return cors_response(500, {'error': 'Failed to save file'})
        
        # Update campaign with file info
        campaigns_table = dynamodb.Table('email_campaigns')
        campaigns_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET file_s3_key = :key, total_emails = :total, last_updated = :updated',
            ExpressionAttributeValues={
                ':key': s3_key,
                ':total': len(df),
                ':updated': datetime.now().isoformat()
            }
        )
        
        return cors_response(200, {
            'message': 'File uploaded successfully',
            'records_count': len(df),
            's3_key': s3_key
        })
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return cors_response(500, {'error': str(e)})

def upload_campaign_image(event):
    """Upload campaign image to S3 without ACL"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/upload-image

        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)

        image_content = body.get('image_content')
        filename = body.get('file_name', body.get('filename', 'campaign-image.jpg'))
        content_type = body.get('content_type', 'image/jpeg')

        if not image_content:
            return cors_response(400, {'error': 'No image content provided'})

        # Decode base64 image content
        try:
            image_data = base64.b64decode(image_content)
        except Exception as e:
            return cors_response(400, {'error': 'Invalid image content'})

        # Save image to S3 WITHOUT ACL (this was causing the error)
        s3_key = f"campaigns/{campaign_id}/images/{filename}"
        try:
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=image_data,
                ContentType=content_type
                # ACL removed - bucket doesn't allow ACLs
            )
        except Exception as e:
            logger.error(f"Error uploading image to S3: {e}")
            return cors_response(500, {'error': f'Failed to upload image: {str(e)}'})

        # Generate public URL (assumes bucket has proper public read policy)
        image_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"

        # Update campaign with image URL
        campaigns_table = dynamodb.Table('email_campaigns')
        campaigns_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET template_config.main_image_url = :url, last_updated = :updated',
            ExpressionAttributeValues={
                ':url': image_url,
                ':updated': datetime.now().isoformat()
            }
        )

        return cors_response(200, {
            'message': 'Image uploaded successfully',
            'image_url': image_url,
            's3_key': s3_key
        })

    except Exception as e:
        logger.error(f"Error uploading campaign image: {e}")
        return cors_response(500, {'error': str(e)})

def process_campaign(event):
    """Process campaign data: extract products, match with customers, create batches"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/process
        
        # Get campaign
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in campaign_response:
            return cors_response(404, {'error': 'Campaign not found'})
        
        campaign = campaign_response['Item']
        s3_key = campaign.get('file_s3_key')
        
        if not s3_key:
            return cors_response(400, {'error': 'No file uploaded for this campaign'})
        
        # Download product file from S3
        try:
            response = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
            csv_content = response['Body'].read().decode('utf-8')
        except Exception as e:
            logger.error(f"Error downloading from S3: {e}")
            return cors_response(500, {'error': 'Failed to retrieve file'})
        
        # Parse product CSV
        products_df = pd.read_csv(StringIO(csv_content))
        logger.info(f"Loaded {len(products_df)} product records")
        
        # Get college data for school code matching
        colleges_table = dynamodb.Table(COLLEGE_TABLE)
        colleges_response = colleges_table.scan()
        colleges_dict = {item['school_code']: item for item in colleges_response.get('Items', [])}
        school_codes = list(colleges_dict.keys())
        logger.info(f"Found {len(school_codes)} school codes: {school_codes}")
        
        def extract_school_code(sku):
            """Extract school code from SKU using the exact same logic as the script."""
            if pd.isna(sku) or not sku:
                return ''
            
            sku = str(sku).strip()
            
            # Pattern 1: C-CUST-{CODE}{NUMBER}
            match = re.search(r'C-CUST-([A-Za-z]+)(?=\d)', sku)
            if match:
                return match.group(1).strip()
            
            # Pattern 2: -C-{CODE}{NUMBER}
            match = re.search(r'-C-([A-Za-z]+)(?=\d)', sku)
            if match:
                return match.group(1).strip()
            
            # Pattern 3: -C-{CODE} (no number follows)
            match = re.search(r'-C-([A-Za-z]+)', sku)
            if match:
                return match.group(1).strip()
            
            return ''
        
        def process_handle_groups(df):
            """Process products grouped by Handle with INCH pattern logic - simplified version"""
            logger.info("Processing handle groups...")
            
            has_option2 = 'Option2 Name' in df.columns and 'Option2 Value' in df.columns
            handle_groups = df.groupby('Handle')
            rows_to_keep = []
            
            for handle, group in handle_groups:
                group = group.copy()
                
                # Check for INCH patterns
                has_inch_option1 = any('inch' in str(val).lower() for val in group['Option1 Value'].dropna())
                has_inch_option2 = False
                if has_option2:
                    has_inch_option2 = any('inch' in str(val).lower() for val in group['Option2 Value'].dropna())
                
                # Get base title
                title_rows = group[group['Title'].notna() & (group['Title'] != '')]
                if len(title_rows) == 0:
                    rows_to_keep.extend(group.to_dict('records'))
                    continue
                
                base_title = title_rows.iloc[0]['Title']
                
                if has_inch_option1 or has_inch_option2:
                    # Has INCH - keep lowest price variant
                    group['price_numeric'] = pd.to_numeric(group['Variant Price'], errors='coerce')
                    min_price_idx = group['price_numeric'].idxmin()
                    min_price_row = group.loc[min_price_idx].copy()
                    
                    # Build title with options
                    option1_val = str(min_price_row['Option1 Value']) if pd.notna(min_price_row['Option1 Value']) else ''
                    option2_val = str(min_price_row['Option2 Value']) if pd.notna(min_price_row['Option2 Value']) and has_option2 else ''
                    
                    title_parts = [base_title]
                    if option1_val:
                        title_parts.append(option1_val)
                    if option2_val:
                        title_parts.append(option2_val)
                    
                    min_price_row['Title'] = ' '.join(title_parts)
                    min_price_row = min_price_row.drop('price_numeric')
                    rows_to_keep.append(min_price_row.to_dict())
                else:
                    # No INCH pattern - keep all variants
                    for idx, row in group.iterrows():
                        row_dict = row.to_dict()
                        
                        if pd.isna(row_dict['Title']) or row_dict['Title'] == '':
                            option1_val = str(row['Option1 Value']) if pd.notna(row['Option1 Value']) else ''
                            option2_val = str(row['Option2 Value']) if pd.notna(row['Option2 Value']) and has_option2 else ''
                            
                            title_parts = [base_title]
                            if option1_val:
                                title_parts.append(option1_val)
                            if option2_val:
                                title_parts.append(option2_val)
                            
                            row_dict['Title'] = ' '.join(title_parts)
                        
                        rows_to_keep.append(row_dict)
            
            return pd.DataFrame(rows_to_keep)
        
        # Extract school codes using the exact same logic
        products_df['school_code'] = products_df['Variant SKU'].apply(extract_school_code)
        logger.info(f"Extracted {(products_df['school_code'] != '').sum()} school codes from SKUs")
        
        # Process handle groups (simplified version for lambda)
        products_df = process_handle_groups(products_df)
        
        # Enrich with college data
        for idx, row in products_df.iterrows():
            school_code = str(row['school_code']).strip() if pd.notna(row['school_code']) else ''
            if school_code and school_code in colleges_dict:
                college_info = colleges_dict[school_code]
                products_df.at[idx, 'school_name'] = college_info.get('school_name', '')
                products_df.at[idx, 'school_page'] = college_info.get('school_page', '')
                products_df.at[idx, 'school_logo'] = college_info.get('school_logo', '')
                products_df.at[idx, 'has_match'] = True
            else:
                products_df.at[idx, 'has_match'] = False
        
        # Filter to only products with school matches and images
        products_df = products_df[products_df['has_match']].copy()
        products_df = products_df[products_df['Image Src'].notna() & (products_df['Image Src'] != '')].copy()
        
        logger.info(f"After filtering: {len(products_df)} products with school matches and images")
        
        # Group products by school code
        products_by_school = {}
        for idx, row in products_df.iterrows():
            school_code = str(row['school_code']).strip()
            if school_code:
                if school_code not in products_by_school:
                    products_by_school[school_code] = []
                
                # Extract product info using exact same format as the script
                # Convert price to string to avoid DynamoDB Decimal issues
                price = row.get('Variant Price', '')
                if isinstance(price, (int, float)):
                    price = str(price)
                
                product_info = {
                    'handle': row.get('Handle', ''),
                    'title': row.get('Title', ''),
                    'price': price,
                    'image': row.get('Image Src', ''),
                    'school_page': row.get('school_page', ''),
                    'school_logo': row.get('school_logo', '')
                }
                products_by_school[school_code].append(product_info)
        
        logger.info(f"Extracted products for {len(products_by_school)} schools: {list(products_by_school.keys())}")
        
        # Get customer emails for matched school codes
        email_table = dynamodb.Table(EMAIL_CAMPAIGN_TABLE)
        
        campaign_data_table = dynamodb.Table('campaign_data')
        batches_table = dynamodb.Table('campaign_batches')
        
        batch_number = 1
        batch_records = []
        total_records = 0
        
        for school_code, products in products_by_school.items():
            # Get customers for this school
            try:
                response = email_table.scan(
                    FilterExpression=Attr('school_code').eq(school_code)
                )
                customers = response.get('Items', [])
                logger.info(f"Found {len(customers)} customers for school {school_code}")
                
                # Create email records for each customer with products (matching the script's enrichment logic)
                for customer in customers:
                    record_id = f"{campaign_id}_{total_records}"
                    total_records += 1
                    
                    # Get college info
                    college_info = colleges_dict.get(school_code, {})
                    
                    # Prepare record data using exact same structure as the script
                    record_data = {
                        'campaign_id': campaign_id,
                        'record_id': record_id,
                        'batch_number': batch_number,
                        'customer_email': customer.get('customer_email', ''),
                        'customer_name': customer.get('customer_name', ''),
                        'school_code': school_code,
                        'source': customer.get('source', ''),  # Include source from customer data
                        'email_sent': False,
                        'created_at': datetime.now().isoformat()
                    }
                    
                    # Add up to 4 products using exact same format as email sender expects
                    max_products = 4
                    for i in range(1, max_products + 1):
                        record_data[f'product_link_{i}'] = ''
                        record_data[f'product_image_{i}'] = ''  # Changed from image_link to match email sender
                        record_data[f'product_price_{i}'] = ''
                        record_data[f'product_name_{i}'] = ''  # Changed from title to match email sender

                    # Add school page and logo (same for all products of same school)
                    record_data['school_page'] = ''
                    record_data['school_logo'] = ''

                    # Fill in product data (up to 4 products)
                    for i, product in enumerate(products[:max_products], start=1):
                        record_data[f'product_link_{i}'] = f"{PRODUCT_BASE_URL}{product['handle']}"
                        record_data[f'product_image_{i}'] = product['image']  # Changed from image_link
                        record_data[f'product_price_{i}'] = product['price']
                        record_data[f'product_name_{i}'] = product['title']  # Changed from title
                    
                    # Add school page and logo from first product
                    if products:
                        record_data['school_page'] = products[0]['school_page']
                        record_data['school_logo'] = products[0]['school_logo']
                    
                    # Convert all data to DynamoDB-safe types
                    safe_record_data = convert_to_dynamodb_safe(record_data)
                    batch_records.append(safe_record_data)
                    
                    # If batch is full, save it
                    if len(batch_records) >= EMAILS_PER_BATCH:
                        # Save batch records
                        with campaign_data_table.batch_writer() as batch:
                            for record in batch_records:
                                batch.put_item(Item=record)
                        
                        # Create batch entry
                        batches_table.put_item(Item={
                            'campaign_id': campaign_id,
                            'batch_number': batch_number,
                            'status': 'ready',
                            'total_emails': len(batch_records),
                            'emails_sent': 0,
                            'created_at': datetime.now().isoformat()
                        })
                        
                        batch_number += 1
                        batch_records = []
                        
            except Exception as e:
                logger.error(f"Error processing school {school_code}: {e}")
                continue
        
        # Save remaining records
        total_batches = batch_number - 1
        if batch_records:
            with campaign_data_table.batch_writer() as batch:
                for record in batch_records:
                    batch.put_item(Item=record)
            
            batches_table.put_item(Item={
                'campaign_id': campaign_id,
                'batch_number': batch_number,
                'status': 'ready',
                'total_emails': len(batch_records),
                'emails_sent': 0,
                'created_at': datetime.now().isoformat()
            })
            
            total_batches = batch_number
        
        # Update campaign status
        campaigns_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET #status = :status, batch_count = :batches, total_emails = :total, last_updated = :updated, file_processed = :processed',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'ready',
                ':batches': total_batches,
                ':total': total_records,
                ':updated': datetime.now().isoformat(),
                ':processed': True
            }
        )
        
        return cors_response(200, {
            'message': 'Campaign processed successfully',
            'total_batches': total_batches,
            'total_records': total_records,
            'schools_processed': len(products_by_school),
            'products_found': sum(len(products) for products in products_by_school.values())
        })
        
    except Exception as e:
        logger.error(f"Error processing campaign: {e}")
        return cors_response(500, {'error': str(e)})

def get_campaign_batches(event):
    """Get batches for a campaign"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/batches
        
        batches_table = dynamodb.Table('campaign_batches')
        response = batches_table.query(
            KeyConditionExpression=Key('campaign_id').eq(campaign_id)
        )
        
        batches = response.get('Items', [])
        batches.sort(key=lambda x: x.get('batch_number', 0))
        
        return cors_response(200, {'batches': batches})
        
    except Exception as e:
        logger.error(f"Error getting campaign batches: {e}")
        return cors_response(500, {'error': str(e)})

def get_batch_emails(event):
    """Get emails for a specific batch"""
    try:
        # Extract campaign_id and batch_number from path
        # Path format: /api/campaigns/{campaign_id}/batches/{batch_number}/emails
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]
        batch_number = int(path_parts[5])

        # Parse query parameters for pagination
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 50)), 100)
        last_key = query_params.get('lastKey')

        # Query emails from EMAIL_CAMPAIGN_TABLE based on batch
        email_table = dynamodb.Table(EMAIL_CAMPAIGN_TABLE)

        # Build query parameters
        query_kwargs = {
            'IndexName': 'CampaignBatchIndex',  # Assumes GSI exists on campaign_id+batch_number
            'KeyConditionExpression': Key('campaign_id').eq(campaign_id) & Key('batch_number').eq(batch_number),
            'Limit': limit
        }

        if last_key:
            try:
                query_kwargs['ExclusiveStartKey'] = json.loads(last_key)
            except:
                pass

        # Query the emails
        try:
            response = email_table.query(**query_kwargs)
        except Exception as e:
            # If GSI doesn't exist or query fails, fallback to scan with filter
            logger.warning(f"Query failed, using scan fallback: {e}")
            scan_kwargs = {
                'FilterExpression': Attr('campaign_id').eq(campaign_id) & Attr('batch_number').eq(batch_number),
                'Limit': limit
            }
            if last_key:
                try:
                    scan_kwargs['ExclusiveStartKey'] = json.loads(last_key)
                except:
                    pass
            response = email_table.scan(**scan_kwargs)

        emails = response.get('Items', [])
        next_key = response.get('LastEvaluatedKey')

        return cors_response(200, {
            'emails': emails,
            'next_key': json.dumps(next_key) if next_key else None,
            'has_more': next_key is not None,
            'count': len(emails)
        })

    except Exception as e:
        logger.error(f"Error getting batch emails: {e}")
        return cors_response(500, {'error': str(e)})

def get_colleges(event):
    """Get all colleges"""
    try:
        colleges_table = dynamodb.Table(COLLEGE_TABLE)
        response = colleges_table.scan()
        
        colleges = response.get('Items', [])
        colleges.sort(key=lambda x: x.get('school_name', ''))
        
        return cors_response(200, {'colleges': colleges})
        
    except Exception as e:
        logger.error(f"Error getting colleges: {e}")
        return cors_response(500, {'error': str(e)})

def get_email_campaign_data(event):
    """Get customer email data with pagination - this returns customer emails, not campaigns"""
    try:
        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}
        limit = min(int(query_params.get('limit', 300)), 300)  # Set default to 300, max 300
        page = int(query_params.get('page', 1))
        
        # Get data from college_email_campaign table (customer email data)
        email_table = dynamodb.Table(EMAIL_CAMPAIGN_TABLE)
        
        # First, get table metadata for total count
        table_description = email_table.meta.client.describe_table(TableName=EMAIL_CAMPAIGN_TABLE)
        total_items = table_description['Table'].get('ItemCount', 0)
        
        scan_kwargs = {
            'Limit': limit
        }
        
        # Add pagination if provided
        if 'last_key' in query_params and query_params['last_key']:
            try:
                # Decode the last_key if it's base64 encoded
                import base64
                last_key_str = query_params['last_key']
                try:
                    # Try to decode if it's base64
                    decoded = base64.b64decode(last_key_str).decode('utf-8')
                    last_key = json.loads(decoded)
                except:
                    # If not base64, try direct JSON parsing
                    last_key = json.loads(last_key_str)
                scan_kwargs['ExclusiveStartKey'] = last_key
            except Exception as e:
                logger.warning(f"Error parsing last_key: {e}")
        
        # Scan for current page
        response = email_table.scan(**scan_kwargs)
        items = response.get('Items', [])
        
        # Convert Decimal values to regular numbers
        converted_items = []
        for item in items:
            converted_item = {}
            for key, value in item.items():
                if isinstance(value, Decimal):
                    converted_item[key] = int(value) if value % 1 == 0 else float(value)
                else:
                    converted_item[key] = value
            converted_items.append(converted_item)
        
        # Count by source for dashboard statistics (only from current page for performance)
        source_counts = {}
        for item in converted_items:
            source = item.get('source', 'Unknown')
            source_counts[source] = source_counts.get(source, 0) + 1
        
        # Calculate pagination info
        total_pages = (total_items + limit - 1) // limit  # Ceiling division
        has_more = 'LastEvaluatedKey' in response
        
        # Prepare last_key for next page
        next_key = None
        if has_more:
            # Encode the last key as base64 for safe URL transmission
            import base64
            last_key_json = json.dumps(response['LastEvaluatedKey'], default=decimal_default)
            next_key = base64.b64encode(last_key_json.encode()).decode()
        
        result = {
            'items': converted_items,
            'count': len(converted_items),
            'total_items': total_items,
            'total_pages': total_pages,
            'current_page': page,
            'page_size': limit,
            'has_more': has_more,
            'next_key': next_key,
            'source_counts': source_counts
        }
        
        return cors_response(200, result)
        
    except Exception as e:
        logger.error(f"Error getting email campaign data: {e}")
        return cors_response(500, {'error': str(e)})

def get_test_users(event):
    """Get all test users"""
    try:
        test_users_table = dynamodb.Table('test_users')
        response = test_users_table.scan()
        
        users = response.get('Items', [])
        users.sort(key=lambda x: x.get('name', ''))
        
        return cors_response(200, {'users': users})
        
    except Exception as e:
        logger.error(f"Error getting test users: {e}")
        return cors_response(500, {'error': str(e)})

def create_test_user(event):
    """Create a new test user"""
    try:
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)
        
        # Validate required fields
        required_fields = ['email', 'name']
        for field in required_fields:
            if field not in body:
                return cors_response(400, {'error': f'Missing required field: {field}'})
        
        # Prepare user data
        user_data = {
            'email': body['email'],
            'name': body['name'],
            'school_code': body.get('school_code', 'TEST'),
            'active': True,
            'created_at': datetime.now().isoformat()
        }
        
        # Save to DynamoDB
        test_users_table = dynamodb.Table('test_users')
        test_users_table.put_item(Item=user_data)
        
        return cors_response(201, user_data)
        
    except Exception as e:
        logger.error(f"Error creating test user: {e}")
        return cors_response(500, {'error': str(e)})

def delete_test_user(event):
    """Delete a test user"""
    try:
        # Extract email from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        email = path_parts[3]  # /api/test-users/{email}

        test_users_table = dynamodb.Table('test_users')
        test_users_table.delete_item(Key={'email': email})

        return cors_response(200, {'message': 'Test user deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting test user: {e}")
        return cors_response(500, {'error': str(e)})

def delete_campaign(event):
    """Delete a campaign and all related data"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}

        logger.info(f"Deleting campaign: {campaign_id}")

        # Get campaign to check if it exists and get S3 key
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})

        if 'Item' not in campaign_response:
            return cors_response(404, {'error': 'Campaign not found'})

        campaign = campaign_response['Item']

        # Check if campaign is currently sending
        if campaign.get('status') == 'sending':
            return cors_response(400, {'error': 'Cannot delete campaign while sending. Please wait for sending to complete.'})

        # Delete from campaign_data table
        campaign_data_table = dynamodb.Table('campaign_data')
        try:
            # Query all records for this campaign
            response = campaign_data_table.query(
                KeyConditionExpression=Key('campaign_id').eq(campaign_id)
            )

            # Batch delete records
            with campaign_data_table.batch_writer() as batch:
                for item in response.get('Items', []):
                    batch.delete_item(Key={
                        'campaign_id': item['campaign_id'],
                        'record_id': item['record_id']
                    })

            logger.info(f"Deleted {len(response.get('Items', []))} records from campaign_data")
        except Exception as e:
            logger.warning(f"Error deleting campaign_data: {e}")

        # Delete from campaign_batches table
        batches_table = dynamodb.Table('campaign_batches')
        try:
            response = batches_table.query(
                KeyConditionExpression=Key('campaign_id').eq(campaign_id)
            )

            with batches_table.batch_writer() as batch:
                for item in response.get('Items', []):
                    batch.delete_item(Key={
                        'campaign_id': item['campaign_id'],
                        'batch_number': item['batch_number']
                    })

            logger.info(f"Deleted {len(response.get('Items', []))} batches from campaign_batches")
        except Exception as e:
            logger.warning(f"Error deleting campaign_batches: {e}")

        # Delete templates
        templates_table = dynamodb.Table('campaign_templates')
        try:
            response = templates_table.query(
                IndexName='CampaignIndex',
                KeyConditionExpression=Key('campaign_id').eq(campaign_id)
            )

            for item in response.get('Items', []):
                templates_table.delete_item(Key={'template_id': item['template_id']})

            logger.info(f"Deleted {len(response.get('Items', []))} templates")
        except Exception as e:
            logger.warning(f"Error deleting templates: {e}")

        # Delete template versions
        versions_table = dynamodb.Table('template_versions')
        try:
            response = versions_table.query(
                IndexName='CampaignVersionIndex',
                KeyConditionExpression=Key('campaign_id').eq(campaign_id)
            )

            for item in response.get('Items', []):
                versions_table.delete_item(Key={'version_id': item['version_id']})

            logger.info(f"Deleted {len(response.get('Items', []))} template versions")
        except Exception as e:
            logger.warning(f"Error deleting template versions: {e}")

        # Delete S3 file if exists
        s3_key = campaign.get('file_s3_key')
        if s3_key:
            try:
                s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)
                logger.info(f"Deleted S3 file: {s3_key}")
            except Exception as e:
                logger.warning(f"Error deleting S3 file: {e}")

        # Finally, delete the campaign itself
        campaigns_table.delete_item(Key={'campaign_id': campaign_id})

        logger.info(f"Successfully deleted campaign: {campaign_id}")
        return cors_response(200, {'message': 'Campaign deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting campaign: {e}")
        return cors_response(500, {'error': str(e)})

def ai_generate_content(event):
    """Generate campaign METADATA ONLY using OpenAI - templates come from database"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/ai-generate

        # Get campaign
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})

        if 'Item' not in campaign_response:
            return cors_response(404, {'error': 'Campaign not found'})

        campaign = campaign_response['Item']
        s3_key = campaign.get('file_s3_key')

        if not s3_key:
            return cors_response(400, {'error': 'No product file uploaded yet'})

        # Download and parse product file
        response = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
        csv_content = response['Body'].read().decode('utf-8')
        products_df = pd.read_csv(StringIO(csv_content))

        # Extract sample product info for AI (first 5 products)
        sample_products = []
        for _, row in products_df.head(5).iterrows():
            sample_products.append({
                'title': row.get('Title', ''),
                'price': row.get('Variant Price', ''),
                'sku': row.get('Variant SKU', ''),
                'option': row.get('Option1 Value', '')
            })

        # Create AI prompt - ONLY for metadata generation
        prompt = f"""You are a professional email marketing copywriter. Analyze these product samples from a college merchandise campaign and generate compelling campaign metadata.

Product Samples:
{json.dumps(sample_products, indent=2)}

IMPORTANT RULES:
1. DO NOT include any specific college/school names in the content
2. Content should be generic and work for ANY college
3. Identify the product type (hats, apparel, accessories, etc.)
4. Keep all text professional and engaging

Generate the following metadata in JSON format:

{{
  "campaign_title": "A catchy campaign name (max 60 characters)",
  "subject_lines": ["5 different subject lines, each max 50 characters"],
  "main_headline": "Email main headline (max 80 characters, exciting)",
  "description": "2-3 sentence description about this product collection (generic, no school names)",
  "cta_text": "Call-to-action button text (short, actionable, max 20 characters)",
  "product_type": "Type of products detected (e.g., 'hats', 'apparel', 'accessories')"
}}

Output ONLY the JSON, no other text."""

        # Call OpenAI API
        messages = [
            {
                'role': 'system',
                'content': 'You are a professional email marketing expert who creates compelling campaign metadata. Always output valid JSON only.'
            },
            {
                'role': 'user',
                'content': prompt
            }
        ]

        ai_response_text = call_openai_api(messages, max_tokens=800, temperature=0.7)

        # Parse AI response
        try:
            # Extract JSON from response (in case AI adds markdown formatting)
            json_match = re.search(r'\{.*\}', ai_response_text, re.DOTALL)
            if json_match:
                ai_content = json.loads(json_match.group())
            else:
                ai_content = json.loads(ai_response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {ai_response_text}")
            # Use fallback values
            ai_content = {
                'campaign_title': 'New Collection Available',
                'subject_lines': ['Check out our latest collection!'],
                'main_headline': 'New Products Just Dropped!',
                'description': 'Discover our latest collection of high-quality merchandise.',
                'cta_text': 'Shop Now',
                'product_type': 'merchandise'
            }

        # Update campaign with AI-generated metadata
        campaigns_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET ai_generated_content = :content, last_updated = :updated, product_type = :ptype',
            ExpressionAttributeValues={
                ':content': ai_content,
                ':updated': datetime.now().isoformat(),
                ':ptype': ai_content.get('product_type', 'merchandise')
            }
        )

        logger.info(f"AI generated metadata for campaign {campaign_id}")
        return cors_response(200, {
            'message': 'Metadata generated successfully',
            'content': ai_content,
            'note': 'Email template will use pre-built HTML components from database'
        })

    except Exception as e:
        logger.error(f"Error generating AI content: {e}")
        return cors_response(500, {'error': str(e)})

def ai_edit_template(event):
    """Edit email template using AI based on natural language request"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]

        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)

        user_request = body.get('request', '')
        if not user_request:
            return cors_response(400, {'error': 'request field is required'})

        # Get current template
        templates_table = dynamodb.Table('campaign_templates')
        response = templates_table.query(
            IndexName='CampaignIndex',
            KeyConditionExpression=Key('campaign_id').eq(campaign_id),
            ScanIndexForward=False,
            Limit=1
        )

        current_template = None
        if response.get('Items'):
            current_template = response['Items'][0]
        else:
            # Create default template if none exists
            current_template = {
                'template_id': str(uuid.uuid4()),
                'campaign_id': campaign_id,
                'components': [
                    {'id': 'header', 'type': 'header', 'editable': True, 'content': {}},
                    {'id': 'hero', 'type': 'hero_section', 'editable': True, 'content': {}},
                    {'id': 'greeting', 'type': 'text_block', 'editable': True, 'content': {}},
                    {'id': 'products', 'type': 'product_grid', 'editable': True, 'content': {}},
                    {'id': 'cta', 'type': 'call_to_action', 'editable': True, 'content': {}},
                    {'id': 'footer', 'type': 'footer', 'editable': True, 'content': {}}
                ],
                'version_number': 1,
                'is_active': True,
                'created_at': datetime.now().isoformat(),
                'created_by': 'system'
            }

        # Save current version before making changes
        versions_table = dynamodb.Table('template_versions')
        version_id = str(uuid.uuid4())
        versions_table.put_item(Item={
            'version_id': version_id,
            'campaign_id': campaign_id,
            'template_data': current_template,
            'change_description': f'Before: {user_request}',
            'previous_version_id': current_template.get('version_id', ''),
            'created_at': datetime.now().isoformat()
        })

        # Call Claude Sonnet 4.5 for intelligent editing
        bedrock = boto3.client('bedrock-runtime', region_name=AWS_REGION)

        system_prompt = f"""You are an expert email template editor.

Current template structure:
{json.dumps(current_template.get('components', []), indent=2)}

User request: "{user_request}"

Instructions:
1. Make ONLY the requested changes
2. Preserve all dynamic fields like {{{{customer_name}}}}
3. Maintain responsive email HTML structure
4. Return ONLY the modified components (not the entire template)
5. Explain what you changed

Output as JSON:
{{
  "modified_components": [
    {{"id": "component_id", "type": "...", "editable": true, "content": {{...}}}}
  ],
  "change_description": "Brief description of changes made",
  "confidence": 0.95
}}"""

        # Use inference profile ARN instead of model ID for on-demand throughput
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-sonnet-4-5-v1:0',  # Inference profile ARN
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "system": system_prompt,
                "messages": [
                    {
                        "role": "user",
                        "content": user_request
                    }
                ],
                "temperature": 0.3
            })
        )

        result = json.loads(response['body'].read())
        ai_response = json.loads(result['content'][0]['text'])

        # Apply changes to template
        components = current_template.get('components', [])
        for modified in ai_response.get('modified_components', []):
            for i, comp in enumerate(components):
                if comp['id'] == modified['id']:
                    components[i] = modified
                    break

        # Save updated template
        new_template_id = str(uuid.uuid4())
        new_template = {
            'template_id': new_template_id,
            'campaign_id': campaign_id,
            'components': components,
            'version_number': current_template.get('version_number', 1) + 1,
            'is_active': True,
            'created_at': datetime.now().isoformat(),
            'created_by': 'ai'
        }

        templates_table.put_item(Item=new_template)

        # Mark old template as inactive
        if current_template.get('template_id'):
            templates_table.update_item(
                Key={'template_id': current_template['template_id']},
                UpdateExpression='SET is_active = :inactive',
                ExpressionAttributeValues={':inactive': False}
            )

        logger.info(f"AI edited template for campaign {campaign_id}: {ai_response.get('change_description')}")
        return cors_response(200, {
            'message': 'Template updated successfully',
            'template': new_template,
            'change_description': ai_response.get('change_description'),
            'version_id': version_id
        })

    except Exception as e:
        logger.error(f"Error in AI template editing: {e}")
        return cors_response(500, {'error': str(e)})

def get_campaign_template(event):
    """Get active email template for campaign"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]

        templates_table = dynamodb.Table('campaign_templates')
        response = templates_table.query(
            IndexName='CampaignIndex',
            KeyConditionExpression=Key('campaign_id').eq(campaign_id),
            FilterExpression=Attr('is_active').eq(True),
            ScanIndexForward=False,
            Limit=1
        )

        if response.get('Items'):
            return cors_response(200, {'template': response['Items'][0]})
        else:
            return cors_response(404, {'error': 'No active template found'})

    except Exception as e:
        logger.error(f"Error getting template: {e}")
        return cors_response(500, {'error': str(e)})

def get_template_versions(event):
    """Get version history for campaign template"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]

        versions_table = dynamodb.Table('template_versions')
        response = versions_table.query(
            IndexName='CampaignVersionIndex',
            KeyConditionExpression=Key('campaign_id').eq(campaign_id),
            ScanIndexForward=False,
            Limit=50  # Last 50 versions
        )

        versions = response.get('Items', [])
        return cors_response(200, {'versions': versions, 'count': len(versions)})

    except Exception as e:
        logger.error(f"Error getting versions: {e}")
        return cors_response(500, {'error': str(e)})

def restore_template_version(event):
    """Restore a previous template version (undo functionality)"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]

        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)

        version_id = body.get('version_id')
        if not version_id:
            return cors_response(400, {'error': 'version_id is required'})

        # Get version to restore
        versions_table = dynamodb.Table('template_versions')
        version_response = versions_table.get_item(Key={'version_id': version_id})

        if 'Item' not in version_response:
            return cors_response(404, {'error': 'Version not found'})

        version_data = version_response['Item']
        template_data = version_data.get('template_data', {})

        # Create new template from old version
        templates_table = dynamodb.Table('campaign_templates')
        new_template_id = str(uuid.uuid4())

        restored_template = {
            'template_id': new_template_id,
            'campaign_id': campaign_id,
            'components': template_data.get('components', []),
            'version_number': template_data.get('version_number', 1) + 1,
            'is_active': True,
            'created_at': datetime.now().isoformat(),
            'created_by': 'user_restore'
        }

        templates_table.put_item(Item=restored_template)

        # Mark current template as inactive
        response = templates_table.query(
            IndexName='CampaignIndex',
            KeyConditionExpression=Key('campaign_id').eq(campaign_id),
            FilterExpression=Attr('is_active').eq(True)
        )

        for item in response.get('Items', []):
            if item['template_id'] != new_template_id:
                templates_table.update_item(
                    Key={'template_id': item['template_id']},
                    UpdateExpression='SET is_active = :inactive',
                    ExpressionAttributeValues={':inactive': False}
                )

        logger.info(f"Restored version {version_id} for campaign {campaign_id}")
        return cors_response(200, {
            'message': 'Version restored successfully',
            'template': restored_template
        })

    except Exception as e:
        logger.error(f"Error restoring version: {e}")
        return cors_response(500, {'error': str(e)})

def preview_customer_email(event):
    """Preview what a specific customer will receive"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')

        path_parts = path.split('/')
        campaign_id = path_parts[3]

        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        customer_email = query_params.get('email', '')

        if not customer_email:
            return cors_response(400, {'error': 'email query parameter is required'})

        # Get campaign data for this customer
        campaign_data_table = dynamodb.Table('campaign_data')
        response = campaign_data_table.query(
            KeyConditionExpression=Key('campaign_id').eq(campaign_id),
            FilterExpression=Attr('customer_email').eq(customer_email),
            Limit=1
        )

        if not response.get('Items'):
            return cors_response(404, {'error': 'Customer not found in this campaign'})

        customer_data = response['Items'][0]

        # Get campaign template config
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})
        campaign = campaign_response.get('Item', {})
        template_config = campaign.get('template_config', {})

        # Return preview data
        return cors_response(200, {
            'customer_data': customer_data,
            'template_config': template_config,
            'preview_ready': True
        })

    except Exception as e:
        logger.error(f"Error generating preview: {e}")
        return cors_response(500, {'error': str(e)})
def get_template_instance(event):
    """Get template instance for a campaign"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]
        
        template_instances_table = dynamodb.Table('campaign_template_instances')
        response = template_instances_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in response:
            # Create default template instance if none exists
            return create_template_instance_for_campaign(campaign_id)
        
        return cors_response(200, {'template_instance': response['Item']})
        
    except Exception as e:
        logger.error(f"Error getting template instance: {e}")
        return cors_response(500, {'error': str(e)})

def create_template_instance(event):
    """Create a new template instance for a campaign"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            path = event['rawPath']
        else:
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]
        
        return create_template_instance_for_campaign(campaign_id)
        
    except Exception as e:
        logger.error(f"Error creating template instance: {e}")
        return cors_response(500, {'error': str(e)})

def create_template_instance_for_campaign(campaign_id):
    """Helper function to create template instance"""
    try:
        # Get campaign details
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in campaign_response:
            return cors_response(404, {'error': 'Campaign not found'})
        
        campaign = campaign_response['Item']
        template_config = campaign.get('template_config', {})
        
        # Get standard template
        standard_template = get_standard_email_template()
        
        # Default template variables
        template_vars = {
            'CAMPAIGN_TITLE': template_config.get('subject', 'New Collection Available!'),
            'COMPANY_NAME': 'R and R Imports, Inc',
            'COMPANY_LOGO_URL': 'https://mcusercontent.com/8351ab2884b2416977322fb0e/images/4f7399b3-f8f9-8d7f-9b1e-4dd0ed5690cb.png',
            'MAIN_TITLE': template_config.get('main_title', 'New Collection Available!'),
            'TITLE_FONT_SIZE': '28px',
            'TITLE_COLOR': '#000000',
            'HERO_IMAGE_URL': template_config.get('main_image_url', ''),
            'HERO_LINK': '#',
            'HERO_ALT_TEXT': 'Campaign Hero Image',
            'GREETING_TEXT': 'Hi there,',
            'DESCRIPTION_TEXT': template_config.get('description', 'Check out our latest collection selected just for you!'),
            'PRODUCTS_TITLE': 'Featured Collection',
            'PRODUCTS_SUBTITLE': 'We\'ve selected these exclusive items just for you!',
            'PRODUCTS_HTML': '<!-- Products will be dynamically inserted here -->',
            'CTA_TEXT': 'Shop Collection',
            'CTA_LINK': '#',
            'CTA_BG_COLOR': '#7ac4c9',
            'CTA_TEXT_COLOR': '#000000',
            'COMPANY_ADDRESS': template_config.get('company_address', '5271 Lee Hwy, Troutville, VA 24175-7555 USA'),
            'UNSUBSCRIBE_URL': 'https://r-and-r-awss3.s3.us-east-1.amazonaws.com/unsuscribe_button.html'
        }
        
        # Apply variables to template
        rendered_html = standard_template
        for key, value in template_vars.items():
            rendered_html = rendered_html.replace('{{' + key + '}}', str(value))
        
        template_instance = {
            'campaign_id': campaign_id,
            'template_html': rendered_html,
            'template_config': template_vars,
            'version_history': [],
            'last_modified': datetime.now().isoformat(),
            'ai_chat_history': [],
            'created_at': datetime.now().isoformat()
        }
        
        # Save template instance
        template_instances_table = dynamodb.Table('campaign_template_instances')
        template_instances_table.put_item(Item=template_instance)
        
        # Update campaign to mark template instance created
        campaigns_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET template_instance_created = :created',
            ExpressionAttributeValues={':created': True}
        )
        
        logger.info(f"Created template instance for campaign: {campaign_id}")
        return cors_response(201, {
            'message': 'Template instance created successfully',
            'template_instance': template_instance
        })
        
    except Exception as e:
        logger.error(f"Error creating template instance: {e}")
        return cors_response(500, {'error': str(e)})

def ai_visual_edit(event):
    """
    AI Visual Template Editor - Agentic Application
    DEPRECATED: This function is now handled by the new AI Template Editor Lambda
    """
    return cors_response(410, {
        'error': 'This endpoint has been moved to the AI Template Editor Lambda',
        'message': 'Please use the new AI Template Editor service for template modifications'
    })
