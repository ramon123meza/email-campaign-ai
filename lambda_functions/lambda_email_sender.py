"""
Lambda Function: Email Sender
Handles batch email sending with AWS SES
this lambda function is invoked to this endpoint: https://myylk2rmfu3njaqfxzwyvmyaru0sgwlv.lambda-url.us-east-1.on.aws/

UPDATED: Now supports Lambda Function URL events

Environment Variables Required:
- AWS_REGION: us-east-1
- SES_SENDER: "R and R Imports INC" <hello@rrinconline.com>
- SES_REPLY_TO: hello@rrinconline.com

Dependencies (add as Lambda layers):
- boto3
- jinja2 (for template rendering)
"""

import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
import logging
import time
from datetime import datetime
from botocore.exceptions import ClientError
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
SES_SENDER = os.environ.get('SES_SENDER', '"R and R Imports INC" <hello@rrinconline.com>')
SES_REPLY_TO = os.environ.get('SES_REPLY_TO', 'hello@rrinconline.com')

# Email sending configuration
EMAILS_PER_SECOND = 14  # AWS SES rate limit
BATCH_TIMEOUT_MINUTES = 10  # Maximum processing time per batch

# Initialize AWS services
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
ses = boto3.client('ses', region_name=AWS_REGION)

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

def get_template_components():
    """Get template components from database"""
    try:
        table = dynamodb.Table('template_components')
        response = table.scan()
        
        components = {}
        for item in response.get('Items', []):
            components[item['component_id']] = item
        
        return components
    except Exception as e:
        logger.error(f"Error getting template components: {e}")
        return {}

def generate_email_html_from_template_instance(record, campaign_id):
    """Generate personalized HTML email from template instance"""
    try:
        # Get template instance for campaign
        template_instances_table = dynamodb.Table('campaign_template_instances')
        response = template_instances_table.get_item(Key={'campaign_id': campaign_id})
        
        if 'Item' not in response:
            # Fallback to old method if no template instance
            logger.warning(f"No template instance found for campaign {campaign_id}, using fallback method")
            return generate_email_html_fallback(record, campaign_id)
        
        template_instance = response['Item']

        # Use raw template with placeholders for personalization
        template_html_raw = template_instance.get('template_html_raw', '')
        template_config = template_instance.get('template_config', {})

        # If raw template doesn't exist (old template), use rendered one
        if not template_html_raw:
            template_html_raw = template_instance.get('template_html', '')
            logger.warning("Using old template format without raw template")

        # Personalize email using shared logic (same as preview endpoint)
        personalized_html = generate_personalized_email_for_recipient(template_html_raw, template_config, record)

        return personalized_html
        
    except Exception as e:
        logger.error(f"Error generating email from template instance: {e}")
        # Fallback to old method
        return generate_email_html_fallback(record, campaign_id)

