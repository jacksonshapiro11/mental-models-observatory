/**
 * Espresso-Gold Hero - Usage Examples
 * 
 * Quick reference for implementing the espresso-gold hero background
 */

import HeroEspresso from '@/components/ui/HeroEspresso';
import { Sparkles, BookOpen, Target } from 'lucide-react';

// ============================================================================
// EXAMPLE 1: Basic Hero with CTA
// ============================================================================

export function BasicHero() {
  return (
    <HeroEspresso
      title="Mental Models Observatory"
      subtitle="Master the frameworks that drive better thinking"
      cta={{
        text: "Start Learning",
        href: "/get-started"
      }}
    />
  );
}

// ============================================================================
// EXAMPLE 2: Hero with Custom Content
// ============================================================================

export function HeroWithStats() {
  return (
    <HeroEspresso
      title="119 Mental Models"
      subtitle="Curated from the world's best thinkers"
    >
      <div className="flex items-center justify-center gap-xl mt-lg">
        <div className="flex items-center gap-sm text-[var(--espresso-accent)]">
          <Sparkles className="w-5 h-5" />
          <span className="text-body-small">Curated Content</span>
        </div>
        <div className="flex items-center gap-sm text-[var(--espresso-accent)]">
          <BookOpen className="w-5 h-5" />
          <span className="text-body-small">Learning Paths</span>
        </div>
        <div className="flex items-center gap-sm text-[var(--espresso-accent)]">
          <Target className="w-5 h-5" />
          <span className="text-body-small">Progress Tracking</span>
        </div>
      </div>
    </HeroEspresso>
  );
}

// ============================================================================
// EXAMPLE 3: Hero with onClick Handler
// ============================================================================

export function HeroWithAction() {
  const handleStart = () => {
    console.log('Getting started!');
    // Add your logic here (e.g., open modal, navigate, track event)
  };

  return (
    <HeroEspresso
      title="Ready to Transform Your Thinking?"
      subtitle="Join thousands learning better decision-making frameworks"
      cta={{
        text: "Begin Your Journey",
        href: "#", // Not used when onClick is provided
        onClick: handleStart
      }}
    />
  );
}

// ============================================================================
// EXAMPLE 4: Custom Background Section
// ============================================================================

export function CustomBackgroundSection() {
  return (
    <div className="bg-espresso-gold min-h-[50vh] flex items-center">
      <div className="relative z-10 container-content py-4xl">
        <div className="max-w-4xl">
          <h2 className="text-h1 text-[var(--espresso-h1)] mb-lg">
            Custom Content Section
          </h2>
          <p className="text-h3 text-[var(--espresso-body)] mb-xl font-light">
            Use the .bg-espresso-gold class for complete control over your layout
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                className="bg-black/20 backdrop-blur-sm p-lg rounded-large border border-[color:rgba(212,175,55,0.35)]"
              >
                <h3 className="text-h4 text-[var(--espresso-h1)] mb-sm">
                  Feature {i}
                </h3>
                <p className="text-body-small text-[var(--espresso-body)]">
                  Description of this amazing feature
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Minimal Hero (Title Only)
// ============================================================================

export function MinimalHero() {
  return (
    <HeroEspresso
      title="Simple. Powerful. Elegant."
    />
  );
}

// ============================================================================
// EXAMPLE 6: Full-Page Hero
// ============================================================================

export function FullPageHero() {
  return (
    <HeroEspresso
      title="Mental Models Observatory"
      subtitle="Master the mental models that drive better thinking, clearer decisions, and deeper understanding"
      cta={{
        text: "Explore 119 Models",
        href: "/models"
      }}
      className="min-h-screen"
    >
      <div className="mt-2xl">
        <p className="text-[var(--espresso-body)] text-body-small mb-md">
          Trusted by learners worldwide
        </p>
        <div className="flex items-center justify-center gap-md">
          <div className="text-[var(--espresso-accent)] font-bold text-h3">4.9★</div>
          <div className="text-[var(--espresso-body)] text-body-small">
            from 1,000+ reviews
          </div>
        </div>
      </div>
    </HeroEspresso>
  );
}

// ============================================================================
// EXAMPLE 7: Multiple CTAs
// ============================================================================

export function HeroWithMultipleCTAs() {
  return (
    <HeroEspresso
      title="Transform Your Thinking"
      subtitle="Access the complete library of mental models"
    >
      <div className="flex gap-md justify-center mt-xl">
        <a
          href="/get-started"
          className="inline-flex items-center gap-2 px-2xl py-lg text-body-large font-semibold rounded-large
                     bg-[var(--espresso-cta-bg)] text-[var(--espresso-cta-text)]
                     hover:bg-[#c49f2e] transition-all duration-300
                     shadow-strong hover:shadow-emphasis hover:scale-105
                     border border-[color:rgba(212,175,55,0.35)]"
        >
          Get Started
        </a>
        <a
          href="/about"
          className="inline-flex items-center gap-2 px-2xl py-lg text-body-large font-semibold rounded-large
                     bg-transparent text-[var(--espresso-body)]
                     hover:bg-white/10 transition-all duration-300
                     border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]"
        >
          Learn More
        </a>
      </div>
    </HeroEspresso>
  );
}

// ============================================================================
// EXAMPLE 8: Inline Text Utilities
// ============================================================================

export function InlineTextExample() {
  return (
    <div className="bg-espresso-gold p-4xl">
      <div className="relative z-10 max-w-2xl mx-auto">
        <h1 className="text-[var(--espresso-h1)] text-display mb-md">
          Using Color Tokens
        </h1>
        <p className="text-[var(--espresso-body)] text-body-large mb-lg">
          Apply the espresso-gold color palette to any text element.
        </p>
        <p className="text-[var(--espresso-accent)] text-h4 font-semibold">
          Gold accent text for emphasis
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Pro Tips:
// 
// 1. Always use `relative z-10` on content inside .bg-espresso-gold
//    to keep it above the grain texture overlay
// 
// 2. Test text contrast - while designed for readability, always verify
//    with actual content
// 
// 3. The grain texture is subtle - it may not be visible on all screens
//    at all zoom levels (this is intentional)
// 
// 4. Combine with your existing design system - espresso-gold complements
//    rather than replaces your tier-based colors
// 
// 5. Use sparingly - dark heroes work best as accent sections
// ============================================================================

