import { BRAND } from '@/lib/brand';

/**
 * The firm's mark. Shows the official logo from public/brand/ when present;
 * otherwise a neutral monogram in the brand orange (not the bank's logo).
 */
export default function BrandMark({ logo, size = 28 }: { logo?: string | null; size?: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={BRAND.name} height={size} style={{ height: size, width: 'auto', maxWidth: size * 4, objectFit: 'contain', flex: 'none' }} />;
  }
  return (
    <span aria-hidden className="brand-monogram" style={{ width: size, height: size, fontSize: size * 0.56 }}>
      {BRAND.monogram}
    </span>
  );
}
