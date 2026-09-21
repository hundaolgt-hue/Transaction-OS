import { BRAND } from '@/lib/brand';

/**
 * Siinqee Investment Bank marks (files in public/brand/).
 * - `mark`: the symbol alone.
 * - `lockup`: symbol + name + tagline, swapping to the white-text file on dark surfaces.
 *   `on` forces a surface ('dark' for brand art panels); by default it follows the theme.
 */
export default function BrandMark({ variant = 'mark', size = 28, on }: { variant?: 'mark' | 'lockup'; size?: number; on?: 'light' | 'dark' }) {
  if (variant === 'mark') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={BRAND.logo.mark} alt="" aria-hidden width={size} height={size} style={{ width: size, height: size, flex: 'none', objectFit: 'contain' }} />;
  }
  const w = Math.round(size * BRAND.logo.ratio);
  const img = (src: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${BRAND.name} — ${BRAND.tagline}`} width={w} height={size} className={cls} style={{ height: size, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
  );
  if (on === 'dark') return img(BRAND.logo.dark, '');
  if (on === 'light') return img(BRAND.logo.light, '');
  return <span className="brand-lockup">{img(BRAND.logo.light, 'on-light')}{img(BRAND.logo.dark, 'on-dark')}</span>;
}
