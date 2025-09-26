# Mental Models Observatory Design System

## 🎨 **Design Philosophy**

**"Paul Graham's essays meets Stripe documentation meets personal intellectual journey"**

Our design system embodies:
- **Content-first design** that enhances readability and comprehension
- **Subtle sophistication** without overwhelming complexity
- **Professional authority** with personal authenticity
- **Accessibility-first approach** (WCAG 2.1 AA compliance)
- **Intellectual depth** through thoughtful visual hierarchy

---

## 🎯 **Design Principles**

### **1. Content is King**
Every design decision serves content comprehension and intellectual engagement.

### **2. Sophisticated Minimalism**
Clean, purposeful design that gets out of the way of ideas.

### **3. Accessibility First**
Inclusive design that works for everyone, everywhere.

### **4. Tier-Based Intelligence**
Visual systems that reflect the depth and complexity of knowledge domains.

---

## 🌈 **Color System Architecture**

### **Tier-Based Knowledge Palette**

```css
/* Foundational Knowledge (Tier 1) - Deep Blue */
foundational-600: #1e40af  /* Primary - fundamental concepts */
foundational-50: #eff6ff   /* Backgrounds and accents */

/* Practical Knowledge (Tier 2) - Warm Red */
practical-600: #dc2626     /* Primary - applied knowledge */
practical-50: #fef2f2      /* Backgrounds and accents */

/* Specialized Knowledge (Tier 3) - Forest Green */
specialized-600: #059669   /* Primary - advanced concepts */
specialized-50: #ecfdf5    /* Backgrounds and accents */

/* Accent - Golden */
accent-500: #f59e0b        /* Highlights and important elements */
```

### **Sophisticated Neutral Scale**

```css
neutral-0: #ffffff         /* Pure white - backgrounds */
neutral-25: #fafafa        /* Soft white - primary background */
neutral-50: #f9fafb        /* Very light gray - accent background */
neutral-200: #e5e7eb       /* Light borders */
neutral-300: #d1d5db       /* Medium borders */
neutral-400: #9ca3af       /* Tertiary text */
neutral-500: #6b7280       /* Secondary text */
neutral-800: #1f2937       /* Primary text */
```

### **Semantic Colors**

```css
success-600: #16a34a       /* Success states */
warning-600: #d97706       /* Warning states */
error-600: #dc2626         /* Error states */
info-600: #2563eb          /* Information states */
```

---

## ✍️ **Typography System**

### **Font Stack**
```css
font-sans: 'Inter Variable', 'Inter', system-ui, sans-serif
font-mono: 'JetBrains Mono', 'Monaco', monospace
```

### **Type Scale**

| Class | Size | Line Height | Use Case |
|-------|------|-------------|----------|
| `text-display` | 56px | 1.1 | Hero headings |
| `text-h1` | 36px | 1.2 | Page titles |
| `text-h2` | 30px | 1.2 | Section headings |
| `text-h3` | 24px | 1.25 | Subsection headings |
| `text-h4` | 20px | 1.3 | Component headings |
| `text-body-large` | 18px | 1.6 | Important text |
| `text-body` | 16px | 1.6 | Regular text |
| `text-body-small` | 14px | 1.5 | Secondary text |
| `text-caption` | 12px | 1.4 | Labels, captions |

### **Typography Usage Examples**

```html
<!-- Hero Section -->
<h1 class="text-display font-bold text-neutral-900 text-balance">
  Mental Models Observatory
</h1>

<!-- Section Headers -->
<h2 class="text-h2 font-semibold text-neutral-900 mb-lg">
  Foundational Frameworks
</h2>

<!-- Body Content -->
<p class="text-body text-neutral-700 leading-relaxed">
  A comprehensive collection of intellectual frameworks...
</p>

<!-- Lead Paragraph -->
<p class="text-body-large text-neutral-800 mb-lg">
  Start your journey through 40 domains of knowledge.
</p>
```

---

## 📐 **Spacing System**

**8px Grid System**

