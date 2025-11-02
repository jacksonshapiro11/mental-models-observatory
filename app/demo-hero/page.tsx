import HeroEspresso from '@/components/ui/HeroEspresso';
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react';

/**
 * Demo page showcasing the Espresso-Gold Hero component
 * 
 * Visit: http://localhost:3000/demo-hero
 */
export default function DemoHeroPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <HeroEspresso
        title="Mental Models Observatory"
        subtitle="Master the frameworks that drive better thinking and decision-making"
        cta={{
          text: "Start Your Journey",
          href: "/get-started"
        }}
      >
        <div className="flex items-center justify-center gap-xl mt-lg">
          <div className="flex items-center gap-sm text-[var(--espresso-accent)]">
            <Sparkles className="w-5 h-5" />
            <span className="text-body-small">119 Mental Models</span>
          </div>
          <div className="flex items-center gap-sm text-[var(--espresso-accent)]">
            <BookOpen className="w-5 h-5" />
            <span className="text-body-small">Curated Learning Paths</span>
          </div>
        </div>
      </HeroEspresso>

      {/* Content Section */}
      <section className="container-content py-4xl">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-h1 text-neutral-900 mb-lg">Espresso-Gold Theme Usage</h2>
          
          <div className="space-y-xl">
            <div className="card p-xl">
              <h3 className="text-h3 text-neutral-900 mb-md">Color Tokens</h3>
              <div className="space-y-md">
                <div className="flex items-center gap-md">
                  <div className="w-16 h-16 rounded-medium" style={{ backgroundColor: 'var(--espresso-h1)' }}></div>
                  <div>
                    <p className="font-mono text-body-small text-neutral-700">--espresso-h1</p>
                    <p className="text-caption text-neutral-500">#F5EDE3 • Headings</p>
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-16 h-16 rounded-medium" style={{ backgroundColor: 'var(--espresso-body)' }}></div>
                  <div>
                    <p className="font-mono text-body-small text-neutral-700">--espresso-body</p>
                    <p className="text-caption text-neutral-500">#E5DACB • Body text</p>
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-16 h-16 rounded-medium" style={{ backgroundColor: 'var(--espresso-accent)' }}></div>
                  <div>
                    <p className="font-mono text-body-small text-neutral-700">--espresso-accent</p>
                    <p className="text-caption text-neutral-500">#D4AF37 • Gold accents</p>
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-16 h-16 rounded-medium" style={{ backgroundColor: 'var(--espresso-cta-bg)' }}></div>
                  <div>
                    <p className="font-mono text-body-small text-neutral-700">--espresso-cta-bg</p>
                    <p className="text-caption text-neutral-500">#D4AF37 • CTA background</p>
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-16 h-16 rounded-medium border border-neutral-300" style={{ backgroundColor: 'var(--espresso-cta-text)' }}></div>
                  <div>
                    <p className="font-mono text-body-small text-neutral-700">--espresso-cta-text</p>
                    <p className="text-caption text-neutral-500">#1A1410 • CTA text</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-xl">
              <h3 className="text-h3 text-neutral-900 mb-md">Usage Examples</h3>
              
              <div className="space-y-lg">
                <div>
                  <h4 className="text-h4 text-neutral-800 mb-sm">Basic Hero</h4>
                  <pre className="bg-neutral-100 p-md rounded-medium overflow-x-auto text-body-small">
{`<HeroEspresso
  title="Your Title"
  subtitle="Your compelling subtitle"
  cta={{
    text: "Get Started",
    href: "/start"
  }}
/>`}
                  </pre>
                </div>

                <div>
                  <h4 className="text-h4 text-neutral-800 mb-sm">With Custom Content</h4>
                  <pre className="bg-neutral-100 p-md rounded-medium overflow-x-auto text-body-small">
{`<HeroEspresso
  title="Mental Models"
  subtitle="Better thinking tools"
>
  <div className="flex gap-md">
    <span className="text-[var(--espresso-accent)]">
      119 Models
    </span>
  </div>
</HeroEspresso>`}
                  </pre>
                </div>

                <div>
                  <h4 className="text-h4 text-neutral-800 mb-sm">Background Only</h4>
                  <pre className="bg-neutral-100 p-md rounded-medium overflow-x-auto text-body-small">
{`<div className="bg-espresso-gold min-h-[40vh]">
  <div className="relative z-10 p-4xl">
    <h1 className="text-[var(--espresso-h1)]">
      Custom Content
    </h1>
  </div>
</div>`}
                  </pre>
                </div>

                <div>
                  <h4 className="text-h4 text-neutral-800 mb-sm">Available Utility Classes</h4>
                  <ul className="list-disc list-inside space-y-sm text-body-small text-neutral-700">
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">bg-espresso-gold</code> - Layered gradient background with grain</li>
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">text-[var(--espresso-h1)]</code> - Heading color</li>
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">text-[var(--espresso-body)]</code> - Body text color</li>
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">text-[var(--espresso-accent)]</code> - Accent color</li>
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">bg-[var(--espresso-cta-bg)]</code> - CTA background</li>
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">text-[var(--espresso-cta-text)]</code> - CTA text</li>
                    <li><code className="bg-neutral-100 px-sm py-xs rounded">border-[color:rgba(212,175,55,0.35)]</code> - Gold border</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="card p-xl">
              <h3 className="text-h3 text-neutral-900 mb-md">Design Principles</h3>
              <ul className="space-y-md text-body text-neutral-700">
                <li className="flex gap-md">
                  <span className="text-accent-500">✓</span>
                  <span><strong>High Contrast:</strong> Light text on dark background ensures readability</span>
                </li>
                <li className="flex gap-md">
                  <span className="text-accent-500">✓</span>
                  <span><strong>Layered Gradients:</strong> Creates depth without overwhelming the content</span>
                </li>
                <li className="flex gap-md">
                  <span className="text-accent-500">✓</span>
                  <span><strong>Subtle Texture:</strong> Grain overlay adds sophistication without distraction</span>
                </li>
                <li className="flex gap-md">
                  <span className="text-accent-500">✓</span>
                  <span><strong>Golden Accents:</strong> Warm gold (#D4AF37) creates premium feel</span>
                </li>
                <li className="flex gap-md">
                  <span className="text-accent-500">✓</span>
                  <span><strong>Accessible:</strong> All text meets WCAG AA contrast requirements</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Second Hero Example */}
      <HeroEspresso
        title="Another Hero Section"
        subtitle="You can use multiple heroes on the same page"
        className="mt-4xl"
      />
    </div>
  );
}

