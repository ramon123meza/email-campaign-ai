"""
Lambda Function: AI Template Editor
Handles AI-powered email template editing with chat interface
URL: https://jya2onwln6iewhxhxbrjwzpd7a0oudxo.lambda-url.us-east-1.on.aws/

UPDATED: Serverless AI template editor replacing Flask service

Environment Variables Required:
- AWS_REGION: us-east-1
- OPENAI_API_KEY: your-openai-api-key (sk-...)
- CLAUDE_API_KEY: your-claude-api-key (optional, for Claude integration)

Dependencies (add as Lambda layers):
- boto3
- beautifulsoup4
- openai (or anthropic for Claude)
"""

import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
import logging
import re
import uuid
from datetime import datetime
from decimal import Decimal
import os
from urllib import request, error
from urllib.parse import urlencode
from bs4 import BeautifulSoup, Tag, NavigableString
import traceback

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', '')

# Initialize AWS services
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)

def cors_response(status_code, body):
    """Standard CORS response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps(body, default=str)
    }

def call_openai_api(messages, system_prompt="", max_tokens=4000, temperature=0.7):
    """
    Call OpenAI API using pure REST (no dependencies)
    """
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY environment variable not set")

    url = 'https://api.openai.com/v1/chat/completions'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {OPENAI_API_KEY}'
    }

    # Prepare messages with system prompt
    formatted_messages = []
    if system_prompt:
        formatted_messages.append({"role": "system", "content": system_prompt})
    
    formatted_messages.extend(messages)

    payload = {
        'model': 'gpt-4o',
        'messages': formatted_messages,
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

def get_standard_email_template():
    """
    Returns the standardized email template based on hats_campaign.py
    This template has dynamic sections that can be modified by AI
    """
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

def get_default_template_config():
    """Returns default configuration for new template instances"""
    return {
        'CAMPAIGN_TITLE': 'New Collection Available!',
        'COMPANY_NAME': 'R and R Imports, Inc',
        'COMPANY_LOGO_URL': 'https://mcusercontent.com/8351ab2884b2416977322fb0e/images/4f7399b3-f8f9-8d7f-9b1e-4dd0ed5690cb.png',
        'MAIN_TITLE': 'New Collection Just Dropped!',
        'TITLE_FONT_SIZE': '28px',
        'TITLE_COLOR': '#000000',
        'HERO_IMAGE_URL': 'https://via.placeholder.com/600x300?text=Hero+Image',
        'HERO_LINK': '#',
        'HERO_ALT_TEXT': 'Campaign Hero Image',
        'GREETING_TEXT': 'Hi there,',
        'DESCRIPTION_TEXT': 'Check out our latest collection selected just for you!',
        'PRODUCTS_TITLE': 'Featured Collection',
        'PRODUCTS_SUBTITLE': 'We\'ve selected these exclusive items just for you!',
        'PRODUCTS_HTML': '<!-- Products will be dynamically inserted here -->',
        'CTA_TEXT': 'Shop Collection',
        'CTA_LINK': '#',
        'CTA_BG_COLOR': '#7ac4c9',
        'CTA_TEXT_COLOR': '#000000',
        'COMPANY_ADDRESS': '5271 Lee Hwy, Troutville, VA 24175-7555 USA',
        'UNSUBSCRIBE_URL': 'https://r-and-r-awss3.s3.us-east-1.amazonaws.com/unsuscribe_button.html'
    }

def simple_ai_processor(user_request, current_config, current_html):
    """
    Handle simple AI requests using pattern matching
    Returns: (success: bool, updated_config: dict, explanation: str)
    """
    user_request_lower = user_request.lower()
    updated_config = current_config.copy()
    explanation = ""

    # Color changes
    color_patterns = [
        (r'make.*title.*blue', 'TITLE_COLOR', '#0066cc', 'Changed title color to blue'),
        (r'make.*title.*red', 'TITLE_COLOR', '#cc0000', 'Changed title color to red'),
        (r'make.*title.*green', 'TITLE_COLOR', '#00cc66', 'Changed title color to green'),
        (r'make.*button.*blue', 'CTA_BG_COLOR', '#0066cc', 'Changed button color to blue'),
        (r'make.*button.*green', 'CTA_BG_COLOR', '#00cc66', 'Changed button color to green'),
        (r'make.*button.*red', 'CTA_BG_COLOR', '#cc0000', 'Changed button color to red'),
    ]

    # Font size changes
    size_patterns = [
        (r'make.*title.*bigger|increase.*title.*size', 'TITLE_FONT_SIZE', '36px', 'Increased title font size'),
        (r'make.*title.*smaller|decrease.*title.*size', 'TITLE_FONT_SIZE', '22px', 'Decreased title font size'),
    ]

    # Text changes
    if 'change title' in user_request_lower or 'update title' in user_request_lower:
        # Extract potential new title from request
        title_match = re.search(r'(?:change|update).*title.*?(?:to|:)\s*["\']?([^"\']+)["\']?', user_request, re.IGNORECASE)
        if title_match:
            new_title = title_match.group(1).strip()
            updated_config['MAIN_TITLE'] = new_title
            explanation = f"Changed title to: {new_title}"
            return True, updated_config, explanation

    # CTA button text changes
    if 'change button' in user_request_lower or 'update button' in user_request_lower:
        button_match = re.search(r'(?:change|update).*button.*?(?:to|:)\s*["\']?([^"\']+)["\']?', user_request, re.IGNORECASE)
        if button_match:
            new_button_text = button_match.group(1).strip()
            updated_config['CTA_TEXT'] = new_button_text
            explanation = f"Changed button text to: {new_button_text}"
            return True, updated_config, explanation

    # Apply pattern-based changes
    all_patterns = color_patterns + size_patterns
    for pattern, config_key, new_value, desc in all_patterns:
        if re.search(pattern, user_request_lower):
            updated_config[config_key] = new_value
            explanation = desc
            return True, updated_config, explanation

    return False, current_config, "Request requires advanced AI processing"

def apply_template_config(template_html, config):
    """Apply configuration variables to template HTML"""
    result = template_html
    for key, value in config.items():
        result = result.replace('{{' + key + '}}', str(value))
    return result

def advanced_ai_processor(user_request, current_config, current_html):
    """
    Handle complex AI requests using OpenAI
    Returns: (success: bool, updated_config: dict, updated_html: str, explanation: str)
    """
    system_prompt = """You are an expert email template designer. You can modify email templates based on user requests.

