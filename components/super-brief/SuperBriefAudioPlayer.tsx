'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EpisodeMetadata {
  date: string;
  title: string;
  audioUrl: string;
  duration: number;
}

// ─── Speed options ──────────────────────────────────────────────────────────

const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3] as const;

// ─── Icons ──────────────────────────────────────────────────────────────────

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.14v14.72a1 1 0 001.5.86l12-7.36a1 1 0 000-1.72l-12-7.36A1 1 0 008 5.14z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function HeadphonesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  );
}

// ─── Time formatting ────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SuperBriefAudioPlayer({ date }: { date: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [episode, setEpisode] = useState<EpisodeMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(2); // Default 2x

  // Fetch episode metadata from the light audio endpoint
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/audio/light/${date}`)
      .then(res => {
        if (!res.ok) throw new Error('No audio');
        return res.json();
      })
      .then(data => {
        if (!cancelled) {
          setEpisode(data);
          setDuration(data.duration || 0);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_OPTIONS[speedIndex]!;
    }
  }, [speedIndex]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.playbackRate = SPEED_OPTIONS[speedIndex]!;
    }
  }, [speedIndex]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex(prev => (prev + 1) % SPEED_OPTIONS.length);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = fraction * (audioRef.current.duration || duration);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // Loading state
  if (loading) {
    return (
      <div className="my-8 flex items-center justify-center gap-3 py-4">
        <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm text-neutral-400 dark:text-neutral-500">Checking for audio...</span>
      </div>
    );
  }

  // No audio available
  if (error || !episode) {
    return (
      <div className="my-8">
        <div className="relative rounded-xl border border-neutral-200/60 dark:border-ct-yellow/10 bg-white/50 dark:bg-ct-dark/50 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-200 dark:bg-ct-dark flex items-center justify-center">
              <HeadphonesIcon className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-neutral-400 dark:text-neutral-500">
                Super Brief audio coming soon
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const speed = SPEED_OPTIONS[speedIndex]!;

  return (
    <div className="my-8">
      <audio
        ref={audioRef}
        src={episode.audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="relative rounded-xl border border-amber-200/60 dark:border-ct-yellow/15 bg-white dark:bg-ct-bg-surface shadow-sm overflow-hidden">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="h-1 bg-neutral-100 dark:bg-ct-dark cursor-pointer"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 dark:from-ct-yellow dark:to-amber-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Player row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 dark:bg-ct-yellow text-white dark:text-ct-dark flex items-center justify-center hover:bg-amber-600 dark:hover:bg-amber-400 transition-colors shadow-sm"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <HeadphonesIcon className="w-3.5 h-3.5 text-amber-500 dark:text-ct-yellow flex-shrink-0" />
              <span className="text-sm font-medium text-neutral-800 dark:text-ct-text-on-dark truncate">
                Listen to the super brief
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {playing && (
                <span className="text-xs text-amber-500 dark:text-ct-yellow">
                  &bull; Playing at {speed}&times;
                </span>
              )}
            </div>
          </div>

          <button
            onClick={cycleSpeed}
            className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums bg-neutral-100 dark:bg-ct-dark text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-ct-dark/80 transition-colors"
            aria-label={`Playback speed: ${speed}x`}
          >
            {speed}&times;
          </button>
        </div>
      </div>
    </div>
  );
}
