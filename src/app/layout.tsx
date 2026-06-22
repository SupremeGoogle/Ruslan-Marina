import type { Metadata, Viewport } from "next";
import { Great_Vibes, Cormorant_Garamond, Nunito } from "next/font/google";
import "./globals.css";

// 🌹 Great Vibes — роскошный каллиграфический скрипт для заголовков и имён
const greatVibes = Great_Vibes({
  weight: "400",
  variable: "--font-handwriting",
  subsets: ["latin"],
  display: "swap",
});

// 📖 Cormorant Garamond — элегантный серифный для подзаголовков
const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// ✍️ Nunito — мягкий, читаемый sans-serif для основного текста
const nunito = Nunito({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Руслан & Марина — Свадебная Галерея",
  description: "Запечатлевая счастливые моменты нашей любви. Делитесь фотографиями в реальном времени!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fbf9f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${greatVibes.variable} ${cormorantGaramond.variable} ${nunito.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
