'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Signal {
  text: string;
  color: 'red' | 'green' | 'yellow';
  domain: string;
  terminalLine: string;
}

interface SplitFlapSignalsProps {
  signals: Signal[];
  visibleCount?: number;
  rotateIntervalMs?: number;
  scrambleDurationMs?: number;
}

// ─── Character set for the split-flap effect ────────────────────────────────

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%&#@!?+-.:;/|~';

function randomChar(): string {
  return FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)] ?? 'X';
}

// ─── Build display string: resolved chars + scrambled chars ─────────────────

function buildDisplay(target: string, ratio: number): string {
  if (ratio >= 1) return target;
  if (ratio <= 0) {
    // Fully scrambled
    return target
      .split('')
      .map(ch => (ch === ' ' ? ' ' : randomChar()))
      .join('');
  }

  const len = target.length;
  const resolved = Math.floor(ratio * len);
  const chars: string[] = [];

  for (let i = 0; i < len; i++) {
    if (i < resolved) {
      chars.push(target[i] ?? ' ');
    } else if (target[i] === ' ') {
      chars.push(' ');
    } else {
      chars.push(randomChar());
    }
  }
  return chars.join('');
}

// ─── Single signal line ─────────────────────────────────────────────────────

function SplitFlapLine({
  text,
  color,
  resolveRatio,
}: {
  text: string;
  color: 'red' | 'green' | 'yellow';
  resolveRatio: number;
}) {
  const colorClass =
    color === 'green' ? 'text-ct-green-data' :
    color === 'red' ? 'text-ct-pink' :
    'text-ct-yellow';

  return (
    <div className="flex items-start gap-1 overflow-hidden h-[1.35rem]">
      <span className={`${colorClass} flex-shrink-0`}>&gt;</span>
      <span
        className={`transition-opacity duration-200 ${resolveRatio < 0.7 ? 'opacity-50' : 'opacity-100'}`}
        style={{ fontFamily: 'monospace' }}
      >
        {buildDisplay(text, resolveRatio)}
      </span>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
// Rotates through all signals in pages of `visibleCount`.
// Each rotation triggers a split-flap scramble → resolve animation.

export function SplitFlapSignals({
  signals,
  visibleCount = 5,
  rotateIntervalMs = 30000,
  scrambleDurationMs = 1400,
}: SplitFlapSignalsProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [resolveRatio, setResolveRatio] = useState(0);
  const animFrame = useRef(0);
  const mounted = useRef(true);

  const totalPages = Math.max(1, Math.ceil(signals.length / visibleCount));

  // Current visible page
  const start = pageIndex * visibleCount;
  const visibleSignals = signals.slice(start, start + visibleCount);

  // ─── Resolve animation: scrambled → resolved (left-to-right) ───────────

  const runResolve = useCallback(() => {
    const startTime = performance.now();

    function step(now: number) {
      if (!mounted.current) return;
      const elapsed = now - startTime;
      const raw = Math.min(1, elapsed / scrambleDurationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - raw, 3);
      setResolveRatio(eased);

      if (raw < 1) {
        animFrame.current = requestAnimationFrame(step);
      } else {
        setResolveRatio(1);
      }
    }
    animFrame.current = requestAnimationFrame(step);
  }, [scrambleDurationMs]);

  // ─── Scramble-out animation: resolved → scrambled ──────────────────────

  const runScrambleOut = useCallback((onDone: () => void) => {
    const startTime = performance.now();
    const outMs = 350;

    function step(now: number) {
      if (!mounted.current) return;
      const elapsed = now - startTime;
      const ratio = Math.max(0, 1 - elapsed / outMs);
      setResolveRatio(ratio);

      if (elapsed < outMs) {
        animFrame.current = requestAnimationFrame(step);
      } else {
        setResolveRatio(0);
        onDone();
      }
    }
    animFrame.current = requestAnimationFrame(step);
  }, []);

  // ─── Scramble ticker: while not fully resolved, re-render for new random chars

  useEffect(() => {
    if (resolveRatio >= 1) return;

    const ticker = setInterval(() => {
      // Force re-render so randomChar() produces new characters
      setResolveRatio(r => r + 0.0001);
    }, 50);

    return () => clearInterval(ticker);
  }, [resolveRatio >= 1]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── On mount: resolve in ─────────────────────────────────────────────

  useEffect(() => {
    mounted.current = true;
    setResolveRatio(0);
    runResolve();
    return () => { mounted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Rotation timer ───────────────────────────────────────────────────

  useEffect(() => {
    if (totalPages <= 1) return;

    const timer = setInterval(() => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);

      // Scramble out current page, then advance and resolve in
      runScrambleOut(() => {
        setPageIndex(prev => (prev + 1) % totalPages);
        runResolve();
      });
    }, rotateIntervalMs);

    return () => {
      clearInterval(timer);
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [totalPages, rotateIntervalMs, runScrambleOut, runResolve]);

  if (signals.length === 0) return null;

  return (
    <div className="text-xs font-mono" style={{ minHeight: `${visibleCount * 1.35 + 1}rem` }}>
      <div className="space-y-0.5">
        {visibleSignals.map((signal, i) => (
          <SplitFlapLine
            key={`p${pageIndex}-${i}`}
            text={signal.terminalLine}
            color={signal.color}
            resolveRatio={resolveRatio}
          />
        ))}
      </div>

      {/* Page indicator */}
      {totalPages > 1 && (
        <div className="flex gap-1.5 pt-2.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-all duration-500 ${
                i === pageIndex
                  ? 'bg-ct-green-data'
                  : 'bg-ct-green-data/20'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
