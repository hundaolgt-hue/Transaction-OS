import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Siinqee Investment Bank — Advisor OS',
  icons: { icon: '/brand/mark.png', apple: '/brand/mark.png' },
  description:
    'Operating system for licensed transaction advisors in Ethiopia: client onboarding, document compliance against ECMA rules, AI-drafted due diligence, risk assessment and prospectus drafting, with a shared client dashboard.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07080d' },
    { media: '(prefers-color-scheme: light)', color: '#f8f9fc' },
  ],
};

const THEME_BOOT = `(function(){try{var t=localStorage.getItem('advisoros-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