AVAILABLE TEMPLATE VARIABLES:
- CAMPAIGN_TITLE: Email subject/title
- MAIN_TITLE: Main headline text
- TITLE_FONT_SIZE: Title font size (e.g., '28px', '32px')
- TITLE_COLOR: Title color (hex codes like '#000000')
- HERO_IMAGE_URL: Hero banner image URL
- HERO_LINK: Hero image link destination
- GREETING_TEXT: Email greeting text
- DESCRIPTION_TEXT: Main description paragraph
- PRODUCTS_TITLE: Products section title
- PRODUCTS_SUBTITLE: Products section subtitle
- CTA_TEXT: Call-to-action button text
- CTA_BG_COLOR: Button background color
- CTA_TEXT_COLOR: Button text color
- CTA_LINK: Button link destination

RULES:
1. Make ONLY the requested changes
2. Preserve email client compatibility
3. Use web-safe fonts and colors
4. Return valid JSON with the changes made

OUTPUT FORMAT:
{
  "success": true,
  "changes": {
    "VARIABLE_NAME": "new_value"
  },
  "explanation": "Clear description of what was changed",
  "html_modified": false
}

If HTML structure needs to be modified (beyond variable substitution), set html_modified to true and explain why."""

    user_message = f"""Current template configuration:
{json.dumps(current_config, indent=2)}

User request: {user_request}

