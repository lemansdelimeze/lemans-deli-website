import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../components/LanguageContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://lemansdeli.com"),

  title: {
    default: "Leman's Deli | Kaş'ın Butik Şarküterisi",
    template: "%s | Leman's Deli",
  },

  description:
    "Kaş'ta günlük hazırlanan mezeler, seçkin yerel ve dünya peynirleri, kaliteli deli etleri ve gurme sandviçler.",

  keywords: [
    "Kaş şarküteri",
    "Kaş meze",
    "Kaş deli",
    "Kaş peynir",
    "Kaş sandviç",
    "Leman's Deli",
    "gourmet delicatessen Kaş",
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
    title: "Leman's Deli | Kaş'ın Butik Şarküterisi",
    description:
      "Günlük mezeler, seçkin peynirler, kaliteli deli etleri ve gurme sandviçler.",
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
      </body>
    </html>
  );
}