import { NextRequest, NextResponse } from 'next/server';
import ReadwiseClient from '@/lib/readwise-client';
import { GetHighlightsParams } from '@/types/readwise';

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
    const params: GetHighlightsParams = {};

    // Parse query parameters
    if (searchParams.has('page_size')) {
      params.page_size = parseInt(searchParams.get('page_size')!);
    }
    if (searchParams.has('page_cursor')) {
      params.page_cursor = searchParams.get('page_cursor')!;
    }
    if (searchParams.has('book_id')) {
      params.book_id = parseInt(searchParams.get('book_id')!);
    }
    if (searchParams.has('updated__gt')) {
      params.updated__gt = searchParams.get('updated__gt')!;
    }
    if (searchParams.has('search')) {
      params.search = searchParams.get('search')!;
    }

    const client = new ReadwiseClient(token);
    const highlights = await client.getHighlights(params);

    return NextResponse.json(highlights);

  } catch (error) {
    console.error('Error fetching highlights:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