Please provide the necessary changes to fulfill this request."""

    try:
        response_text = call_openai_api(
            messages=[{"role": "user", "content": user_message}],
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=2000
        )

        # Extract JSON from response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            ai_response = json.loads(json_match.group())
            
            if ai_response.get('success', False):
                updated_config = current_config.copy()
                changes = ai_response.get('changes', {})
                
                # Apply changes to config
                for key, value in changes.items():
                    if key in updated_config:
                        updated_config[key] = value
                
                explanation = ai_response.get('explanation', 'AI made template modifications')
                
                # Apply updated config to HTML
                updated_html = apply_template_config(get_standard_email_template(), updated_config)
                
                return True, updated_config, updated_html, explanation
            else:
                return False, current_config, current_html, ai_response.get('explanation', 'AI could not process request')
        else:
            logger.error("Failed to parse AI response as JSON")
            return False, current_config, current_html, "Failed to parse AI response"

    except Exception as e:
        logger.error(f"Error in advanced AI processing: {e}")
        return False, current_config, current_html, f"AI processing error: {str(e)}"

def lambda_handler(event, context):
    """Main Lambda handler for AI template editing"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Handle Lambda Function URL format
        if 'requestContext' in event and 'http' in event.get('requestContext', {}):
            method = event['requestContext']['http']['method']
            path = event.get('rawPath', '/')
            
            if event.get('body') and isinstance(event['body'], str):
                try:
                    event['body'] = json.loads(event['body'])
                except:
                    pass
        else:
            method = event.get('httpMethod', 'POST')
            path = event.get('path', '/')
        
        logger.info(f"Method: {method}, Path: {path}")
        
        # Handle CORS preflight
        if method == 'OPTIONS':
            return cors_response(200, {})
        
        # Route requests
        if method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/ai-edit'):
            return handle_ai_edit_template(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/ai-chat'):
            return handle_ai_chat(event)
        elif method == 'GET' and path.startswith('/api/campaigns/') and path.endswith('/template-instance'):
            return handle_get_template_instance(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/create-template-instance'):
            return handle_create_template_instance(event)
        elif method == 'GET' and path == '/api/health':
            return handle_health_check()
        else:
            return cors_response(404, {'error': 'Endpoint not found'})
            
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        logger.error(traceback.format_exc())
        return cors_response(500, {'error': str(e)})

def handle_health_check():
    """Health check endpoint"""
    return cors_response(200, {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'openai_configured': bool(OPENAI_API_KEY),
        'claude_configured': bool(CLAUDE_API_KEY)
    })

def handle_create_template_instance(event):
    """Create a new template instance for a campaign"""
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
        
        # Get default template and config
        template_html = get_standard_email_template()
        template_config = get_default_template_config()
        
        # Override with any provided config
        if 'template_config' in body:
            template_config.update(body['template_config'])
        
        # Apply config to template
        rendered_html = apply_template_config(template_html, template_config)
        
        # Create template instance
        template_instances_table = dynamodb.Table('campaign_template_instances')
        template_instance = {
            'campaign_id': campaign_id,
            'template_html': rendered_html,
            'template_config': template_config,
            'version_history': [],
            'last_modified': datetime.now().isoformat(),
            'ai_chat_history': [],
            'created_at': datetime.now().isoformat()
        }
        
        template_instances_table.put_item(Item=template_instance)
        
        logger.info(f"Created template instance for campaign: {campaign_id}")
        return cors_response(201, {
            'message': 'Template instance created successfully',
            'template_instance': template_instance
        })
        
    except Exception as e:
        logger.error(f"Error creating template instance: {e}")
        return cors_response(500, {'error': str(e)})

def handle_get_template_instance(event):
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
            return handle_create_template_instance(event)
        
        return cors_response(200, {'template_instance': response['Item']})
        
    except Exception as e:
        logger.error(f"Error getting template instance: {e}")
        return cors_response(500, {'error': str(e)})

def handle_ai_edit_template(event):
    """Handle AI template editing requests"""
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
        
        # Get current template instance
        template_instances_table = dynamodb.Table('campaign_template_instances')
        response = template_instances_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Template instance not found'})
        
        current_instance = response['Item']
        current_config = current_instance.get('template_config', get_default_template_config())
        current_html = current_instance.get('template_html', '')
        
        # Try simple AI processor first
        simple_success, updated_config, simple_explanation = simple_ai_processor(
            user_request, current_config, current_html
        )
        
        if simple_success:
            # Apply updated config to template
            updated_html = apply_template_config(get_standard_email_template(), updated_config)
            processing_type = 'simple'
            explanation = simple_explanation
        else:
            # Use advanced AI processor
            advanced_success, updated_config, updated_html, advanced_explanation = advanced_ai_processor(
                user_request, current_config, current_html
            )
            
            if not advanced_success:
                return cors_response(400, {'error': advanced_explanation})
            
            processing_type = 'advanced'
            explanation = advanced_explanation
        
        # Save version history
        version_history = current_instance.get('version_history', [])
        version_history.append({
            'timestamp': datetime.now().isoformat(),
            'user_request': user_request,
            'changes_made': explanation,
            'processing_type': processing_type,
            'previous_config': current_config
        })
        
        # Limit version history to last 50 changes
        if len(version_history) > 50:
            version_history = version_history[-50:]
        
        # Update template instance
        template_instances_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET template_html = :html, template_config = :config, version_history = :history, last_modified = :modified',
            ExpressionAttributeValues={
                ':html': updated_html,
                ':config': updated_config,
                ':history': version_history,
                ':modified': datetime.now().isoformat()
            }
        )
        
        logger.info(f"Updated template for campaign {campaign_id}: {explanation}")
        return cors_response(200, {
            'success': True,
            'message': explanation,
            'processing_type': processing_type,
            'updated_html': updated_html,
            'updated_config': updated_config
        })
        
    except Exception as e:
        logger.error(f"Error handling AI edit: {e}")
        return cors_response(500, {'error': str(e)})

def handle_ai_chat(event):
    """Handle AI chat conversation for template editing"""
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
        
        user_message = body.get('message', '')
        if not user_message:
            return cors_response(400, {'error': 'message field is required'})
        
        # Get current template instance
        template_instances_table = dynamodb.Table('campaign_template_instances')
        response = template_instances_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in response:
            return cors_response(404, {'error': 'Template instance not found'})
        
        current_instance = response['Item']
        chat_history = current_instance.get('ai_chat_history', [])
        
        # Add user message to history
        chat_history.append({
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.now().isoformat()
        })
        
        # Process the message (can be editing request or general question)
        if any(keyword in user_message.lower() for keyword in ['change', 'update', 'modify', 'make', 'edit']):
            # This is likely an editing request
            edit_response = handle_ai_edit_template(event)
            edit_data = json.loads(edit_response['body'])
            
            if edit_data.get('success'):
                ai_response = f"✅ {edit_data['message']}"
            else:
                ai_response = f"❌ I couldn't make that change: {edit_data.get('error', 'Unknown error')}"
        else:
            # General conversation - provide helpful information
            system_prompt = """You are a helpful email template design assistant. You can help users understand their email template and suggest improvements. Be conversational and helpful.

Current template sections:
- Header with company logo
- Main title section
- Hero image banner
- Content with greeting and description
- Products section (dynamically populated)
- Call-to-action button
- Footer with social media and company info

You can help users modify colors, fonts, text content, and styling. Be encouraging and suggest specific improvements."""

            try:
                ai_response = call_openai_api(
                    messages=[{"role": "user", "content": user_message}],
                    system_prompt=system_prompt,
                    temperature=0.7,
                    max_tokens=500
                )
            except Exception as e:
                ai_response = "I'm having trouble processing your request right now. Please try asking about specific changes you'd like to make to your email template."
        
        # Add AI response to history
        chat_history.append({
            'role': 'assistant',
            'content': ai_response,
            'timestamp': datetime.now().isoformat()
        })
        
        # Limit chat history to last 100 messages
        if len(chat_history) > 100:
            chat_history = chat_history[-100:]
        
        # Update chat history
        template_instances_table.update_item(
            Key={'campaign_id': campaign_id},
            UpdateExpression='SET ai_chat_history = :history',
            ExpressionAttributeValues={
                ':history': chat_history
            }
        )
        
        return cors_response(200, {
            'response': ai_response,
            'chat_history': chat_history
        })
        
    except Exception as e:
        logger.error(f"Error handling AI chat: {e}")
        return cors_response(500, {'error': str(e)})