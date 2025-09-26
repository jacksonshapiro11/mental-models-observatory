import { NextRequest, NextResponse } from 'next/server';
import ReadwiseClient from '@/lib/readwise-client';
import { GetBooksParams } from '@/types/readwise';

export async function GET(request: NextRequest) {
  try {
    const token = process.env.READWISE_API_TOKEN;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Readwise API token not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params: GetBooksParams = {};

    // Parse query parameters
    if (searchParams.has('page_size')) {
      params.page_size = parseInt(searchParams.get('page_size')!);
    }
    if (searchParams.has('page_cursor')) {
      params.page_cursor = searchParams.get('page_cursor')!;
    }
    if (searchParams.has('category')) {
      params.category = searchParams.get('category')!;
    }
    if (searchParams.has('source')) {
      params.source = searchParams.get('source')!;
    }

    const client = new ReadwiseClient(token);
    const books = await client.getBooks(params);

    return NextResponse.json(books);

  } catch (error) {
    console.error('Error fetching books:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
