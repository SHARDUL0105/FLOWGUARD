import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import Toasts from "@/components/layout/Toasts";
import ThemeSync from "@/components/layout/ThemeSync";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", weight: ["300", "400", "500", "600", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FLOWGUARD: predictive system reliability",
  description: "Model how failures propagate, forecast their impact, and verify fixes before they ship.",
};

// Runs before first paint so a returning visitor never sees a flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("fg-theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen overflow-x-hidden">
        {children}
        <ThemeSync />
        <Toasts />
      </body>
    </html>
  );
}
