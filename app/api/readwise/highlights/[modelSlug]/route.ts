import { getModelHighlights } from '@/lib/readwise-highlights';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelSlug: string }> }
) {
  try {
    const { modelSlug } = await params;
    
    if (!modelSlug) {
      return NextResponse.json(
        { error: 'Model slug is required' },
        { status: 400 }
      );
    }

    const highlights = await getModelHighlights(modelSlug);
    
    return NextResponse.json(highlights);
  } catch (error) {
    console.error('Error fetching model highlights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch highlights' },
      { status: 500 }
    );
  }
}
