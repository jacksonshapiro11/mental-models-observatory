import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mental Models Observatory',
  description: 'Explore 100+ mental models across 40 knowledge domains — physics, psychology, game theory, evolution, information theory, and decision science. A living knowledge graph powering the Cosmic Trex daily brief.',
  alternates: { canonical: '/models' },
  openGraph: {
    title: 'Mental Models Observatory — Cosmic Trex',
    description: 'Explore 100+ mental models across 40 knowledge domains. Physics, psychology, game theory, evolution, and more.',
    url: '/models',
  },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
