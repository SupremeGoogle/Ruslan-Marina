import type { Metadata, Viewport } from "next";
import { Alex_Brush, Cormorant_Garamond, Nunito } from "next/font/google";
import "./globals.css";

// ✍️ Alex Brush — элегантный каллиграфический скрипт (как на diana-viktor.vercel.app)
const alexBrush = Alex_Brush({
  weight: "400",
  variable: "--font-handwriting",
  subsets: ["latin"],
  display: "swap",
});

// 📖 Cormorant Garamond — изысканный серифный для заголовков
const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// 🔤 Nunito — мягкий читаемый для основного текста
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
      className={`${alexBrush.variable} ${cormorantGaramond.variable} ${nunito.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
