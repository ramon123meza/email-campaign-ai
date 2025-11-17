#!/usr/bin/env python3
"""
Populate college-db-email table with school names

This script adds common NCAA school codes with their full names to the
college-db-email DynamoDB table. Run this to fix the "AKN" vs "Akron Zips" issue.

Usage:
    python populate_school_names.py
"""

import boto3
from boto3.dynamodb.conditions import Key
import json

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
college_db_table = dynamodb.Table('college-db-email')

# Common NCAA schools - Add your schools here
SCHOOLS = [
    {"school_code": "AKN", "school_name": "Akron Zips"},
    {"school_code": "ALA", "school_name": "Alabama Crimson Tide"},
    {"school_code": "ALB", "school_name": "Albany Great Danes"},
    {"school_code": "ALC", "school_name": "Alcorn State Braves"},
    {"school_code": "ALS", "school_name": "Alabama State Hornets"},
    {"school_code": "APS", "school_name": "Appalachian State Mountaineers"},
    {"school_code": "ARK", "school_name": "Arkansas Razorbacks"},
    {"school_code": "ARS", "school_name": "Arkansas State Red Wolves"},
    {"school_code": "ATU", "school_name": "Arkansas Tech Wonder Boys"},
    {"school_code": "AUB", "school_name": "Auburn Tigers"},
    {"school_code": "BALL", "school_name": "Ball State Cardinals"},
    {"school_code": "BAY", "school_name": "Baylor Bears"},
    {"school_code": "BGU", "school_name": "Bowling Green Falcons"},
    {"school_code": "BST", "school_name": "Boise State Broncos"},
    {"school_code": "BUT", "school_name": "Butler Bulldogs"},
    {"school_code": "BYU", "school_name": "BYU Cougars"},
    {"school_code": "CCU", "school_name": "Coastal Carolina Chanticleers"},
    {"school_code": "CHAR", "school_name": "Charlotte 49ers"},
    {"school_code": "CHI", "school_name": "Chicago State Cougars"},
    {"school_code": "CHIC", "school_name": "Chicago Maroons"},
    {"school_code": "CLE", "school_name": "Clemson Tigers"},
    {"school_code": "CMI", "school_name": "Central Michigan Chippewas"},
    {"school_code": "CMP", "school_name": "Campbell Fighting Camels"},
    {"school_code": "CNU", "school_name": "Christopher Newport Captains"},
    {"school_code": "CO", "school_name": "Colorado Buffaloes"},
    {"school_code": "COL", "school_name": "Columbia Lions"},
    {"school_code": "CSL", "school_name": "Charleston Southern Buccaneers"},
    {"school_code": "DAV", "school_name": "Davidson Wildcats"},
    {"school_code": "DAY", "school_name": "Dayton Flyers"},
    {"school_code": "DEL", "school_name": "Delaware Fightin' Blue Hens"},
    {"school_code": "DUKE", "school_name": "Duke Blue Devils"},
    {"school_code": "FLA", "school_name": "Florida Gators"},
    {"school_code": "FSU", "school_name": "Florida State Seminoles"},
    {"school_code": "GA", "school_name": "Georgia Bulldogs"},
    {"school_code": "GT", "school_name": "Georgia Tech Yellow Jackets"},
    {"school_code": "HOUS", "school_name": "Houston Cougars"},
    {"school_code": "ILL", "school_name": "Illinois Fighting Illini"},
    {"school_code": "IND", "school_name": "Indiana Hoosiers"},
    {"school_code": "IOWA", "school_name": "Iowa Hawkeyes"},
    {"school_code": "ISU", "school_name": "Iowa State Cyclones"},
    {"school_code": "KAN", "school_name": "Kansas Jayhawks"},
    {"school_code": "KSU", "school_name": "Kansas State Wildcats"},
    {"school_code": "KY", "school_name": "Kentucky Wildcats"},
    {"school_code": "LSU", "school_name": "LSU Tigers"},
    {"school_code": "LOU", "school_name": "Louisville Cardinals"},
    {"school_code": "MD", "school_name": "Maryland Terrapins"},
    {"school_code": "MI", "school_name": "Michigan Wolverines"},
    {"school_code": "MIST", "school_name": "Michigan State Spartans"},
    {"school_code": "MINN", "school_name": "Minnesota Golden Gophers"},
    {"school_code": "MISS", "school_name": "Ole Miss Rebels"},
    {"school_code": "MIZZ", "school_name": "Missouri Tigers"},
    {"school_code": "MSU", "school_name": "Mississippi State Bulldogs"},
    {"school_code": "NC", "school_name": "North Carolina Tar Heels"},
    {"school_code": "NCST", "school_name": "NC State Wolfpack"},
    {"school_code": "NEB", "school_name": "Nebraska Cornhuskers"},
    {"school_code": "ND", "school_name": "Notre Dame Fighting Irish"},
    {"school_code": "NW", "school_name": "Northwestern Wildcats"},
    {"school_code": "OHI", "school_name": "Ohio Bobcats"},
    {"school_code": "OK", "school_name": "Oklahoma Sooners"},
    {"school_code": "OKST", "school_name": "Oklahoma State Cowboys"},
    {"school_code": "ORE", "school_name": "Oregon Ducks"},
    {"school_code": "ORST", "school_name": "Oregon State Beavers"},
    {"school_code": "OSU", "school_name": "Ohio State Buckeyes"},
    {"school_code": "PENN", "school_name": "Penn State Nittany Lions"},
    {"school_code": "PITT", "school_name": "Pittsburgh Panthers"},
    {"school_code": "PUR", "school_name": "Purdue Boilermakers"},
    {"school_code": "RAD", "school_name": "Radford Highlanders"},
    {"school_code": "RUTG", "school_name": "Rutgers Scarlet Knights"},
    {"school_code": "SC", "school_name": "South Carolina Gamecocks"},
    {"school_code": "STAN", "school_name": "Stanford Cardinal"},
    {"school_code": "SYR", "school_name": "Syracuse Orange"},
    {"school_code": "TCU", "school_name": "TCU Horned Frogs"},
    {"school_code": "TENN", "school_name": "Tennessee Volunteers"},
    {"school_code": "TEX", "school_name": "Texas Longhorns"},
    {"school_code": "TEXM", "school_name": "Texas A&M Aggies"},
    {"school_code": "TXST", "school_name": "Texas State Bobcats"},
    {"school_code": "TXTE", "school_name": "Texas Tech Red Raiders"},
    {"school_code": "UCLA", "school_name": "UCLA Bruins"},
    {"school_code": "USC", "school_name": "USC Trojans"},
    {"school_code": "UTAH", "school_name": "Utah Utes"},
    {"school_code": "VAN", "school_name": "Vanderbilt Commodores"},
    {"school_code": "VT", "school_name": "Virginia Tech Hokies"},
    {"school_code": "UVA", "school_name": "Virginia Cavaliers"},
    {"school_code": "WAKE", "school_name": "Wake Forest Demon Deacons"},
    {"school_code": "WASH", "school_name": "Washington Huskies"},
    {"school_code": "WAST", "school_name": "Washington State Cougars"},
    {"school_code": "WIS", "school_name": "Wisconsin Badgers"},
    {"school_code": "WVU", "school_name": "West Virginia Mountaineers"},
]

