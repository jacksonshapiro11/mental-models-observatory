import fs from 'fs';
import path from 'path';

export interface PortfolioPosition {
  name: string;
  ticker: string;
  tier: 'Core' | 'Satellite' | 'Optionality';
  mispricingMarket: string;
  mispricingOurs: string;
  theses: string;
  conviction: string;
  signal: string;
  keyAssumptions: { text: string; probability: string; track: string; kill: string }[];
  killCriteria: string[];
  preMortem: string[];
  entryDate: string;
  entryPrice: string;
}

export interface Portfolio {
  status: string;
  positions: PortfolioPosition[];
  core: PortfolioPosition[];
  satellite: PortfolioPosition[];
  optionality: PortfolioPosition[];
}

export function parsePortfolioTracker(): Portfolio | null {
  const filePath = path.join(process.cwd(), 'system/Portfolio_Tracker.md');
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const positions: PortfolioPosition[] = [];

  // Extract status
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
  const status = statusMatch ? statusMatch[1].trim() : 'Unknown';

  // Split into position blocks — each starts with ### followed by position name
  const positionBlocks = content.split(/\n### /).slice(1);

  let currentTier: 'Core' | 'Satellite' | 'Optionality' = 'Core';

  for (const block of positionBlocks) {
    // Skip snapshot table headers
    if (block.startsWith('CORE —') || block.startsWith('SATELLITE —') || block.startsWith('OPTIONALITY —')) {
      if (block.startsWith('SATELLITE')) currentTier = 'Satellite';
      if (block.startsWith('OPTIONALITY')) currentTier = 'Optionality';
      continue;
    }

    const lines = block.split('\n');
    const headerLine = lines[0] || '';

    // Extract name and ticker from header like "AEM — Agnico Eagle Mines"
    const headerMatch = headerLine.match(/^(.+?)(?:\s*—\s*(.+))?$/);
    if (!headerMatch) continue;

    const ticker = headerMatch[1]?.trim() || '';
    const name = headerMatch[2]?.trim() || ticker;

    // Skip if this doesn't look like a position (no TIER line)
    if (!block.includes('**TIER:**')) continue;

    // Extract tier
    const tierMatch = block.match(/\*\*TIER:\*\*\s*(\w+)/);
    if (tierMatch) {
      const t = tierMatch[1];
      if (t === 'Core' || t === 'Satellite' || t === 'Optionality') currentTier = t;
    }

    // Extract mispricing
    const marketBelieves = block.match(/The market believes:?\s*(.+?)(?:\n|$)/)?.[1]?.trim() || '';
    const webelieve = block.match(/We believe:?\s*(.+?)(?:\n|$)/)?.[1]?.trim() || '';

    // Extract theses from snapshot tables or inline
    const thesesMatch = block.match(/\*\*(?:VARIANT PERCEPTION|MISPRICING).*?\n/);

    // Extract key assumptions
    const assumptions: { text: string; probability: string; track: string; kill: string }[] = [];
    const assumptionRegex = /^\d+\.\s+(.+?)(?:\s*—\s*Prob:\s*(\d+%))?\s*(?:—\s*Track via:\s*(.+?))?\s*(?:—\s*Kill:\s*(.+?))?$/gm;
    const keyAssSection = block.match(/\*\*KEY ASSUMPTIONS:\*\*([\s\S]*?)(?=\*\*PRE-MORTEM|\*\*EXPECTED|---|\n##)/);
    if (keyAssSection) {
      const assLines = keyAssSection[1].split('\n').filter(l => /^\d+\./.test(l.trim()));
      for (const line of assLines) {
        const parts = line.trim().match(/^\d+\.\s+(.+?)(?:\s*—\s*Prob:\s*(\d+%))?\s*(?:—\s*Track via:\s*(.+?))?\s*(?:—\s*Kill:\s*(.+?))?$/);
        if (parts) {
          assumptions.push({
            text: parts[1] || '',
            probability: parts[2] || '',
            track: parts[3] || '',
            kill: parts[4] || '',
          });
        }
      }
    }

    // Extract kill criteria from Taleb test or key assumptions
    const killCriteria: string[] = [];
    const killSection = block.match(/\*\*KILL(?:\sCRITERIA|\sSIGNALS?):\*\*([\s\S]*?)(?=\*\*|---|\n##)/);
    if (killSection) {
      const kills = killSection[1].split('\n').filter(l => l.trim().startsWith('-'));
      for (const k of kills) killCriteria.push(k.trim().replace(/^-\s*/, ''));
    }
    // Also extract kills from assumptions
    for (const a of assumptions) {
      if (a.kill) killCriteria.push(a.kill);
    }

    // Extract pre-mortem
    const preMortem: string[] = [];
    const pmSection = block.match(/\*\*PRE-MORTEM:\*\*([\s\S]*?)(?=\*\*EXPECTED|\*\*POSITION|---|\n##)/);
    if (pmSection) {
      const pms = pmSection[1].split('\n').filter(l => /^\d+\./.test(l.trim()));
      for (const pm of pms) preMortem.push(pm.trim().replace(/^\d+\.\s*/, ''));
    }

    // Entry info
    const entryDate = block.match(/\*\*ENTRY DATE:\*\*\s*(.+)/)?.[1]?.trim() || 'Pending';
    const entryPrice = block.match(/\*\*ENTRY PRICE:\*\*\s*(.+)/)?.[1]?.trim() || 'Pending';

    // Theses tag from snapshot or variant perception
    const thesesTag = block.match(/T\d+\s*\([^)]+\)/)?.[0] || '';

    positions.push({
      name,
      ticker,
      tier: currentTier,
      mispricingMarket: marketBelieves,
      mispricingOurs: webelieve,
      theses: thesesTag,
      conviction: '●',
      signal: entryDate === 'Pending' || entryDate.includes('Pending') ? 'Pending entry' : 'Active',
      keyAssumptions: assumptions,
      killCriteria,
      preMortem,
      entryDate,
      entryPrice,
    });
  }

  return {
    status,
    positions,
    core: positions.filter(p => p.tier === 'Core'),
    satellite: positions.filter(p => p.tier === 'Satellite'),
    optionality: positions.filter(p => p.tier === 'Optionality'),
  };
}
