'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EpisodeMetadata {
  date: string;
  title: string;
  audioUrl: string;
  duration: number;
}

interface AudioPlayerProps {
  date: string;
}

// ─── Speed options ──────────────────────────────────────────────────────────

const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3] as const;

// ─── Icons (inline SVG to avoid dependency) ─────────────────────────────────

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

function RssIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 11a9 9 0 019 9" />
      <path d="M4 4a16 16 0 0116 16" />
      <circle cx="5" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function ApplePodcastIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c2.336 0 4.448.902 6.056 2.587 1.224 1.272 1.912 2.619 2.264 4.392.12.6-.12 1.2-.6 1.2-.48 0-.84-.36-.96-.96-.264-1.476-.84-2.616-1.848-3.648C15.387 4.728 13.647 3.96 11.7 3.96c-1.812 0-3.552.768-4.956 2.148-1.08 1.068-1.68 2.22-1.932 3.72-.12.6-.48.96-.96.96-.48 0-.72-.6-.6-1.2.348-1.776 1.032-3.12 2.268-4.392A8.556 8.556 0 0111.865 2.568zM12 7.2a4.8 4.8 0 014.8 4.8c0 1.06-.344 2.04-.924 2.832-.24.324-.588.36-.888.108-.3-.252-.348-.636-.108-.96A3.384 3.384 0 0015.6 12 3.6 3.6 0 008.4 12c0 .744.24 1.44.648 2.004.24.324.18.696-.12.948-.3.252-.648.216-.888-.108A4.752 4.752 0 017.2 12 4.8 4.8 0 0112 7.2zm-.024 3.6a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm-.012 3.744c.648 0 1.08.408 1.116 1.08l.36 5.016c.036.54-.204.972-.588 1.2a1.476 1.476 0 01-1.776 0c-.384-.228-.624-.66-.588-1.2l.36-5.016c.036-.672.468-1.08 1.116-1.08z" />
    </svg>
  );
}

// ─── Podcast links ──────────────────────────────────────────────────────────
const PODCAST_LINKS = {
  spotify: 'https://open.spotify.com/show/0MhCdB3jidaoJ25kg7zr6O',
  apple: 'https://podcasts.apple.com/us/podcast/markets-meditations-and-mental-models/id1885352035',
};

