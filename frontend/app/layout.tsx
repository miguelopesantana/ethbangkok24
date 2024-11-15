import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Rice Bowl',
  description: 'Fluffless jasmine rice for those cold winter nights',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#18181b' },
    { media: '(prefers-color-scheme: light)', color: '#f4f4f5' }
  ]
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel='icon' type='image/png' href='/images/favicon.png' />
        <link rel='apple-touch-icon' href='/images/icon-maskable-512.png' />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}