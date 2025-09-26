#!/usr/bin/env node

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const READWISE_API_TOKEN = process.env.READWISE_API_TOKEN;

if (!READWISE_API_TOKEN) {
  console.error('❌ READWISE_API_TOKEN not found in environment variables');
  console.log('Please add your Readwise API token to .env.local');
  process.exit(1);
}

console.log('🧪 Testing Readwise API Integration...\n');

async function testReadwiseAPI() {
  const baseURL = 'http://localhost:3000/api/readwise';
  
  const tests = [
    {
      name: 'Test Highlights Endpoint',
      url: `${baseURL}/highlights?page_size=5`,
      method: 'GET'
    },
    {
      name: 'Test Books Endpoint',
      url: `${baseURL}/books?page_size=5`,
      method: 'GET'
    },
    {
      name: 'Test Search Endpoint',
      url: `${baseURL}/search?q=mental`,
      method: 'GET'
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      
      const response = await fetch(test.url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      console.log(`✅ ${test.name} - PASSED`);
      console.log(`   Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...\n`);
      passedTests++;

    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Error: ${error.message}\n`);
    }
  }

  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Readwise API integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the server logs and API configuration.');
  }
}

async function testDirectAPI() {
  console.log('🔗 Testing Direct Readwise API Connection...\n');

  try {
    const response = await fetch('https://readwise.io/api/v2/highlights/', {
      headers: {
        'Authorization': `Token ${READWISE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Direct API connection successful');
    console.log(`   Found ${data.count} highlights`);
    console.log(`   Sample highlight: ${data.results[0]?.text?.substring(0, 100)}...\n`);

  } catch (error) {
    console.log('❌ Direct API connection failed');
    console.log(`   Error: ${error.message}\n`);
  }
}

async function runTests() {
  // Test direct API connection first
  await testDirectAPI();
  
  // Test Next.js API routes (requires server to be running)
  console.log('🌐 Testing Next.js API Routes...\n');
  console.log('Note: Make sure the development server is running (npm run dev)\n');
  
  await testReadwiseAPI();
}

// Run the tests
runTests().catch(console.error);
