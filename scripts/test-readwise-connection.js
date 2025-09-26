#!/usr/bin/env node

/**
 * Test Readwise API connection
 * This script tests if your Readwise API token is working correctly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function testReadwiseConnection() {
  const token = process.env.READWISE_API_TOKEN;
  
  if (!token || token === 'your_readwise_api_token_here') {
    console.error('❌ READWISE_API_TOKEN not found or not set in .env.local');
    console.log('📋 Please:');
    console.log('1. Go to https://readwise.io/access_token');
    console.log('2. Copy your token');
    console.log('3. Add it to .env.local file');
    process.exit(1);
  }

  console.log('🧪 Testing Readwise API connection...');
  console.log(`🔑 Token: ${token.substring(0, 8)}...${token.substring(token.length - 4)}`);

  try {
    // Test basic connection
    const response = await fetch('https://readwise.io/api/v2/highlights/?page_size=1', {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ Readwise API connection successful!');
    console.log(`📚 Total highlights available: ${data.count || 'Unknown'}`);
    
    if (data.results && data.results.length > 0) {
      const highlight = data.results[0];
      console.log(`📖 Sample highlight: "${highlight.text.substring(0, 100)}..."`);
      console.log(`📚 From: ${highlight.book_id ? 'Book ID ' + highlight.book_id : 'Unknown source'}`);
    }

    // Test books endpoint
    const booksResponse = await fetch('https://readwise.io/api/v2/books/?page_size=1', {
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (booksResponse.ok) {
      const booksData = await booksResponse.json();
      console.log(`📚 Total books available: ${booksData.count || 'Unknown'}`);
      
      if (booksData.results && booksData.results.length > 0) {
        const book = booksData.results[0];
        console.log(`📖 Sample book: "${book.title}" by ${book.author}`);
      }
    }

    console.log('');
    console.log('🎉 Your Readwise integration is ready!');
    console.log('💡 Your Mental Models Observatory can now fetch live data from Readwise');

  } catch (error) {
    console.error('❌ Readwise API connection failed:');
    console.error(`   ${error.message}`);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Check your token at https://readwise.io/access_token');
    console.log('2. Make sure you have highlights in your Readwise account');
    console.log('3. Verify your internet connection');
    process.exit(1);
  }
}

testReadwiseConnection();
