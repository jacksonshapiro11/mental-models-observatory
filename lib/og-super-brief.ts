import type { Metadata } from 'next';

export function superBriefOgImage(date: string): NonNullable<Metadata['openGraph']>['images'] {
  return [
    {
      url: `/api/og/super-brief/${date}`,
      width: 1200,
      height: 630,
      alt: `Cosmic Trex Super Brief — ${date}`,
    },
  ];
}
