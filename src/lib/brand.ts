/**
 * Firm branding — the single place to white-label the OS.
 *
 * Colours are sampled from the Siinqee Investment Bank logo supplied by the
 * bank (public/brand/logo.png): royal blue #012DE6, bright blue #3E5DFF and
 * yellow #E9D001. Tagline: "Make it count".
 *
 * Assets in public/brand/:
 *   logo.png       full lock-up, dark text — for light surfaces
 *   logo-dark.png  full lock-up, white text — for dark surfaces
 *   mark.png       the symbol alone — sidebar, favicon, compact spots
 */
export const BRAND = {
  name: 'Siinqee Investment Bank',
  legalName: 'Siinqee Investment Bank S.C.',
  shortName: 'Siinqee IB',
  product: 'Advisor OS',
  tagline: 'Make it count',
  descriptor: 'Investment Banking · Transaction Advisory',
  group: 'Member of the Siinqee Financial Group',
  city: 'Addis Ababa',
  logo: { light: '/brand/logo.png', dark: '/brand/logo-dark.png', mark: '/brand/mark.png', ratio: 624 / 183 },
  colors: {
    blue: '#012DE6',      // primary — top bar of the symbol
    blueBright: '#3E5DFF', // secondary — middle bar
    yellow: '#E9D001',    // accent — the dot
    navy: '#050B3A',      // deep ground behind brand art
    blueOnDark: '#7089FF', // primary tuned for text/buttons on dark surfaces (AA)
    gold: '#B39A00',      // yellow tuned for marks on white paper
  },
} as const;

/** Colours the PDF engine uses (print, white paper). */
export const PRINT_BRAND = {
  accent: BRAND.colors.blue,
  accentSoft: '#EDF0FF',
  coverBand: '#06104F',
  coverRule: BRAND.colors.blueBright,
  coverRule2: BRAND.colors.yellow,
  coverEyebrow: BRAND.colors.yellow,
  coverSub: '#CFD7FF',
  good: '#0A7F1A',
};
