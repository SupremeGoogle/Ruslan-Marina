import type { Metadata, Viewport } from "next";
import { Marck_Script, Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const marckScript = Marck_Script({
  weight: "400",
  variable: "--font-handwriting",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const montserrat = Montserrat({
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
      className={`${marckScript.variable} ${cormorantGaramond.variable} ${montserrat.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

