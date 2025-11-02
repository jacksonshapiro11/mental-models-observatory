import { ReactNode } from 'react';

interface HeroEspressoProps {
  title: string;
  subtitle?: string;
  cta?: {
    text: string;
    href: string;
    onClick?: () => void;
  };
  children?: ReactNode;
  className?: string;
}

/**
 * Espresso-Gold Hero Component
 * 
 * A sophisticated dark hero section with warm espresso and gold accents.
 * Features a layered gradient background with subtle grain texture for depth.
 * 
 * @example
 * ```tsx
 * <HeroEspresso
 *   title="Mental Models Observatory"
 *   subtitle="Master the frameworks that drive better thinking and decision-making"
 *   cta={{
 *     text: "Start Learning",
 *     href: "/get-started"
 *   }}
 * />
 * ```
 */
export default function HeroEspresso({
  title,
  subtitle,
  cta,
  children,
  className = '',
}: HeroEspressoProps) {
  return (
    <section className={`bg-espresso-gold min-h-[60vh] flex items-center justify-center ${className}`}>
      <div className="relative z-10 container-content py-4xl text-center">
        <h1 className="text-display font-bold text-[var(--espresso-h1)] mb-lg text-balance">
          {title}
        </h1>
        
        {subtitle && (
          <p className="text-h3 text-[var(--espresso-body)] mb-2xl max-w-3xl mx-auto text-balance font-light">
            {subtitle}
          </p>
        )}

        {cta && (
          <div className="flex gap-md justify-center items-center">
            {cta.onClick ? (
              <button
                onClick={cta.onClick}
                className="inline-flex items-center gap-2 px-2xl py-lg text-body-large font-semibold rounded-large
                         bg-[var(--espresso-cta-bg)] text-[var(--espresso-cta-text)]
                         hover:bg-[#c49f2e] transition-all duration-300
                         shadow-strong hover:shadow-emphasis hover:scale-105
                         border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]"
              >
                {cta.text}
              </button>
            ) : (
              <a
                href={cta.href}
                className="inline-flex items-center gap-2 px-2xl py-lg text-body-large font-semibold rounded-large
                         bg-[var(--espresso-cta-bg)] text-[var(--espresso-cta-text)]
                         hover:bg-[#c49f2e] transition-all duration-300
                         shadow-strong hover:shadow-emphasis hover:scale-105
                         border border-[color:rgba(212,175,55,0.35)] hover:border-[color:rgba(212,175,55,0.5)]"
              >
                {cta.text}
              </a>
            )}
          </div>
        )}

        {children && (
          <div className="mt-2xl text-[var(--espresso-body)]">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

