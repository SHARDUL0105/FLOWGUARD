import "./globals.css";
export const metadata = { title: "FLOWGUARD", description: "Predictive reliability platform" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="font-sans antialiased">{children}</body></html>);
}
