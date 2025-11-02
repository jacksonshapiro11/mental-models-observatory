# Espresso-Gold Hero Background

A sophisticated dark hero background system with warm espresso tones and gold accents, designed for premium content presentation with high readability.

## 🎨 Color Palette

```css
--espresso-h1: #F5EDE3;        /* Soft cream for headings */
--espresso-body: #E5DACB;      /* Warm beige for body text */
--espresso-accent: #D4AF37;    /* Premium gold for accents */
--espresso-cta-bg: #D4AF37;    /* Gold for CTA backgrounds */
--espresso-cta-text: #1A1410;  /* Deep espresso for CTA text */
```

## 🖼️ Background Layers

The `.bg-espresso-gold` class applies two gradient layers plus a subtle grain texture:

1. **Radial Gradient** (top layer): `radial-gradient(1200px 600px at 20% -10%, #2a1a0f 0%, rgba(42,26,15,0) 45%)`
2. **Linear Gradient** (base): `linear-gradient(160deg, #0b0b0b 0%, #14110f 45%, #1c140f 85%)`
3. **Grain Overlay** (pseudo-element): Subtle cross-hatch pattern for texture

## 📦 Installation

Already integrated! The theme is available in:
- `app/globals.css` - CSS custom properties and `.bg-espresso-gold` utility
- `tailwind.config.ts` - Safelisted utility classes
- `components/ui/HeroEspresso.tsx` - React component

## 🚀 Quick Start

### Option 1: Use the Hero Component

```tsx
import HeroEspresso from '@/components/ui/HeroEspresso';

<HeroEspresso
  title="Mental Models Observatory"
  subtitle="Master the frameworks that drive better thinking"
  cta={{
    text: "Start Learning",
    href: "/get-started"
  }}
/>
```

### Option 2: Use the Background Class

```tsx
<div className="bg-espresso-gold min-h-screen">
  <div className="relative z-10 p-4xl">
    <h1 className="text-[var(--espresso-h1)] text-display">
      Your Content
    </h1>
    <p className="text-[var(--espresso-body)] text-h3">
      Your subtitle
    </p>
  </div>
</div>
```

## 🎯 Available Utilities

All these classes are safelisted and ready to use:

| Class | Purpose | Color |
|-------|---------|-------|
| `bg-espresso-gold` | Full gradient background with grain | Multi-layer |
| `text-[var(--espresso-h1)]` | Heading text | #F5EDE3 |
| `text-[var(--espresso-body)]` | Body text | #E5DACB |
| `text-[var(--espresso-accent)]` | Accent text | #D4AF37 |
| `bg-[var(--espresso-cta-bg)]` | CTA button background | #D4AF37 |
| `text-[var(--espresso-cta-text)]` | CTA button text | #1A1410 |
| `border-[color:rgba(212,175,55,0.35)]` | Gold border (subtle) | Gold 35% |
| `hover:border-[color:rgba(212,175,55,0.5)]` | Gold border (hover) | Gold 50% |

## 📝 Component API

### HeroEspresso Props

```typescript
interface HeroEspressoProps {
  title: string;              // Required: Main heading
  subtitle?: string;          // Optional: Subheading
  cta?: {                     // Optional: Call-to-action button
    text: string;
    href: string;
    onClick?: () => void;
  };
  children?: ReactNode;       // Optional: Additional content
  className?: string;         // Optional: Additional CSS classes
}
```

## 🎨 Design Principles

1. **High Contrast** - Light cream text (#F5EDE3) on dark espresso background ensures WCAG AA compliance
2. **Layered Depth** - Multiple gradients create visual interest without overwhelming content
3. **Subtle Texture** - Grain overlay adds sophistication at 40% opacity
4. **Premium Feel** - Gold accents (#D4AF37) create a sense of quality and authority
5. **Readable** - All text colors tested for legibility on the darkest background areas

## 🧪 Demo

View the demo page at: `http://localhost:3000/demo-hero`

## 🔧 Customization

### Adjust Colors

Edit `app/globals.css`:

```css
:root {
  --espresso-h1: #F5EDE3;      /* Change heading color */
  --espresso-body: #E5DACB;    /* Change body text color */
  --espresso-accent: #D4AF37;  /* Change accent color */
}
```

### Adjust Gradient

Edit `app/globals.css` in the `.bg-espresso-gold` class:

```css
.bg-espresso-gold {
  background: 
    radial-gradient(1200px 600px at 20% -10%, #2a1a0f 0%, rgba(42,26,15,0) 45%),
    linear-gradient(160deg, #0b0b0b 0%, #14110f 45%, #1c140f 85%);
}
```

### Remove Grain Texture

Remove or comment out the `::before` pseudo-element:

```css
/* .bg-espresso-gold::before { ... } */
```

## 📱 Responsive Behavior

The hero automatically adapts to screen sizes:
- Full viewport height on desktop (`min-h-[60vh]`)
- Centered content with `container-content`
- Text scales with Tailwind's responsive typography
- CTA button maintains touch-friendly size on mobile

## ♿ Accessibility

- ✅ WCAG AA contrast ratio (4.5:1+) for all text
- ✅ Focus states preserved on interactive elements
- ✅ Grain texture uses `pointer-events: none` to avoid interference
- ✅ Semantic HTML structure in component
- ✅ Keyboard navigation supported

## 🎭 Use Cases

Perfect for:
- Landing page heroes
- Section dividers
- Feature highlights
- Modal backgrounds
- Premium content areas
- Testimonial sections

## 📚 Related Files

- `app/globals.css` - Theme tokens and utility classes
- `tailwind.config.ts` - Safelist configuration
- `components/ui/HeroEspresso.tsx` - React component
- `app/demo-hero/page.tsx` - Demo page with examples

## 🤝 Integration Tips

1. **Combine with existing design system** - Espresso-gold works alongside your tier-based colors
2. **Use sparingly** - Dark heroes work best as accent sections, not entire pages
3. **Maintain hierarchy** - Use `--espresso-h1` for headings, `--espresso-body` for paragraphs
4. **Test contrast** - Always verify text readability, especially with custom content
5. **Layer content** - Use `relative z-10` on content to keep it above the grain overlay

---

Built with ❤️ for the Mental Models Observatory