// ─── Time formatting ────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AudioPlayer({ date }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [episode, setEpisode] = useState<EpisodeMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(2); // Default 2x
  const [showRssTooltip, setShowRssTooltip] = useState(false);

  // Fetch episode metadata
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/audio/${date}`)
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

  // Sync playback rate when speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_OPTIONS[speedIndex]!;
    }
  }, [speedIndex]);

  // Audio event handlers
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
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

  // Controls
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

  const copyRssUrl = useCallback(() => {
    const feedUrl = `${window.location.origin}/api/podcast/feed`;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setShowRssTooltip(true);
      setTimeout(() => setShowRssTooltip(false), 2000);
    });
  }, []);

  // Don't render if no audio or loading
  if (loading) {
    return (
      <div className="my-8 flex items-center justify-center gap-3 py-4">
        <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-sm text-neutral-400 dark:text-neutral-500">Checking for audio...</span>
      </div>
    );
  }

  if (error || !episode) {
    // Show a subtle placeholder so the player is discoverable even before first audio generation
    return (
      <div className="my-8">
        <div className="relative rounded-xl border border-neutral-200/60 dark:border-[var(--espresso-accent)]/10 bg-white/50 dark:bg-[var(--espresso-bg-medium)]/50 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-200 dark:bg-[var(--espresso-bg-dark)] flex items-center justify-center">
              <HeadphonesIcon className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-neutral-400 dark:text-neutral-500">
                Audio edition coming soon
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <a
                href={PODCAST_LINKS.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-[#1DB954] hover:opacity-80 hover:bg-neutral-100 dark:hover:bg-[var(--espresso-bg-dark)] transition-all"
                aria-label="Listen on Spotify"
                title="Listen on Spotify"
              >
                <SpotifyIcon className="w-7 h-7" />
              </a>
              <a
                href={PODCAST_LINKS.apple}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md text-[#D56DFB] hover:opacity-80 hover:bg-neutral-100 dark:hover:bg-[var(--espresso-bg-dark)] transition-all"
                aria-label="Listen on Apple Podcasts"
                title="Listen on Apple Podcasts"
              >
                <ApplePodcastIcon className="w-7 h-7" />
              </a>
              <div className="relative">
                <button
                  onClick={copyRssUrl}
                  className="p-2 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-amber-500 dark:hover:text-[var(--espresso-accent)] hover:bg-neutral-100 dark:hover:bg-[var(--espresso-bg-dark)] transition-colors"
                  aria-label="Copy podcast feed URL"
                  title="Copy RSS feed URL — subscribe in your podcast app"
                >
                  <RssIcon className="w-4 h-4" />
                </button>
                {showRssTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium whitespace-nowrap shadow-lg">
                    Feed URL copied!
                    <div className="absolute top-full right-3 w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rotate-45 -mt-1" />
                  </div>
                )}
              </div>
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
      {/* Hidden audio element */}
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

      {/* Player card */}
      <div className="relative rounded-xl border border-amber-200/60 dark:border-[var(--espresso-accent)]/15 bg-white dark:bg-[var(--espresso-bg-medium)] shadow-sm overflow-hidden">

        {/* Top: progress bar (thin, always visible) */}
        <div
          ref={progressRef}
          className="h-1 bg-neutral-100 dark:bg-[var(--espresso-bg-dark)] cursor-pointer group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 dark:from-[var(--espresso-accent)] dark:to-amber-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Main player row */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-bg-dark)] flex items-center justify-center hover:bg-amber-600 dark:hover:bg-amber-400 transition-colors shadow-sm"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Label + metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <HeadphonesIcon className="w-3.5 h-3.5 text-amber-500 dark:text-[var(--espresso-accent)] flex-shrink-0" />
              <span className="text-sm font-medium text-neutral-800 dark:text-[var(--espresso-h1)] truncate">
                Listen to today&rsquo;s brief
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {playing && (
                <span className="text-xs text-amber-500 dark:text-[var(--espresso-accent)]">
                  • Playing at {speed}×
                </span>
              )}
            </div>
          </div>

          {/* Speed control */}
          <button
            onClick={cycleSpeed}
            className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums bg-neutral-100 dark:bg-[var(--espresso-bg-dark)] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[var(--espresso-bg-dark)]/80 transition-colors"
            aria-label={`Playback speed: ${speed}x`}
          >
            {speed}×
          </button>

          {/* Podcast platform links */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={PODCAST_LINKS.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-[#1DB954] hover:opacity-80 hover:bg-neutral-100 dark:hover:bg-[var(--espresso-bg-dark)] transition-all"
              aria-label="Listen on Spotify"
              title="Listen on Spotify"
            >
              <SpotifyIcon className="w-7 h-7" />
            </a>
            <a
              href={PODCAST_LINKS.apple}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-[#D56DFB] hover:opacity-80 hover:bg-neutral-100 dark:hover:bg-[var(--espresso-bg-dark)] transition-all"
              aria-label="Listen on Apple Podcasts"
              title="Listen on Apple Podcasts"
            >
              <ApplePodcastIcon className="w-7 h-7" />
            </a>
            <div className="relative">
              <button
                onClick={copyRssUrl}
                className="p-2 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-amber-500 dark:hover:text-[var(--espresso-accent)] hover:bg-neutral-100 dark:hover:bg-[var(--espresso-bg-dark)] transition-colors"
                aria-label="Copy podcast feed URL"
                title="Copy RSS feed URL"
              >
                <RssIcon className="w-4 h-4" />
              </button>
              {showRssTooltip && (
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium whitespace-nowrap shadow-lg">
                  Feed URL copied!
                  <div className="absolute top-full right-3 w-2 h-2 bg-neutral-900 dark:bg-neutral-100 rotate-45 -mt-1" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
