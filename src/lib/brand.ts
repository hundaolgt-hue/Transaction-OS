/**
 * Firm branding — the single place to white-label the OS.
 *
 * Colours follow Siinqee's public palette (orange #F4941C, green #00B415).
 * Replace them with the values from the bank's official brand guide if they
 * differ. The official logo is NOT bundled: drop the approved file at
 * `public/brand/logo.svg` (or .png) — the UI picks it up automatically, and
 * falls back to a neutral monogram until then.
 */
export const BRAND = {
  name: 'Siinqee Investment Bank',
  legalName: 'Siinqee Investment Bank S.C.',
  shortName: 'Siinqee IB',
  monogram: 'S',
  product: 'Advisor OS',
  descriptor: 'Investment Banking · Transaction Advisory',
  group: 'Member of the Siinqee Financial Group',
  city: 'Addis Ababa',
  colors: {
    orange: '#F4941C',     // primary brand colour (fills, marks, charts)
    orangeDeep: '#B35C00', // orange tuned for text/buttons on light surfaces (WCAG AA)
    green: '#00B415',      // secondary brand colour
    greenDeep: '#0A7F1A',  // green tuned for text on light surfaces
    night: '#1C1106',      // deep brown-black used behind the brand art
    onOrange: '#1A0F02',   // text on the orange
  },
} as const;

/** Colours the PDF engine uses (print, white paper). */
export const PRINT_BRAND = {
  accent: BRAND.colors.orangeDeep,
  accentSoft: '#FDF1E3',
  coverBand: '#241507',
  coverRule: BRAND.colors.orange,
  coverEyebrow: '#F8B866',
  coverSub: '#F3DFC6',
  good: BRAND.colors.greenDeep,
};
