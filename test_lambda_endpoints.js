#!/usr/bin/env node

/**
 * Test script to verify Lambda Function URL endpoints
 * Run with: node test_lambda_endpoints.js
 */

const https = require('https');

const endpoints = {
  campaign: 'https://2h7bk75jscgiryp6zt4dh3htsy0aovsr.lambda-url.us-east-1.on.aws',
  email: 'https://myylk2rmfu3njaqfxzwyvmyaru0sgwlv.lambda-url.us-east-1.on.aws'
};

function testEndpoint(name, url, path = '/') {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(path, url);
    console.log(`\nTesting ${name} endpoint: ${fullUrl.href}`);
    
    https.get(fullUrl.href, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Headers:', res.headers);
        try {
          const parsed = JSON.parse(data);
          console.log('Response:', JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log('Response (raw):', data);
        }
        resolve({ status: res.statusCode, data });
      });
    }).on('error', (err) => {
      console.error(`Error: ${err.message}`);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('Lambda Endpoint Tests');
  console.log('====================');
  
  // Test campaign endpoints
  const campaignTests = [
    { name: 'Campaign Root', path: '/' },
    { name: 'Campaigns List', path: '/campaigns' },
    { name: 'Colleges List', path: '/colleges' },
    { name: 'Test Users', path: '/test-users' }
  ];
  
  for (const test of campaignTests) {
    try {
      await testEndpoint(test.name, endpoints.campaign, test.path);
    } catch (e) {
      console.error('Test failed:', e.message);
    }
  }
  
  // Test email endpoint
  console.log('\n--- Email Sender Endpoint ---');
  try {
    await testEndpoint('Email Root', endpoints.email, '/');
  } catch (e) {
    console.error('Test failed:', e.message);
  }
}

runTests().then(() => {
  console.log('\n✅ Tests completed');
}).catch(err => {
  console.error('\n❌ Tests failed:', err);
});