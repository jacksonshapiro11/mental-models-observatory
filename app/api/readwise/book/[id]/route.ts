import { NextRequest, NextResponse } from 'next/server';
import ReadwiseClient from '@/lib/readwise-client';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const token = process.env.READWISE_API_TOKEN;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Readwise API token not configured' },
        { status: 500 }
      );
    }

    const bookId = parseInt(id);
    
    if (isNaN(bookId)) {
      return NextResponse.json(
        { error: 'Invalid book ID' },
        { status: 400 }
      );
    }

    const client = new ReadwiseClient(token);
    
    // Get book details and highlights in parallel
    const [book, highlightsResponse] = await Promise.all([
      client.getBookById(bookId),
      client.getHighlightsByBook(bookId)
    ]);

    return NextResponse.json({
      book,
      highlights: highlightsResponse.results,
      highlightsCount: highlightsResponse.count
    });

  } catch (error) {
    console.error('Error fetching book:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