| Class | Value | Use Case |
|-------|-------|----------|
| `xs` | 4px | Tight spacing |
| `sm` | 8px | Small gaps |
| `md` | 16px | Standard spacing |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Large gaps |
| `2xl` | 48px | Section breaks |
| `3xl` | 64px | Major breaks |
| `4xl` | 96px | Hero spacing |

### **Spacing Usage**

```html
<!-- Card with proper spacing -->
<div class="card">
  <div class="card-header p-lg">
    <h3 class="card-title mb-xs">Domain Title</h3>
    <p class="card-description">Description text</p>
  </div>
  <div class="card-content p-lg">
    <!-- Content with stack spacing -->
    <div class="stack">
      <p>Paragraph one</p>
      <p>Paragraph two</p>
      <p>Paragraph three</p>
    </div>
  </div>
</div>
```

---

## 🎛️ **Component System**

### **Buttons**

```html
<!-- Primary Action -->
<button class="btn btn-primary btn-lg">
  Explore Domains
</button>

<!-- Secondary Action -->
<button class="btn btn-secondary">
  Learn More
</button>

<!-- Outline Style -->
<button class="btn btn-outline">
  Browse Models
</button>

<!-- Ghost Style -->
<button class="btn btn-ghost btn-sm">
  View Details
</button>
```

### **Cards**

```html
<!-- Basic Card -->
<div class="card">
  <div class="card-header">
    <h3 class="card-title">First Principles Thinking</h3>
    <p class="card-description">
      Breaking down complex problems into fundamental truths
    </p>
  </div>
  <div class="card-content">
    <p>Card content goes here...</p>
  </div>
</div>

<!-- Tier-Based Card -->
<div class="card tier-foundational">
  <div class="card-header">
    <h3 class="card-title">Foundational Framework</h3>
  </div>
</div>
```

### **Badges**

```html
<!-- Difficulty Badges -->
<span class="badge badge-difficulty-beginner">Beginner</span>
<span class="badge badge-difficulty-intermediate">Intermediate</span>
<span class="badge badge-difficulty-advanced">Advanced</span>

<!-- Category Badges -->
<span class="badge badge-primary">Systems Thinking</span>
<span class="badge badge-secondary">Decision Making</span>
<span class="badge badge-outline">Psychology</span>
```

### **Inputs**

```html
<!-- Search Input -->
<input 
  type="search" 
  class="input input-lg" 
  placeholder="Search mental models..."
/>

<!-- Small Input -->
<input 
  type="text" 
  class="input input-sm" 
  placeholder="Filter by tag..."
/>
```

---

## 🎭 **Interactive States**

### **Hover Effects**

```html
<!-- Interactive Card -->
<div class="card interactive">
  <div class="card-content">
    Hover me for subtle scaling and shadow
  </div>
</div>

<!-- Gentle Hover -->
<button class="btn btn-primary hover:shadow-medium transition-all duration-fast">
  Smooth Interaction
</button>
```

### **Focus States**

All interactive elements include accessible focus states:

```css
/* Automatic focus ring */
*:focus-visible {
  @apply ring-2 ring-foundational-500 ring-offset-2;
}

/* Custom focus utilities */
.focus-ring {
  @apply focus-visible:ring-2 focus-visible:ring-foundational-500 focus-visible:ring-offset-2;
}
```

---

## 📱 **Responsive Containers**

```html
<!-- Reading-optimized container -->
<div class="container-reading">
  <article class="content-block">
    <!-- Content optimized for reading -->
  </article>
</div>

<!-- Full-width content -->
<div class="container-content">
  <!-- Dashboard-style content -->
</div>

<!-- Narrow content -->
<div class="container-narrow">
  <!-- Forms, focused content -->
</div>
```

---

## 🌊 **Elevation System**

```html
<!-- Subtle elevation -->
<div class="card elevation-1">Minimal shadow</div>

<!-- Standard elevation -->
<div class="card elevation-2">Gentle shadow</div>

<!-- Emphasized elevation -->
<div class="card elevation-3">Medium shadow</div>

<!-- Strong elevation -->
<div class="modal elevation-4">Strong shadow</div>

<!-- Maximum elevation -->
<div class="notification elevation-5">Emphasis shadow</div>
```

