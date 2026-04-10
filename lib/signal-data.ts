import fs from 'fs';
import path from 'path';

export interface SignalItem {
  text: string;
  color: 'red' | 'green' | 'yellow';
  domain: string;
  terminalLine: string;
}

export interface SignalData {
  date: string;
  edition: number;
  format: string;
  lifeNote: string;
  headline: string;
  tldr: string;
  signals: SignalItem[];
  take: {
    title: string;
    subtitle: string;
    preview: string;
    framework: string;
  };
  innerGame: {
    quote: string;
    attribution: string;
    action: string;
  };
  model: {
    name: string;
    slug: string;
    preview: string;
  };
  updatedAt: string;
  briefUrl: string;
}

const SIGNAL_FILE = path.join(process.cwd(), 'data', 'daily-signal.json');

export function getSignalData(): SignalData | null {
  try {
    if (!fs.existsSync(SIGNAL_FILE)) return null;
    const raw = fs.readFileSync(SIGNAL_FILE, 'utf-8');
    return JSON.parse(raw) as SignalData;
  } catch {
    return null;
  }
}

export function getSignalDataSync(): SignalData | null {
  try {
    const signalPath = path.join(process.cwd(), 'data', 'daily-signal.json');
    if (!fs.existsSync(signalPath)) return null;
    const raw = fs.readFileSync(signalPath, 'utf-8');
    return JSON.parse(raw) as SignalData;
  } catch {
    return null;
  }
}
