#!/usr/bin/env python3
"""
Regenerate templates for existing campaigns

This fixes templates that were created before the personalization improvements.
Run this after deploying the updated Lambda functions.

Usage:
    python regenerate_templates.py [campaign_id]
    python regenerate_templates.py                  # Regenerate all
"""

import boto3
import sys
import requests
import json

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
template_instances_table = dynamodb.Table('campaign_template_instances')
campaigns_table = dynamodb.Table('email_campaigns')

# Lambda Function URL - UPDATE THIS WITH YOUR ACTUAL URL
LAMBDA_URL = "https://YOUR-LAMBDA-URL.lambda-url.us-east-1.on.aws"

def get_all_campaigns():
    """Get all campaign IDs"""
    try:
        response = campaigns_table.scan(ProjectionExpression='campaign_id')
        return [item['campaign_id'] for item in response.get('Items', [])]
    except Exception as e:
        print(f"Error getting campaigns: {e}")
        return []

def delete_template_instance(campaign_id):
    """Delete existing template instance"""
    try:
        template_instances_table.delete_item(Key={'campaign_id': campaign_id})
        print(f"  ✅ Deleted old template for {campaign_id}")
        return True
    except Exception as e:
        print(f"  ❌ Error deleting template: {e}")
        return False

def regenerate_template(campaign_id):
    """Regenerate template by calling Lambda endpoint"""
    try:
        url = f"{LAMBDA_URL}/api/campaigns/{campaign_id}/ai-template"
        response = requests.post(url, json={}, timeout=30)

        if response.status_code == 201:
            data = response.json()
            print(f"  ✅ Created new template (AI-generated: {data.get('ai_generated', False)})")
            return True
        else:
            print(f"  ❌ Error creating template: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  ❌ Error calling Lambda: {e}")
        return False

def regenerate_campaigns(campaign_ids):
    """Regenerate templates for list of campaigns"""
    print(f"\nRegenerating templates for {len(campaign_ids)} campaigns...\n")

    success = 0
    failed = 0

    for campaign_id in campaign_ids:
        print(f"Campaign: {campaign_id}")

        # Delete old template
        if delete_template_instance(campaign_id):
            # Create new template
            if regenerate_template(campaign_id):
                success += 1
            else:
                failed += 1
        else:
            failed += 1

        print()  # Blank line

    print(f"{'='*60}")
    print(f"Summary:")
    print(f"  Success: {success}")
    print(f"  Failed:  {failed}")
    print(f"  Total:   {len(campaign_ids)}")
    print(f"{'='*60}")

if __name__ == '__main__':
    print("="*60)
    print("Regenerate Campaign Templates")
    print("="*60)

    # Check if specific campaign ID provided
    if len(sys.argv) > 1:
        campaign_id = sys.argv[1]
        print(f"\nRegenerating template for campaign: {campaign_id}")
        regenerate_campaigns([campaign_id])
    else:
        # Regenerate all campaigns
        print("\nFetching all campaigns...")
        campaign_ids = get_all_campaigns()

        if not campaign_ids:
            print("❌ No campaigns found")
            sys.exit(1)

        print(f"Found {len(campaign_ids)} campaigns")
        print(f"Campaigns: {', '.join(campaign_ids)}")

        # Confirm
        response = input(f"\n⚠️  This will delete and recreate ALL {len(campaign_ids)} templates. Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled")
            sys.exit(0)

        regenerate_campaigns(campaign_ids)

    print("\n✅ Done! Templates have been regenerated with:")
    print("   - Product-specific content")
    print("   - Per-recipient personalization")
    print("   - School name resolution")
    print("\nNext steps:")
    print("1. Open Campaign Editor and check preview")
    print("2. Send test email")
    print("3. Verify personalization is working")
