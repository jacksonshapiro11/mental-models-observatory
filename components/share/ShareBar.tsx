'use client';

import { useState, useEffect, useCallback } from 'react';

interface ShareBarProps {
  title: string;
  /** Path without origin, e.g. /super-brief/2026-06-04 */
  path: string;
  displayDate?: string;
  variant?: 'light' | 'dark';
}

function buildShareUrls(url: string, title: string, displayDate?: string) {
  const tweetText = encodeURIComponent(
    `"${title}"\n\nFrom today's Markets, Meditations & Mental Models:`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(url)}`;
  const mailSubject = encodeURIComponent(
    displayDate ? `Super Brief — ${displayDate}` : `Cosmic Trex — ${title}`
  );
  const mailBody = encodeURIComponent(
    `Thought you'd want this:\n\n${url}\n\nDaily brief for finance pros. Essential market signals every morning.`
  );
  const mailtoUrl = `mailto:?subject=${mailSubject}&body=${mailBody}`;
  return { tweetUrl, mailtoUrl };
}

export function ShareBar({ title, path, displayDate, variant = 'light' }: ShareBarProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    setShareUrl(`${origin}${path}`);
  }, [path]);

  const handleCopy = useCallback(async () => {
    const url = shareUrl || `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl, path]);

  const { tweetUrl, mailtoUrl } = buildShareUrls(
    shareUrl || `https://cosmictrex.com${path}`,
    title,
    displayDate
  );

  const isDark = variant === 'dark';
  const sectionClass = isDark
    ? 'bg-ct-dark px-4 py-5 border-t-[3px] border-ct-yellow'
    : 'bg-white px-4 py-5 border-t-[3px] border-ct-dark';
  const labelClass = isDark ? 'text-ct-yellow' : 'text-[#666]';
  const headingClass = isDark ? 'text-white' : 'text-ct-dark';
  const btnPrimary = isDark
    ? 'bg-ct-yellow text-ct-dark border-ct-yellow hover:bg-white'
    : 'bg-ct-dark text-ct-yellow border-ct-dark hover:bg-ct-pink hover:text-white hover:border-ct-pink';
  const btnSecondary = isDark
    ? 'bg-transparent text-white border-white/40 hover:border-ct-yellow hover:text-ct-yellow'
    : 'bg-white text-ct-dark border-ct-dark hover:bg-ct-yellow';

  return (
    <section className={sectionClass}>
      <div className="max-w-lg mx-auto text-center">
        <div className={`font-mono text-[10px] uppercase tracking-[0.1em] font-medium mb-1.5 ${labelClass}`}>
          Share
        </div>
        <p className={`font-serif text-[14px] mb-3 ${headingClass}`}>
          Know someone who&apos;d want this?
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block font-mono text-[11px] font-semibold px-3.5 py-2 border-[1.5px] transition-colors no-underline ${btnPrimary}`}
          >
            Share on X
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-block font-mono text-[11px] font-semibold px-3.5 py-2 border-[1.5px] transition-colors cursor-pointer ${btnSecondary}`}
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a
            href={mailtoUrl}
            className={`inline-block font-mono text-[11px] font-semibold px-3.5 py-2 border-[1.5px] transition-colors no-underline ${btnSecondary}`}
          >
            Email
          </a>
        </div>
      </div>
    </section>
  );
}
