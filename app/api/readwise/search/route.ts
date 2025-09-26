import { NextRequest, NextResponse } from 'next/server';
import ReadwiseClient from '@/lib/readwise-client';

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
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    const client = new ReadwiseClient(token);
    const highlights = await client.searchHighlights(query);

    return NextResponse.json({
      query,
      count: highlights.length,
      results: highlights
    });

  } catch (error) {
    console.error('Error searching highlights:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
