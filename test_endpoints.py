#!/usr/bin/env python3
"""
Test script to verify email campaign system endpoints and data flow
Run this to diagnose issues with template generation and preview
"""

import requests
import json
import sys
from datetime import datetime

# API Endpoints
CAMPAIGN_MANAGER_URL = "https://swo7vvd3f5tppvqczsrjmqnv6m0eqfdn.lambda-url.us-east-1.on.aws"
AI_TEMPLATE_EDITOR_URL = "https://jya2onwln6iewhxhxbrjwzpd7a0oudxo.lambda-url.us-east-1.on.aws"

def print_section(title):
    """Print a section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80 + "\n")

def test_get_campaigns():
    """Test: Get all campaigns"""
    print_section("TEST 1: Get All Campaigns")

    try:
        response = requests.get(f"{CAMPAIGN_MANAGER_URL}/api/campaigns")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            campaigns = data.get('campaigns', [])
            print(f"✓ Found {len(campaigns)} campaigns")

            if campaigns:
                print("\nRecent campaigns:")
                for camp in campaigns[:3]:
                    print(f"  - {camp['campaign_id']}: {camp.get('campaign_name', 'N/A')} (Status: {camp.get('status', 'N/A')})")
                return campaigns[0]['campaign_id']  # Return first campaign ID for testing
        else:
            print(f"✗ Error: {response.text}")

    except Exception as e:
        print(f"✗ Exception: {e}")

    return None

def test_get_campaign_detail(campaign_id):
    """Test: Get campaign details"""
    print_section(f"TEST 2: Get Campaign Detail - {campaign_id}")

    try:
        response = requests.get(f"{CAMPAIGN_MANAGER_URL}/api/campaigns/{campaign_id}")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            campaign = response.json()
            print(f"✓ Campaign Name: {campaign.get('campaign_name', 'N/A')}")
            print(f"✓ Status: {campaign.get('status', 'N/A')}")
            print(f"✓ Total Recipients: {campaign.get('total_recipients', 'N/A')}")
            print(f"✓ Total Batches: {campaign.get('total_batches', 'N/A')}")
            print(f"✓ Created: {campaign.get('created_at', 'N/A')}")
            return campaign
        else:
            print(f"✗ Error: {response.text}")

    except Exception as e:
        print(f"✗ Exception: {e}")

    return None

def test_get_campaign_data_sample(campaign_id, limit=5):
    """Test: Get sample campaign_data records"""
    print_section(f"TEST 3: Get Campaign Data Sample - {campaign_id}")

    try:
        # This would need a direct DynamoDB query, but let's check batches instead
        response = requests.get(f"{CAMPAIGN_MANAGER_URL}/api/campaigns/{campaign_id}/batches/1/recipients")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            recipients = response.json()
            print(f"✓ Found {len(recipients)} recipients in batch 1")

            if recipients:
                print("\nFirst recipient data structure:")
                first = recipients[0]
                print(f"  - Record ID: {first.get('record_id', 'N/A')}")
                print(f"  - Email: {first.get('email', 'N/A')}")
                print(f"  - Recipient Name: {first.get('recipient_name', 'N/A')}")
                print(f"  - School Code: {first.get('school_code', 'N/A')}")
                print(f"  - Product Count: {first.get('product_count', 'N/A')}")

                # Check product fields
                print("\n  Product fields:")
                for i in range(1, 5):
                    if first.get(f'product_name_{i}'):
                        print(f"    Product {i}:")
                        print(f"      - Name: {first.get(f'product_name_{i}', 'N/A')}")
                        print(f"      - Price: {first.get(f'product_price_{i}', 'N/A')}")
                        print(f"      - Image: {first.get(f'product_image_{i}', 'N/A')[:50]}..." if first.get(f'product_image_{i}') else "      - Image: N/A")
                        print(f"      - Link: {first.get(f'product_link_{i}', 'N/A')[:50]}..." if first.get(f'product_link_{i}') else "      - Link: N/A")

                return recipients[0]  # Return first recipient for testing
        else:
            print(f"✗ Error: {response.text}")

    except Exception as e:
        print(f"✗ Exception: {e}")

    return None

def test_get_template_instance(campaign_id):
    """Test: Get template instance"""
    print_section(f"TEST 4: Get Template Instance - {campaign_id}")

    try:
        response = requests.get(f"{AI_TEMPLATE_EDITOR_URL}/api/campaigns/{campaign_id}/template-instance")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            template = data.get('template_instance')

            if template:
                print(f"✓ Template exists for campaign")
                print(f"  - AI Generated: {template.get('ai_generated', False)}")
                print(f"  - Created: {template.get('created_at', 'N/A')}")
                print(f"  - Last Modified: {template.get('last_modified', 'N/A')}")

                config = template.get('template_config', {})
                print("\n  Template Config:")
                print(f"    - CAMPAIGN_TITLE: {config.get('CAMPAIGN_TITLE', 'N/A')}")
                print(f"    - MAIN_TITLE: {config.get('MAIN_TITLE', 'N/A')}")
                print(f"    - GREETING_TEXT: {config.get('GREETING_TEXT', 'N/A')}")
                print(f"    - DESCRIPTION_TEXT: {config.get('DESCRIPTION_TEXT', 'N/A')[:80]}..." if config.get('DESCRIPTION_TEXT') else "    - DESCRIPTION_TEXT: N/A")
                print(f"    - PRODUCTS_TITLE: {config.get('PRODUCTS_TITLE', 'N/A')}")
                print(f"    - PRODUCTS_HTML length: {len(config.get('PRODUCTS_HTML', ''))} chars")

                # Check if PRODUCTS_HTML is just a comment or actual HTML
                products_html = config.get('PRODUCTS_HTML', '')
                if '<!--' in products_html and '-->' in products_html and '<td' not in products_html:
                    print(f"    ⚠ WARNING: PRODUCTS_HTML is just a comment, no actual product grid!")
                elif '<td' in products_html and '<img' in products_html:
                    print(f"    ✓ PRODUCTS_HTML contains actual product grid")

                campaign_analysis = template.get('campaign_analysis', {})
                if campaign_analysis:
                    print("\n  Campaign Analysis:")
                    print(f"    - Total Products: {campaign_analysis.get('total_products', 'N/A')}")
                    print(f"    - Total Schools: {campaign_analysis.get('total_schools', 'N/A')}")
                    print(f"    - Sample Products: {len(campaign_analysis.get('sample_products', []))}")

                return template
            else:
                print("✗ No template instance found")

        elif response.status_code == 404:
            print("✗ Template instance not found (may need to be created)")
        else:
            print(f"✗ Error: {response.text}")

    except Exception as e:
        print(f"✗ Exception: {e}")

    return None

def test_create_template_instance(campaign_id):
    """Test: Create template instance"""
    print_section(f"TEST 5: Create Template Instance - {campaign_id}")

    try:
        response = requests.post(
            f"{AI_TEMPLATE_EDITOR_URL}/api/campaigns/{campaign_id}/create-template-instance",
            json={}
        )
        print(f"Status Code: {response.status_code}")

        if response.status_code == 201:
            data = response.json()
            print(f"✓ Template instance created successfully")
            print(f"  - AI Generated: {data.get('ai_generated', False)}")

            template = data.get('template_instance', {})
            config = template.get('template_config', {})

            print("\n  Generated Config:")
            print(f"    - CAMPAIGN_TITLE: {config.get('CAMPAIGN_TITLE', 'N/A')}")
            print(f"    - MAIN_TITLE: {config.get('MAIN_TITLE', 'N/A')}")
            print(f"    - GREETING_TEXT: {config.get('GREETING_TEXT', 'N/A')}")
            print(f"    - PRODUCTS_HTML length: {len(config.get('PRODUCTS_HTML', ''))} chars")

            return template
        else:
            print(f"✗ Error: {response.text}")

    except Exception as e:
        print(f"✗ Exception: {e}")

    return None

def test_preview_recipient_email(campaign_id, record_id):
    """Test: Preview recipient email"""
    print_section(f"TEST 6: Preview Recipient Email - {campaign_id}/{record_id}")

    try:
        response = requests.get(f"{CAMPAIGN_MANAGER_URL}/api/campaigns/{campaign_id}/preview/{record_id}")
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            html = data.get('html', '')

            print(f"✓ Preview generated successfully")
            print(f"  - HTML length: {len(html)} chars")

            # Check if HTML contains personalized data
            if 'Hi there,' in html and 'New Collection' in html:
                print("  ⚠ WARNING: Preview contains generic/default content")

            # Check if products are included
            if '<img src="http' in html and 'product' in html.lower():
                print("  ✓ Preview contains product images")
            else:
                print("  ⚠ WARNING: Preview may not contain product images")

            # Save preview to file
            filename = f"preview_{campaign_id}_{record_id}.html"
            with open(filename, 'w') as f:
                f.write(html)
            print(f"\n  Preview saved to: {filename}")

            return html
        else:
            print(f"✗ Error: {response.text}")

    except Exception as e:
        print(f"✗ Exception: {e}")

    return None

def main():
    """Run all tests"""
    print("\n" + "█"*80)
    print("  EMAIL CAMPAIGN SYSTEM - ENDPOINT TESTING")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("█"*80)

    # Test 1: Get campaigns
    campaign_id = test_get_campaigns()

    if not campaign_id:
        print("\n✗ No campaigns found. Please create a campaign first.")
        return

    # Test 2: Get campaign details
    campaign = test_get_campaign_detail(campaign_id)

    if not campaign:
        print("\n✗ Could not get campaign details")
        return

    # Test 3: Get campaign data sample
    sample_recipient = test_get_campaign_data_sample(campaign_id)

    if not sample_recipient:
        print("\n✗ No campaign data found. Campaign may not have been processed yet.")
        return

    # Test 4: Get template instance
    template = test_get_template_instance(campaign_id)

    # Test 5: Create template instance if it doesn't exist
    if not template:
        print("\nTemplate doesn't exist, creating...")
        template = test_create_template_instance(campaign_id)

    # Test 6: Preview recipient email
    if sample_recipient:
        record_id = sample_recipient.get('record_id')
        if record_id:
            test_preview_recipient_email(campaign_id, record_id)

    # Summary
    print_section("SUMMARY")
    print("✓ Tests completed")
    print("\nNext steps:")
    print("1. Review the preview HTML file generated")
    print("2. Check if template contains AI-generated content")
    print("3. Verify products are displayed in preview")
    print("4. Check CloudWatch logs for any errors")

if __name__ == "__main__":
    main()
