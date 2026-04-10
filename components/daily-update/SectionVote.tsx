'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface SectionVoteProps {
  briefDate: string;
  sectionId: string;
}

export function SectionVote({ briefDate, sectionId }: SectionVoteProps) {
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [upCount, setUpCount] = useState(0);
  const [downCount, setDownCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `ct_votes_${briefDate}_${sectionId}`;

  // Load initial vote counts and check localStorage for user's vote
  useEffect(() => {
    const loadVotes = async () => {
      try {
        // Check localStorage for user's existing vote
        const savedVote = localStorage.getItem(storageKey);
        if (savedVote === 'up' || savedVote === 'down') {
          setUserVote(savedVote);
        }

        // Fetch current vote counts from API
        const params = new URLSearchParams({
          briefDate,
          sectionId,
        });
        const response = await fetch(`/api/vote?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setUpCount(data.up ?? 0);
          setDownCount(data.down ?? 0);
        }
      } catch (error) {
        console.error('Failed to load votes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVotes();
  }, [briefDate, sectionId, storageKey]);

  const handleVote = useCallback(
    async (direction: 'up' | 'down') => {
      // Optimistic UI update
      const isCurrentVote = userVote === direction;
      const newUserVote = isCurrentVote ? null : direction;

      // Calculate optimistic counts
      let newUpCount = upCount;
      let newDownCount = downCount;

      if (userVote === 'up') {
        newUpCount -= 1;
      } else if (userVote === 'down') {
        newDownCount -= 1;
      }

      if (newUserVote === 'up') {
        newUpCount += 1;
      } else if (newUserVote === 'down') {
        newDownCount += 1;
      }

      setUserVote(newUserVote);
      setUpCount(newUpCount);
      setDownCount(newDownCount);

      // Update localStorage
      if (newUserVote) {
        localStorage.setItem(storageKey, newUserVote);
      } else {
        localStorage.removeItem(storageKey);
      }

      // Send to API
      try {
        const response = await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            briefDate,
            sectionId,
            direction: isCurrentVote ? null : direction, // null means un-vote
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setUpCount(data.up ?? 0);
          setDownCount(data.down ?? 0);
        } else {
          // Revert optimistic update on error
          setUserVote(userVote);
          setUpCount(upCount);
          setDownCount(downCount);
          if (userVote) {
            localStorage.setItem(storageKey, userVote);
          } else {
            localStorage.removeItem(storageKey);
          }
          console.error('Failed to vote:', response.statusText);
        }
      } catch (error) {
        // Revert optimistic update on error
        setUserVote(userVote);
        setUpCount(upCount);
        setDownCount(downCount);
        if (userVote) {
          localStorage.setItem(storageKey, userVote);
        } else {
          localStorage.removeItem(storageKey);
        }
        console.error('Failed to vote:', error);
      }
    },
    [briefDate, sectionId, userVote, upCount, downCount, storageKey],
  );

  if (isLoading) {
    return null;
  }

  const netCount = upCount - downCount;
  const upActive = userVote === 'up';
  const downActive = userVote === 'down';

  return (
    <div className="inline-flex items-center gap-1 ml-2">
      <button
        onClick={() => handleVote('up')}
        className={`inline-flex items-center justify-center w-6 h-6 min-h-[44px] min-w-[44px] border rounded-sm transition-colors duration-150 ${
          upActive
            ? 'text-ct-green-data border-ct-green-data'
            : 'text-text-muted border-text-muted/20 hover:border-text-muted/40'
        }`}
        title="Vote up"
        aria-label="Vote up"
      >
        <span className="text-sm font-semibold">▲</span>
      </button>

      <span className="font-mono text-xs text-text-muted w-6 text-center">
        {netCount > 0 ? '+' : ''}{netCount}
      </span>

      <button
        onClick={() => handleVote('down')}
        className={`inline-flex items-center justify-center w-6 h-6 min-h-[44px] min-w-[44px] border rounded-sm transition-colors duration-150 ${
          downActive
            ? 'text-ct-pink border-ct-pink'
            : 'text-text-muted border-text-muted/20 hover:border-text-muted/40'
        }`}
        title="Vote down"
        aria-label="Vote down"
      >
        <span className="text-sm font-semibold">▼</span>
      </button>
    </div>
  );
}
