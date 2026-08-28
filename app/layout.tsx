import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'СтройМенеджер - Қурилишни Бошқариш Тизими',
  description: 'Бошқармалар ва марказий аппарат учун ягона қурилиш бошқарув тизими',
  openGraph: {
    title: 'СтройМенеджер',
    description: 'Бошқармалар ва марказий аппарат учун ягона қурилиш бошқарув тизими',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'СтройМенеджер',
    description: 'Бошқармалар ва марказий аппарат учун ягона қурилиш бошқарув тизими',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined' && window.fetch) {
                  var origFetch = window.fetch;
                  try {
                    Object.defineProperty(window, 'fetch', {
                      get: function() { return origFetch; },
                      set: function(v) { origFetch = v; },
                      configurable: true,
                      enumerable: true
                    });
                  } catch (e) {}
                }
              } catch (err) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
