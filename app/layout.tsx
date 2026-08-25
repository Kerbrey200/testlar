import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'My Google AI Studio App',
  description: 'An application built with Google AI Studio.',
  openGraph: {
    title: 'My Google AI Studio App',
    description: 'An application built with Google AI Studio.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Google AI Studio App',
    description: 'An application built with Google AI Studio.',
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