def generate_personalized_email_for_recipient(template_html_raw, template_config, recipient):
    """
    Generate personalized HTML email for a recipient

    Args:
        template_html_raw: Raw template with {{PLACEHOLDERS}}
        template_config: Base config from template instance (AI-generated or default)
        recipient: Recipient data with products, school info, etc.
    """
    try:
        # Start with raw template
        personalized_html = template_html_raw

        # Step 1: Apply base template config (AI-generated titles, descriptions, etc.)
        # but SKIP fields that need per-recipient personalization
        # IMPORTANT: We skip DESCRIPTION_TEXT because it should be personalized per recipient
        for key, value in template_config.items():
            if key not in ['PRODUCTS_HTML', 'GREETING_TEXT', 'PRODUCTS_TITLE', 'PRODUCTS_SUBTITLE', 'DESCRIPTION_TEXT']:  # Skip - we'll personalize these
                placeholder = '{{' + key + '}}'
                personalized_html = personalized_html.replace(placeholder, str(value))

        # Step 2: Personalize greeting with recipient name
        recipient_name = recipient.get('recipient_name', '') or recipient.get('customer_name', '')
        if recipient_name:
            greeting = f"Hi {recipient_name},"
        else:
            # Fallback to AI-generated or default greeting if no name
            greeting = template_config.get('GREETING_TEXT', 'Hi there,')
        personalized_html = personalized_html.replace('{{GREETING_TEXT}}', greeting)

        # Step 3: Get school/team information
        school_code = recipient.get('school_code', '')
        team_name = get_school_name_from_code(school_code) if school_code else ''

        logger.info(f"Personalizing for school_code={school_code}, team_name={team_name}")

        # CRITICAL: Replace {{TEAM_NAME}} placeholder globally in the entire HTML
        # This handles AI-generated content that uses {{TEAM_NAME}} in MAIN_TITLE, DESCRIPTION_TEXT, etc.
        if team_name and team_name != school_code:
            personalized_html = personalized_html.replace('{{TEAM_NAME}}', team_name)
        elif school_code:
            personalized_html = personalized_html.replace('{{TEAM_NAME}}', school_code)
        else:
            personalized_html = personalized_html.replace('{{TEAM_NAME}}', 'Your Team')

        # Update products title with school name (ALWAYS replace, even if no team_name)
        if team_name and team_name != school_code:
            products_title = f"Featured {team_name} Collection"
        elif school_code:
            # Fallback: still use school code if lookup failed, but mark it clearly
            products_title = f"Featured {school_code} Collection"
        else:
            products_title = "Featured Collection"
        personalized_html = personalized_html.replace('{{PRODUCTS_TITLE}}', products_title)

        # Also replace PRODUCTS_SUBTITLE with school-specific text
        if team_name and team_name != school_code:
            products_subtitle = f"Show your {team_name} pride with these exclusive items!"
        else:
            products_subtitle = template_config.get('PRODUCTS_SUBTITLE', 'We\'ve selected these exclusive items just for you!')
        personalized_html = personalized_html.replace('{{PRODUCTS_SUBTITLE}}', products_subtitle)

        # Step 3b: Personalize DESCRIPTION_TEXT for this recipient's school ONLY
        # CRITICAL: Each recipient sees ONLY their school, not multiple schools
        if team_name and team_name != school_code:
            # Use full school name
            description = f"Discover exclusive {team_name} gear designed for true fans! Show your school pride with our personalized collection. Get yours today and represent your team!"
        elif school_code:
            # Fallback to school code if name lookup failed
            description = f"Discover exclusive {school_code} gear designed for true fans! Show your school pride with our personalized collection. Get yours today and represent your team!"
        else:
            # Generic fallback
            description = template_config.get('DESCRIPTION_TEXT', 'Discover something special just for you!')
        personalized_html = personalized_html.replace('{{DESCRIPTION_TEXT}}', description)

        # Step 4: Generate recipient-specific products HTML
        product_count = sum(1 for i in range(1, 5) if recipient.get(f'product_image_{i}'))
        products_html = generate_products_html(recipient, product_count, team_name or school_code)
        personalized_html = personalized_html.replace('{{PRODUCTS_HTML}}', products_html)

        # Step 5: School-specific links
        school_page = recipient.get('school_page', template_config.get('CTA_PRIMARY_LINK', '#'))
        personalized_html = personalized_html.replace('{{HERO_LINK}}', school_page)
        personalized_html = personalized_html.replace('{{CTA_LINK}}', school_page)
        personalized_html = personalized_html.replace('{{SCHOOL_PAGE}}', school_page)
        personalized_html = personalized_html.replace('{{CTA_SECONDARY_LINK}}', school_page)

        # Step 5b: Ensure CTA button texts are ALWAYS replaced (even if missing from config)
        cta_primary_text = template_config.get('CTA_PRIMARY_TEXT', 'Shop the Collection')
        cta_secondary_text = template_config.get('CTA_SECONDARY_TEXT', "Shop Your Team's Collection")
        personalized_html = personalized_html.replace('{{CTA_PRIMARY_TEXT}}', cta_primary_text)
        personalized_html = personalized_html.replace('{{CTA_SECONDARY_TEXT}}', cta_secondary_text)

        # Step 5c: Ensure CTA links are replaced
        cta_primary_link = template_config.get('CTA_PRIMARY_LINK', 'https://www.rrinconline.com')
        personalized_html = personalized_html.replace('{{CTA_PRIMARY_LINK}}', cta_primary_link)

        # Step 6: Replace hero image if school logo is available
        school_logo = recipient.get('school_logo', '')
        if school_logo:
            personalized_html = personalized_html.replace('{{HERO_IMAGE_URL}}', school_logo)

        # Step 7: Catch-all - replace any remaining common placeholders with defaults
        remaining_replacements = {
            '{{COMPANY_NAME}}': template_config.get('COMPANY_NAME', 'R and R Imports, Inc.'),
            '{{COMPANY_ADDRESS}}': template_config.get('COMPANY_ADDRESS', ''),
            '{{UNSUBSCRIBE_LINK}}': template_config.get('UNSUBSCRIBE_LINK', '#'),
            '{{FOOTER_TEXT}}': template_config.get('FOOTER_TEXT', ''),
        }
        for placeholder, value in remaining_replacements.items():
            if value:  # Only replace if we have a value
                personalized_html = personalized_html.replace(placeholder, str(value))

        return personalized_html

    except Exception as e:
        logger.error(f"Error generating personalized email: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return template_html_raw

def get_school_name_from_code(school_code):
    """Get school name from school code using college-db-email table

    NOTE: The college-db-email table has partition key 'school_name' (the full name),
    and 'school_code' (e.g., 'AKN') is just an attribute. We must scan the table
    to find the school by code. This is efficient since table has <200 records.
    """
    try:
        if not school_code:
            logger.warning("get_school_name_from_code called with empty school_code")
            return school_code

        college_db_table = dynamodb.Table('college-db-email')
        logger.info(f"Scanning college-db-email table for school_code='{school_code}'")

        # Must use scan() since school_code is an attribute, not the partition key
        response = college_db_table.scan(
            FilterExpression=Attr('school_code').eq(school_code)
        )

        items = response.get('Items', [])
        if items:
            school_name = items[0].get('school_name', '')
            logger.info(f"Found school entry: school_code='{school_code}', school_name='{school_name}'")

            # If school_name is empty or same as code, log warning
            if not school_name or school_name == school_code:
                logger.warning(f"School entry exists but school_name is empty or equals code: school_code='{school_code}', school_name='{school_name}'")
                return school_code

            return school_name
        else:
            logger.warning(f"No entry found in college-db-email for school_code='{school_code}'")
            return school_code

    except Exception as e:
        logger.error(f"Error getting school name for code '{school_code}': {e}")
        import traceback
        logger.error(traceback.format_exc())
        return school_code

def generate_personalized_subject(base_subject, recipient):
    """
    Generate personalized subject line for recipient

    Examples:
        "Hi John, Michigan Journals Just Dropped!"
        "Hi Sarah, Your Favorite Team's New Collection!"

    Args:
        base_subject: AI-generated or default subject from template
        recipient: Recipient record with name and school info
    """
    try:
        recipient_name = recipient.get('recipient_name', '') or recipient.get('customer_name', '')
        school_code = recipient.get('school_code', '')

        # Get team name if available
        team_name = get_school_name_from_code(school_code) if school_code else ''

        # Personalize subject line
        if recipient_name and team_name:
            # Best case: both name and team
            # Pattern: "Hi {name}, {team} {product_category} Just Dropped!"
            return f"Hi {recipient_name}, {team_name} Collection Just Dropped!"
        elif recipient_name:
            # Just name
            return f"Hi {recipient_name}! {base_subject}"
        elif team_name:
            # Just team
            return f"{team_name} {base_subject}"
        else:
            # Fallback to base subject
            return base_subject

    except Exception as e:
        logger.error(f"Error generating personalized subject: {e}")
        return base_subject

def generate_products_html(record, product_count, team_text):
    """Generate HTML for products section"""
    if product_count == 0:
        return '<!-- No products available -->'
    
    if product_count == 1:
        # Single product layout
        return f'''
<td width="100%" style="padding:0 10px;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr><td align="center" style="height:250px;">
<a href="{record.get('product_link_1', '#')}" target="_blank">
<img src="{record.get('product_image_1', '')}" alt="{record.get('product_name_1', 'Product')}" style="display:block;border:0;max-width:300px;max-height:300px;border-radius:8px;" />
</a>
</td></tr>
<tr><td align="center" style="padding-top:10px;">
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;color:#333333;margin:0 0 5px 0;">{record.get('product_name_1', '')}</p>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;font-weight:bold;color:#000000;margin:0 0 10px 0;">${record.get('product_price_1', '0.00')}</p>
<a href="{record.get('product_link_1', '#')}" target="_blank" style="display:inline-block;background-color:#000000;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Shop Now</a>
</td></tr>
</table>
</td>
'''
    else:
        # Multiple products layout
        products_per_row = min(product_count, 2)
        width_percent = 100 // products_per_row
        
        products_html = ''
        for i in range(1, product_count + 1):
            product_image = record.get(f'product_image_{i}', '')
            product_link = record.get(f'product_link_{i}', '#')
            product_name = record.get(f'product_name_{i}', '')
            product_price = record.get(f'product_price_{i}', '0.00')
            
            if product_image:
                products_html += f'''
<td width="{width_percent}%" style="padding:0 10px;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr><td align="center" style="height:250px;">
<a href="{product_link}" target="_blank">
<img src="{product_image}" alt="{product_name}" style="display:block;border:0;max-width:250px;max-height:250px;border-radius:8px;" />
</a>
</td></tr>
<tr><td align="center" style="padding-top:10px;">
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;color:#333333;margin:0 0 5px 0;">{product_name}</p>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:18px;font-weight:bold;color:#000000;margin:0 0 10px 0;">${product_price}</p>
<a href="{product_link}" target="_blank" style="display:inline-block;background-color:#000000;color:#ffffff;padding:8px 16px;text-decoration:none;border-radius:4px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:12px;">Shop Now</a>
</td></tr>
</table>
</td>
'''
                
                # Start new row after 2 products
                if i % 2 == 0 and i < product_count:
                    products_html += "</tr><tr>"
        
        return products_html

def generate_email_html_fallback(record, campaign_id):
    """Fallback method for generating email HTML (original method)"""
    try:
        # Get campaign info
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})

        if 'Item' not in campaign_response:
            raise Exception(f"Campaign {campaign_id} not found")

        campaign = campaign_response['Item']
        template_config = campaign.get('template_config', {})
        
        # Get template components
        components = get_template_components()
        
        # Original email generation logic
        return generate_email_html(record, template_config, components)
        
    except Exception as e:
        logger.error(f"Error in fallback email generation: {e}")
        return ""

