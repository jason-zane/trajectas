import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals-marketing.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trajectas — Contextual Psychometric Assessment",
  description:
    "Assessment built around your context. Your organisation, your roles, your definition of what good looks like.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-surface="marketing"
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      {children}
    </div>
  );
}
