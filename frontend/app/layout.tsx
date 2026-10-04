import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import Toasts from "@/components/layout/Toasts";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", weight: ["300", "400", "500", "600", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FLOWGUARD: predictive system reliability",
  description: "Model how failures propagate, forecast their impact, and verify fixes before they ship.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen overflow-x-hidden">
        {children}
        <Toasts />
      </body>
    </html>
  );
}