def generate_email_html(record, template_config, components):
    """Generate personalized HTML email (original method - kept for compatibility)"""
    try:
        # Get components
        header = components.get('header', {})
        footer = components.get('footer', {})
        
        # Determine product layout based on available products
        product_count = sum(1 for i in range(1, 5) if record.get(f'product_image_{i}'))
        
        if product_count <= 1:
            product_component = components.get('single_product', {})
        else:
            product_component = components.get('multi_product', {})
        
        # Personalized greeting
        customer_name = record.get('customer_name', '')
        greeting = f"Hi {customer_name}," if customer_name else "Hi there,"
        
        # School/team information
        team = record.get('school_code', '')
        team_text = f"Featured {team} Collection" if team else "Featured Collection"
        
        # Build HTML
        html = f"""<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{template_config.get('main_title', 'New Collection Available!')}</title>
</head>
<body>
<center>
<table border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" style="background-color: #f4f4f4;">
<tbody><tr>
<td align="center" valign="top">
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;">
<tbody>

<!-- Header Section -->
<tr><td style="background-color:#ffffff;">
{header.get('html_template', '')}
</td></tr>

<!-- Main Title Section -->
<tr><td style="background-color:#ffffff; padding:20px 24px; text-align:center;">
<div style="border-top:2px solid #000000; margin-bottom:20px;"></div>
<h1 style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:28px;font-weight:bold;color:#000000;margin:0;">
{template_config.get('main_title', 'New Collection Available!')}
</h1>
</td></tr>

<!-- Hero Image Section -->"""
        
        if template_config.get('main_image_url'):
            html += f"""
<tr><td style="background-color:#ffffff; padding:12px 0;">
<a href="{record.get('school_page', '#')}" target="_blank">
<img src="{template_config.get('main_image_url')}" alt="Campaign Image" style="display:block;max-width:100%;height:auto;border-radius:10px;" />
</a>
</td></tr>"""
        
        html += f"""
<!-- Content Section -->
<tr><td style="background-color:#ffffff; padding:12px 24px; text-align:center;">
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;color:#000000;">{greeting}</p>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;color:#000000;">
{template_config.get('description', 'Check out our latest collection selected just for you!')}
</p>
</td></tr>

<!-- Products Section -->"""
        
        # Add product section
        if product_count > 0:
            if product_count == 1:
                # Single product layout
                html += f"""
<tr><td style="background-color:#ffffff; padding:20px 24px; text-align:center;">
<h2 style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;font-weight:bold;color:#000000;">{team_text}</h2>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;color:#000000;">We've selected this exclusive item just for you!</p>
</td></tr>
<tr><td style="background-color:#ffffff; padding:0 24px 30px 24px;">
<table align="center" width="100%" style="max-width:400px;">
<tr><td align="center" style="height:300px;">
<a href="{record.get('product_link_1', '#')}" target="_blank">
<img src="{record.get('product_image_1', '')}" alt="{record.get('product_name_1', 'Product')}" style="display:block;border:0;max-width:300px;max-height:300px;border-radius:8px;" />
</a>
</td></tr>
<tr><td align="center" style="padding-top:10px;">
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;color:#333333;">{record.get('product_name_1', '')}</p>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:20px;font-weight:bold;color:#000000;">${record.get('product_price_1', '0.00')}</p>
<a href="{record.get('product_link_1', '#')}" target="_blank" style="display:inline-block;background-color:#000000;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">Shop Now</a>
</td></tr>
</table>
</td></tr>"""
            else:
                # Multiple products layout
                html += f"""
<tr><td style="background-color:#ffffff; padding:20px 24px; text-align:center;">
<h2 style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:24px;font-weight:bold;color:#000000;">{team_text}</h2>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;color:#000000;">We've selected these exclusive items just for you!</p>
</td></tr>
<tr><td style="background-color:#ffffff; padding:0 24px 30px 24px;">
<table align="center" width="100%" style="max-width:600px;">
<tr>"""
                
                # Add product slots
                products_per_row = min(product_count, 2)
                width_percent = 100 // products_per_row
                
                for i in range(1, product_count + 1):
                    product_image = record.get(f'product_image_{i}', '')
                    product_link = record.get(f'product_link_{i}', '#')
                    product_name = record.get(f'product_name_{i}', '')
                    product_price = record.get(f'product_price_{i}', '0.00')
                    
                    if product_image:
                        html += f"""
<td width="{width_percent}%" style="padding:0 10px;">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tr><td align="center" style="height:250px;">
<a href="{product_link}" target="_blank">
<img src="{product_image}" alt="{product_name}" style="display:block;border:0;max-width:250px;max-height:250px;border-radius:8px;" />
</a>
</td></tr>
<tr><td align="center" style="padding-top:10px;">
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:14px;color:#333333;margin:0 0 5px 0;">{product_name}</p>
<p style="font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:18px;font-weight:bold;color:#000000;margin:0 0 10px 0;">${product_price}</p>
<a href="{product_link}" target="_blank" style="display:inline-block;background-color:#000000;color:#ffffff;padding:8px 16px;text-decoration:none;border-radius:4px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:12px;">Shop Now</a>
</td></tr>
</table>
</td>"""
                        
                        # Start new row after 2 products
                        if i % 2 == 0 and i < product_count:
                            html += "</tr><tr>"
                
                html += """
</tr>
</table>
</td></tr>"""
        
        # CTA Button
        html += f"""
<tr><td style="background-color:#ffffff; padding:12px 24px; text-align:center;">
<a href="{record.get('school_page', '#')}" target="_blank" style="display:inline-block;background-color:#7ac4c9;color:#000000;padding:16px 28px;text-decoration:none;border-radius:4px;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;font-size:16px;">Shop Collection</a>
</td></tr>

<tr><td style="background-color:#ffffff;">
<div style="border-top:2px solid #000000; margin:20px 24px;"></div>
</td></tr>

<!-- Footer Section -->
<tr><td style="background-color:#ffffff;">
{footer.get('html_template', '').format(
    company_name=template_config.get('footer_text', 'R and R Imports, Inc'),
    company_address=template_config.get('company_address', '5271 Lee Hwy, Troutville, VA 24175-7555 USA'),
    unsubscribe_url='https://r-and-r-awss3.s3.us-east-1.amazonaws.com/unsuscribe_button.html'
)}
</td></tr>

</tbody></table>
</td></tr></tbody></table>
</center>
</body>
</html>"""
        
        return html
        
    except Exception as e:
        logger.error(f"Error generating email HTML: {e}")
        return ""

