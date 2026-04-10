import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SIGNAL_FILE = path.join(process.cwd(), 'data', 'daily-signal.json');

export async function GET() {
  try {
    if (!fs.existsSync(SIGNAL_FILE)) {
      return NextResponse.json(
        { error: 'No signal data available' },
        { status: 404 }
      );
    }
    const data = JSON.parse(fs.readFileSync(SIGNAL_FILE, 'utf-8'));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to read signal data:', error);
    return NextResponse.json(
      { error: 'Failed to read signal data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.date || !data.signals) {
      return NextResponse.json(
        { error: 'Missing required fields: date, signals' },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to main signal file
    fs.writeFileSync(SIGNAL_FILE, JSON.stringify(data, null, 2));

    // Store historical copy
    const archiveDir = path.join(process.cwd(), 'data', 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(archiveDir, `signal-${data.date}.json`),
      JSON.stringify(data, null, 2)
    );

    return NextResponse.json({ ok: true, date: data.date });
  } catch (error) {
    console.error('Failed to write signal data:', error);
    return NextResponse.json(
      { error: 'Failed to write signal data' },
      { status: 500 }
    );
  }
}
