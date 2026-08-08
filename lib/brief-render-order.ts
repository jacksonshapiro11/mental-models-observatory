export const BRIEF_HERO_RENDER_ORDER = [
  'epigraph',
  'dailyTitle',
  'lede',
] as const;

export type BriefHeroBlock = (typeof BRIEF_HERO_RENDER_ORDER)[number];