def send_email_ses(recipient, subject, html_body):
    """Send email via AWS SES"""
    try:
        response = ses.send_email(
            Source=SES_SENDER,
            Destination={'ToAddresses': [recipient]},
            Message={
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Html': {
                        'Data': html_body,
                        'Charset': 'UTF-8'
                    }
                }
            },
            ReplyToAddresses=[SES_REPLY_TO]
        )
        
        logger.info(f"Email sent successfully to {recipient}. MessageId: {response['MessageId']}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"SES Error sending to {recipient}: {error_code} - {error_message}")
        return False
        
    except Exception as e:
        logger.error(f"Unexpected error sending to {recipient}: {str(e)}")
        return False

def get_products_for_test_user(campaign_id, school_code):
    """
    Get products for test user based on school code with fallback logic

    Args:
        campaign_id: Campaign ID
        school_code: Preferred school code (e.g., 'RAD', 'ALA')

    Returns:
        Recipient record with products populated, or None if no products found
    """
    try:
        campaign_data_table = dynamodb.Table('campaign_data')
        college_db_table = dynamodb.Table('college-db-email')

        # Fallback schools in order
        FALLBACK_SCHOOLS = [
            'ACU', 'AKN', 'ALA', 'ALB', 'ALC', 'ALS', 'APS', 'ARK', 'ARS', 'ATU',
            'AUB', 'BALL', 'BAY', 'BGU', 'BST', 'BUT', 'BYU', 'CCU', 'CHAR', 'CHI',
            'CHIC', 'CLE', 'CMI', 'CMP', 'CNU', 'CO', 'COL', 'CSL', 'DAV', 'DAY', 'DEL'
        ]

        # Try preferred school first, then fallbacks
        schools_to_try = [school_code] if school_code else []
        schools_to_try.extend([s for s in FALLBACK_SCHOOLS if s != school_code])

        logger.info(f"TEST USER: Searching for products - Preferred school: {school_code}, Will try in order: {schools_to_try[:5]}...")

        for try_school in schools_to_try:
            logger.info(f"TEST USER: Trying school: {try_school}")
            # Query campaign_data for this school
            response = campaign_data_table.query(
                KeyConditionExpression=Key('campaign_id').eq(campaign_id),
                FilterExpression=Attr('school_code').eq(try_school),
                Limit=1
            )

            items = response.get('Items', [])
            if items:
                logger.info(f"TEST USER: ✓ SUCCESS: Found products for school {try_school} (preferred was: {school_code})")
                recipient = items[0]

                # Get school information from college-db-email
                # IMPORTANT: Must use scan() since school_code is an attribute, not partition key
                try:
                    school_response = college_db_table.scan(
                        FilterExpression=Attr('school_code').eq(try_school),
                        Limit=1
                    )
                    school_items = school_response.get('Items', [])
                    if school_items:
                        school_info = school_items[0]
                        recipient['school_name'] = school_info.get('school_name', try_school)
                        recipient['school_logo'] = school_info.get('school_logo', '')
                        recipient['school_page'] = school_info.get('school_page', '')
                        logger.info(f"TEST USER: School info for {try_school}: {recipient['school_name']}")
                    else:
                        logger.warning(f"TEST USER: No school info found in college-db-email for {try_school}")
                        recipient['school_name'] = try_school
                except Exception as e:
                    logger.error(f"TEST USER: Error getting school info for {try_school}: {e}")

                return recipient
            else:
                logger.info(f"TEST USER: No products found for {try_school}, trying next...")

        logger.warning(f"No products found for school {school_code} or any fallback schools")
        return None

    except Exception as e:
        logger.error(f"Error getting products for test user: {e}")
        return None

def send_batch_emails(campaign_id, batch_number, is_test=False):
    """Send emails for a specific batch with safety checks"""
    try:
        # Get campaign info
        campaigns_table = dynamodb.Table('email_campaigns')
        campaign_response = campaigns_table.get_item(Key={'campaign_id': campaign_id})

        if 'Item' not in campaign_response:
            raise Exception(f"Campaign {campaign_id} not found")

        campaign = campaign_response['Item']

        # SAFETY CHECK: Verify safety checklist if not a test
        if not is_test:
            safety_checklist = campaign.get('safety_checklist', {})
            if safety_checklist:
                # Check if all required items are completed
                required_checks = ['test_emails_sent', 'preview_verified']
                for check in required_checks:
                    if not safety_checklist.get(check, False):
                        raise Exception(f"Safety check failed: {check} must be completed before sending")

            # Check if campaign is locked for editing
            template_locked = campaign.get('template_locked', False)
            if not template_locked:
                logger.warning("Campaign template is not locked - proceeding anyway")

        template_config = campaign.get('template_config', {})

        # Get template components
        components = get_template_components()

        # Only get and update batch info for NON-TEST emails
        batch = None
        if not is_test:
            # Get batch info
            batches_table = dynamodb.Table('campaign_batches')
            batch_response = batches_table.get_item(
                Key={'campaign_id': campaign_id, 'batch_number': int(batch_number)}
            )

            if 'Item' not in batch_response:
                raise Exception(f"Batch {batch_number} not found for campaign {campaign_id}")

            batch = batch_response['Item']

            # Update batch status to sending
            batches_table.update_item(
                Key={'campaign_id': campaign_id, 'batch_number': int(batch_number)},
                UpdateExpression='SET #status = :status, started_at = :started',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'sending',
                    ':started': datetime.now().isoformat()
                }
            )
        else:
            logger.info("TEST MODE: Skipping batch status updates")

        # Get campaign data for this batch
        campaign_data_table = dynamodb.Table('campaign_data')

        if is_test:
            logger.info("========== SENDING TEST EMAILS ==========")
            # For test emails, get test users
            test_users_table = dynamodb.Table('test_users')
            response = test_users_table.scan(
                FilterExpression=Attr('active').eq(True)
            )
            test_users = response.get('Items', [])
            logger.info(f"Found {len(test_users)} active test users")

            # Convert test users to campaign data format with actual products
            test_records = []
            for user in test_users:
                # Get products for this test user's school
                school_code = user.get('school_code', '')
                recipient_data = get_products_for_test_user(campaign_id, school_code)

                if recipient_data:
                    # Override recipient data with test user info
                    recipient_data['customer_email'] = user['email']
                    recipient_data['recipient_name'] = user['name']
                    recipient_data['customer_name'] = user['name']
                    recipient_data['record_id'] = f"test_{user['email']}"
                    recipient_data['email_sent'] = False

                    test_records.append(recipient_data)
                else:
                    # Fallback to placeholder if no products found
                    logger.warning(f"No products found for test user {user['email']} (school: {school_code}), using placeholder")
                    test_records.append({
                        'campaign_id': campaign_id,
                        'record_id': f"test_{user['email']}",
                        'customer_email': user['email'],
                        'customer_name': user['name'],
                        'recipient_name': user['name'],
                        'school_code': school_code,
                        'email_sent': False,
                        'product_link_1': 'https://www.rrinconline.com/products/test-product',
                        'product_image_1': 'https://via.placeholder.com/300x300?text=Test+Product',
                        'product_name_1': 'Test Product',
                        'product_price_1': '19.99'
                    })
            records = test_records
        else:
            # Get actual campaign data for this batch
            response = campaign_data_table.query(
                IndexName='BatchIndex',
                KeyConditionExpression=Key('campaign_id').eq(campaign_id) & Key('batch_number').eq(int(batch_number)),
                FilterExpression=Attr('email_sent').eq(False)
            )
            records = response.get('Items', [])
        
        if not records:
            logger.info(f"No unsent emails found for batch {batch_number}")
            # Mark batch as completed
            batches_table.update_item(
                Key={'campaign_id': campaign_id, 'batch_number': int(batch_number)},
                UpdateExpression='SET #status = :status, completed_at = :completed',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'completed',
                    ':completed': datetime.now().isoformat()
                }
            )
            return {'emails_sent': 0, 'message': 'No emails to send'}
        
        emails_sent = 0
        failed_emails = 0
        start_time = datetime.now()
        total_recipients = len(records)

        # Get template instance for subject line generation
        template_instances_table = dynamodb.Table('campaign_template_instances')
        template_response = template_instances_table.get_item(Key={'campaign_id': campaign_id})

        template_instance = template_response.get('Item', {}) if 'Item' in template_response else {}
        template_config = template_instance.get('template_config', {})

        # Base subject line (will be personalized per recipient)
        base_subject = template_config.get('CAMPAIGN_TITLE', 'New Collection Available!')

        logger.info(f"Starting to send {total_recipients} emails...")

        for i, record in enumerate(records):
            # Check timeout
            elapsed_minutes = (datetime.now() - start_time).total_seconds() / 60
            if elapsed_minutes >= BATCH_TIMEOUT_MINUTES:
                logger.warning(f"Batch timeout reached after {elapsed_minutes:.1f} minutes")
                break

            # Generate personalized subject line like: "Hi John, Michigan Journals Just Dropped!"
            subject = generate_personalized_subject(base_subject, record)

            # Generate personalized email using new template instance method
            html_content = generate_email_html_from_template_instance(record, campaign_id)

            if not html_content:
                logger.error(f"Failed to generate email for {record['customer_email']}")
                failed_emails += 1
                continue

            # Send email
            if send_email_ses(record['customer_email'], subject, html_content):
                emails_sent += 1

                # Mark as sent in database (only for non-test emails)
                if not is_test:
                    campaign_data_table.update_item(
                        Key={
                            'campaign_id': record['campaign_id'],
                            'record_id': record['record_id']
                        },
                        UpdateExpression='SET email_sent = :sent, sent_at = :sent_at',
                        ExpressionAttributeValues={
                            ':sent': True,
                            ':sent_at': datetime.now().isoformat()
                        }
                    )
            else:
                failed_emails += 1

            # Update progress every 10 emails (for non-test batches)
            if not is_test and (i + 1) % 10 == 0:
                try:
                    batches_table.update_item(
                        Key={'campaign_id': campaign_id, 'batch_number': int(batch_number)},
                        UpdateExpression='SET emails_sent = :sent, failed_emails = :failed, progress_percent = :progress',
                        ExpressionAttributeValues={
                            ':sent': emails_sent,
                            ':failed': failed_emails,
                            ':progress': int((i + 1) / total_recipients * 100)
                        }
                    )
                    logger.info(f"Progress: {i + 1}/{total_recipients} ({int((i + 1) / total_recipients * 100)}%)")
                except Exception as update_error:
                    logger.warning(f"Failed to update progress: {update_error}")

            # Rate limiting
            if i > 0 and i % EMAILS_PER_SECOND == 0:
                time.sleep(1)

        # Update batch completion status (ONLY for non-test emails)
        if not is_test:
            batches_table.update_item(
                Key={'campaign_id': campaign_id, 'batch_number': int(batch_number)},
                UpdateExpression='SET #status = :status, emails_sent = :sent, completed_at = :completed, failed_emails = :failed',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'completed',
                    ':sent': emails_sent,
                    ':completed': datetime.now().isoformat(),
                    ':failed': failed_emails
                }
            )

            # Update campaign totals
            campaigns_table.update_item(
                Key={'campaign_id': campaign_id},
                UpdateExpression='ADD emails_sent :sent',
                ExpressionAttributeValues={':sent': emails_sent}
            )

            logger.info(f"Batch {batch_number}: Sent {emails_sent} emails, {failed_emails} failed")
            message = f'Batch {batch_number} completed successfully'
        else:
            logger.info(f"TEST EMAILS: Sent {emails_sent} test emails, {failed_emails} failed")
            message = f'Test emails sent successfully to {emails_sent} recipients'

        return {
            'emails_sent': emails_sent,
            'failed_emails': failed_emails,
            'total_recipients': len(records),
            'message': message,
            'is_test': is_test
        }
        
    except Exception as e:
        logger.error(f"Error sending {'test' if is_test else 'batch'} emails: {e}")

        # Mark batch as failed (ONLY for non-test emails)
        if not is_test:
            try:
                batches_table = dynamodb.Table('campaign_batches')
                batches_table.update_item(
                    Key={'campaign_id': campaign_id, 'batch_number': int(batch_number)},
                    UpdateExpression='SET #status = :status, error_message = :error',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'failed',
                        ':error': str(e)
                    }
                )
            except Exception as update_error:
                logger.error(f"Error updating batch status: {update_error}")

        raise

