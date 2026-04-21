/**
 * JSON-LD structured data components for SEO.
 *
 * Article schema signals to Google that daily briefs and blog posts
 * are authored, dated analytical content — important for YMYL/E-E-A-T
 * in the finance content vertical.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cosmictrex.com';

interface ArticleJsonLdProps {
  title: string;
  description: string;
  datePublished: string;
  url: string;
  dateModified?: string;
}

export function ArticleJsonLd({
  title,
  description,
  datePublished,
  url,
  dateModified,
}: ArticleJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    datePublished,
    dateModified: dateModified || datePublished,
    url: `${SITE_URL}${url}`,
    author: {
      '@type': 'Organization',
      name: 'Cosmic Trex',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cosmic Trex',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/podcast-cover.jpg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}${url}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebsiteJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Cosmic Trex',
    url: SITE_URL,
    description: 'Daily financial intelligence brief. Markets, geopolitics, AI, crypto, and macro — filtered through mental models.',
    publisher: {
      '@type': 'Organization',
      name: 'Cosmic Trex',
      url: SITE_URL,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
