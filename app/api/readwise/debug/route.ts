import { getAllAvailableModelIds } from '@/lib/parse-all-domains';
import { getCacheStats } from '@/lib/readwise-cache';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const modelIds = getAllAvailableModelIds();
    const cacheStats = getCacheStats();
    
    return NextResponse.json({
      totalModels: modelIds.length,
      modelIds: modelIds,
      cacheStats: cacheStats,
      status: 'success'
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    );
  }
}