def check_existing_schools():
    """Check which schools already exist in the table"""
    print("Checking existing schools in college-db-email table...")
    existing = []

    try:
        response = college_db_table.scan()
        existing = [item.get('school_code') for item in response.get('Items', [])]
        print(f"Found {len(existing)} existing schools: {', '.join(existing[:10])}{'...' if len(existing) > 10 else ''}")
    except Exception as e:
        print(f"Error checking existing schools: {e}")

    return existing

def add_school(school):
    """Add a single school to the table

    NOTE: The college-db-email table has partition key 'school_name' (the full name),
    and 'school_code' is just an attribute.
    """
    try:
        # The partition key is school_name, not school_code
        item = {
            'school_name': school['school_name'],  # This is the partition key!
            'school_code': school['school_code'],  # This is just an attribute
            'school_page': f"https://www.rrinconline.com/collections/{school['school_code'].lower()}",
            'school_logo': ''  # Add your logo URL pattern here
        }

        college_db_table.put_item(Item=item)
        return True
    except Exception as e:
        print(f"  Error adding {school['school_code']}: {e}")
        return False

def populate_schools():
    """Populate all schools"""
    print(f"\nPopulating {len(SCHOOLS)} schools...")
    existing = check_existing_schools()

    added = 0
    skipped = 0
    failed = 0

    for school in SCHOOLS:
        code = school['school_code']

        if code in existing:
            print(f"  ⏭️  {code:10s} - Already exists")
            skipped += 1
        else:
            if add_school(school):
                print(f"  ✅ {code:10s} - Added: {school['school_name']}")
                added += 1
            else:
                failed += 1

    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Added:   {added}")
    print(f"  Skipped: {skipped}")
    print(f"  Failed:  {failed}")
    print(f"  Total:   {len(SCHOOLS)}")
    print(f"{'='*60}")

def verify_lookups():
    """Verify a few school lookups work

    NOTE: Must use scan() since school_code is an attribute, not the partition key.
    """
    print("\nVerifying school lookups...")
    test_codes = ['AKN', 'ALA', 'RAD', 'HOUS', 'OSU']

    for code in test_codes:
        try:
            # Must scan since school_code is not the partition key
            response = college_db_table.scan(
                FilterExpression=Attr('school_code').eq(code)
            )
            items = response.get('Items', [])
            if items:
                name = items[0].get('school_name', 'NOT FOUND')
                print(f"  ✅ {code:6s} → {name}")
            else:
                print(f"  ❌ {code:6s} → NOT FOUND IN TABLE")
        except Exception as e:
            print(f"  ❌ {code:6s} → ERROR: {e}")

if __name__ == '__main__':
    print("="*60)
    print("Populating college-db-email Table")
    print("="*60)

    try:
        populate_schools()
        verify_lookups()

        print("\n✅ Done! School names should now appear in your emails.")
        print("\nNext steps:")
        print("1. Send a test email")
        print("2. Check that you see 'Akron Zips' instead of 'AKN'")
        print("3. Check CloudWatch logs for: 'Found school entry: school_code='AKN', school_name='Akron Zips'")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
