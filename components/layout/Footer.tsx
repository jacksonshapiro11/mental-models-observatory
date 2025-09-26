import React from 'react';
import Link from 'next/link';
import { 
  Brain, 
  Github, 
  Twitter, 
  Mail, 
  ExternalLink,
  Heart,
  ArrowRight,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';

interface FooterProps {
  showStats?: boolean;
}

const tierLinks = [
  {
    tier: 1,
    title: 'Foundational',
    description: 'Core thinking frameworks',
    href: '/domains?tier=1',
    icon: Brain,
    color: 'text-foundational-600 hover:text-foundational-700'
  },
  {
    tier: 2,
    title: 'Practical',
    description: 'Applied decision tools',
    href: '/domains?tier=2',
    icon: Target,
    color: 'text-practical-600 hover:text-practical-700'
  },
  {
    tier: 3,
    title: 'Specialized',
    description: 'Domain-specific models',
    href: '/domains?tier=3',
    icon: Zap,
    color: 'text-specialized-600 hover:text-specialized-700'
  }
];

const socialLinks = [
  {
    name: 'GitHub',
    href: '#',
    icon: Github,
    description: 'View source code'
  },
  {
    name: 'Twitter',
    href: '#',
    icon: Twitter,
    description: 'Follow updates'
  },
  {
    name: 'Email',
    href: 'mailto:hello@mentalmodelsobservatory.com',
    icon: Mail,
    description: 'Get in touch'
  }
];

const quickLinks = [
  { name: 'About', href: '/about' },
  { name: 'How it Works', href: '/about#how-it-works' },
  { name: 'Sources', href: '/sources' },
  { name: 'Contribute', href: '/contribute' },
  { name: 'API', href: '/api' },
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' }
];

export function Footer({ showStats = true }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-800 text-neutral-100">
      {/* Main footer content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Brand section */}
          <div className="lg:col-span-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-foundational-500 to-accent-500 flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">Mental Models Observatory</span>
            </div>
            
            <p className="text-neutral-300 leading-relaxed mb-6 max-w-md">
              A comprehensive collection of mental models organized across 40 domains of knowledge. 
              Each model includes complete source attribution and real-world applications.
            </p>

            {/* Quick stats */}
            {showStats && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foundational-400">150+</div>
                  <div className="text-xs text-neutral-400">Models</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-practical-400">40</div>
                  <div className="text-xs text-neutral-400">Domains</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-specialized-400">1000+</div>
                  <div className="text-xs text-neutral-400">Sources</div>
                </div>
              </div>
            )}

            {/* Social links */}
            <div className="flex items-center space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="p-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors"
                  title={social.description}
                  target={social.href.startsWith('http') ? '_blank' : undefined}
                  rel={social.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Tier-based navigation */}
          <div className="lg:col-span-4">
            <h3 className="text-lg font-semibold mb-4">Explore by Tier</h3>
            <div className="space-y-4">
              {tierLinks.map((tier) => (
                <Link
                  key={tier.tier}
                  href={tier.href}
                  className="block group"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-neutral-700/50 hover:bg-neutral-700 transition-colors">
                    <div className={`p-2 rounded-lg bg-neutral-600 group-hover:bg-neutral-500 transition-colors`}>
                      <tier.icon className="w-4 h-4 text-neutral-100" />
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${tier.color} transition-colors`}>
                        Tier {tier.tier}: {tier.title}
                      </div>
                      <div className="text-sm text-neutral-400">
                        {tier.description}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <nav className="space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="block text-neutral-300 hover:text-white transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Newsletter signup */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Stay Updated</h3>
            <p className="text-neutral-300 text-sm mb-4">
              Get notified about new models and insights.
            </p>
            
            <form className="space-y-3">
              <input
                type="email"
                placeholder="Your email"
                className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-foundational-500 focus:border-transparent transition-colors"
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-foundational-600 hover:bg-foundational-700 text-white rounded-lg font-medium transition-colors"
              >
                Subscribe
              </button>
            </form>
            
            <p className="text-xs text-neutral-400 mt-2">
              No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Framework overview */}
      <div className="border-t border-neutral-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-gradient-to-r from-neutral-700/50 to-neutral-600/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-neutral-100 mb-1">
                  Complete Mental Models Framework
                </h4>
                <p className="text-sm text-neutral-300">
                  40 domains • 3 tiers • 150+ models • Complete source transparency
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  href="/about"
                  className="text-sm text-foundational-400 hover:text-foundational-300 transition-colors"
                >
                  Learn More
                </Link>
                <ArrowRight className="w-3 h-3 text-foundational-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-700 bg-neutral-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-4 text-sm text-neutral-400">
              <span>© {currentYear} Mental Models Observatory</span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center">
                Built with <Heart className="w-3 h-3 mx-1 text-red-400" /> for better thinking
              </span>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-neutral-400">
              <span>Powered by</span>
              <a 
                href="https://readwise.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-neutral-300 transition-colors"
              >
                <span>Readwise</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span>•</span>
              <a 
                href="https://nextjs.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1 hover:text-neutral-300 transition-colors"
              >
                <span>Next.js</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