def lambda_handler(event, context):
    """Main Lambda handler - Updated for Lambda Function URLs"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Handle Lambda Function URL format
        if 'requestContext' in event and 'http' in event.get('requestContext', {}):
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
            # API Gateway format (fallback)
            method = event.get('httpMethod', 'POST')
            path = event.get('path', '/')
            
        logger.info(f"Method: {method}, Path: {path}")
        
        # Handle CORS preflight
        if method == 'OPTIONS':
            return cors_response(200, {})
        
        # Route requests
        if method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/send-batch'):
            return handle_send_batch(event)
        elif method == 'POST' and path.startswith('/api/campaigns/') and path.endswith('/send-test'):
            return handle_send_test(event)
        else:
            return cors_response(404, {'error': 'Endpoint not found'})
            
    except Exception as e:
        logger.error(f"Lambda handler error: {e}")
        return cors_response(500, {'error': str(e)})

def handle_send_batch(event):
    """Handle sending a specific batch"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            # Lambda Function URL format
            path = event['rawPath']
        else:
            # API Gateway format
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/send-batch
        
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)
            
        batch_number = body.get('batch_number')
        
        if not batch_number:
            return cors_response(400, {'error': 'batch_number is required'})
        
        result = send_batch_emails(campaign_id, batch_number, is_test=False)
        
        return cors_response(200, result)
        
    except Exception as e:
        logger.error(f"Error handling send batch: {e}")
        return cors_response(500, {'error': str(e)})

def handle_send_test(event):
    """Handle sending test emails"""
    try:
        # Extract campaign_id from path
        if 'rawPath' in event:
            # Lambda Function URL format
            path = event['rawPath']
        else:
            # API Gateway format
            path = event.get('path', '')
            
        path_parts = path.split('/')
        campaign_id = path_parts[3]  # /api/campaigns/{campaign_id}/send-test
        
        result = send_batch_emails(campaign_id, 1, is_test=True)
        
        return cors_response(200, result)
        
    except Exception as e:
        logger.error(f"Error handling send test: {e}")
        return cors_response(500, {'error': str(e)})