---

## ♿ **Accessibility Features**

### **Built-In Accessibility**

1. **Contrast Ratios**: All text meets WCAG 2.1 AA standards (4.5:1 minimum)
2. **Focus Management**: Visible focus states for keyboard navigation
3. **Screen Reader Support**: Semantic HTML and proper ARIA labels
4. **Motion Preferences**: Respects `prefers-reduced-motion`
5. **Touch Targets**: Minimum 44px touch targets for mobile

### **Accessibility Usage**

```html
<!-- Proper heading hierarchy -->
<h1>Main Page Title</h1>
<h2>Section Title</h2>
<h3>Subsection Title</h3>

<!-- Accessible buttons -->
<button class="btn btn-primary" aria-label="Explore foundational mental models">
  Explore Domains
</button>

<!-- Screen reader friendly links -->
<a href="/models/first-principles" class="nav-link">
  First Principles Thinking
  <span class="sr-only"> - Navigate to model details</span>
</a>
```

---

## 🎨 **Visual Effects**

### **Gradient Text**

```html
<h1 class="gradient-text">Mental Models Observatory</h1>
<span class="gradient-text-accent">Featured Content</span>
```

### **Glass Morphism**

```html
<div class="glass p-lg rounded-large">
  Subtle glass effect
</div>

<div class="glass-strong p-lg rounded-large">
  Strong glass effect
</div>
```

### **Animations**

```html
<!-- Fade in animation -->
<div class="animate-in">Content appears smoothly</div>

<!-- Fade up animation -->
<div class="animate-up">Content slides up</div>

<!-- Scale animation -->
<div class="animate-scale">Content scales in</div>
```

---

## 🔧 **Implementation Guidelines**

### **1. Component Composition**

Build complex interfaces by combining simple components:

```html
<div class="card tier-foundational interactive">
  <div class="card-header">
    <div class="flex items-start justify-between">
      <div>
        <h3 class="card-title">Systems Thinking</h3>
        <p class="card-description">Understanding interconnected wholes</p>
      </div>
      <span class="badge badge-difficulty-intermediate">Intermediate</span>
    </div>
  </div>
  <div class="card-content">
    <div class="stack">
      <p>Core principles of systems thinking...</p>
      <div class="cluster">
        <span class="badge badge-secondary">feedback</span>
        <span class="badge badge-secondary">emergence</span>
        <span class="badge badge-secondary">complexity</span>
      </div>
    </div>
  </div>
</div>
```

### **2. Consistent Spacing**

Use the stack and cluster utilities for consistent spacing:

```html
<!-- Vertical spacing with stack -->
<div class="stack-lg">
  <h2>Section Title</h2>
  <p>Content paragraph</p>
  <div class="card">Card content</div>
</div>

<!-- Horizontal spacing with cluster -->
<div class="cluster-lg">
  <button class="btn btn-primary">Action</button>
  <button class="btn btn-secondary">Cancel</button>
</div>
```

### **3. Tier-Based Styling**

Apply tier-based styling to reflect knowledge complexity:

```html
<!-- Foundational knowledge -->
<div class="card tier-foundational">
  <div class="card-header">
    <h3 class="card-title">Fundamental Concept</h3>
  </div>
</div>

<!-- Advanced/specialized knowledge -->
<div class="card tier-specialized">
  <div class="card-header">
    <h3 class="card-title">Advanced Framework</h3>
  </div>
</div>
```

---

## 🎪 **Brand Expression**

### **Voice & Tone**
- **Authoritative but approachable**
- **Intellectually rigorous yet accessible**
- **Personal journey meets universal wisdom**

### **Visual Personality**
- **Sophisticated minimalism**
- **Content-driven hierarchy**
- **Subtle depth and dimension**
- **Professional polish with human warmth**

---

This design system creates a cohesive, sophisticated foundation for the Mental Models Observatory that enhances intellectual engagement while maintaining the highest standards of accessibility and usability.
