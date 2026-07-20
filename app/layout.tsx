import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { LanguageProvider } from "../components/LanguageContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://lemansdeli.com"),

  title: {
    default: "Leman's Deli | Kaş'ta Mezeci & Butik Şarküteri",
    template: "%s | Leman's Deli",
  },

  description:
    "Kaş merkezde günlük hazırlanan taze mezeler, seçkin yerel ve dünya peynirleri, kaliteli şarküteri ürünleri ve gurme sandviçler. Paket servis ve gel-al",

  keywords: [
    "Kaş meze",
    "Kaş mezeleri",
    "Kaş'ta meze",
    "Kaş şarküteri",
    "Kaş deli",
    "Kaş paket meze",
    "Kaş peynir",
    "Kaş sandviç",
    "Leman's Deli",
    "Turkish meze Kaş",
  ],

  authors: [
    {
      name: "Leman's Deli",
    },
  ],

  creator: "Leman's Deli",
  publisher: "Leman's Deli",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Leman's Deli | Kaş'ın Butik Şarküterisi",
    description:
      "Günlük mezeler, seçkin peynirler, kaliteli deli etleri ve gurme sandviçler.",
    url: "https://lemansdeli.com",
    siteName: "Leman's Deli",
    locale: "tr_TR",
    type: "website",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "Leman's Deli – Kaş'ın Butik Şarküterisi",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Leman's Deli | Kaş Meze & Butik Şarküteri",
    description:
      "Kaş merkezde günlük hazırlanan taze mezeler, seçkin yerel ve dünya peynirleri, kaliteli şarküteri ürünleri ve gurme sandviçler. Paket servis ve gel-al.",
    images: ["/opengraph-image.jpg"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },

  category: "food",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <LanguageProvider>{children}</LanguageProvider>

        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-F6NJ6LVT6D"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-F6NJ6LVT6D');
          `}
        </Script>
      </body>
    </html>
  );
}