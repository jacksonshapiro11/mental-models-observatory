import Link from 'next/link';
import { SubscribeForm } from '@/components/subscribe/SubscribeForm';

export default function SubscribePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Dark header section */}
      <section className="bg-ct-dark py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <h1 className="font-mono text-4xl sm:text-5xl font-bold text-ct-yellow mb-4 tracking-wide">
            SUBSCRIBE
          </h1>
          <p className="font-body text-lg text-text-on-dark-muted">
            Markets, meditations, and mental models. Every morning. 8 minutes.
          </p>
        </div>
      </section>

      {/* White background email capture section */}
      <section className="flex-1 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          {/* Email form */}
          <SubscribeForm
            source="subscribe-page"
            layout="column"
            inputClassName="w-full bg-white border-2 border-ct-dark px-4 py-3 font-body text-base focus:outline-none focus:bg-ct-dark focus:text-ct-yellow focus:border-ct-dark"
            buttonClassName="w-full bg-ct-yellow text-ct-dark px-6 py-3 font-sans font-semibold text-base hover:bg-ct-pink hover:text-white transition-colors"
            noteClassName="text-xs text-ct-dark font-body text-center"
          />

          {/* Value proposition */}
          <div className="mt-12 pt-8 border-t-2 border-ct-dark">
            <div className="space-y-4 text-center">
              <p className="font-serif text-lg text-ct-dark leading-relaxed">
                <span className="font-bold">Markets.</span> Signal over noise. Geopolitical inflection points before price does.
              </p>
              <p className="font-serif text-lg text-ct-dark leading-relaxed">
                <span className="font-bold">Meditations.</span> Cross-domain thinking. The mental models that compound.
              </p>
              <p className="font-serif text-lg text-ct-dark leading-relaxed">
                <span className="font-bold">Mental Models.</span> 50+ frameworks. Built to rewire how you see systems.
              </p>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-12 text-center">
            <Link
              href="/daily-update"
              className="font-body text-sm text-ct-dark hover:text-ct-pink transition-colors inline-flex items-center gap-1"
            >
              Read today's brief →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
