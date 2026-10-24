import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar · Lead Intelligence",
  description: "Kildebaseret prioritering af danske leverandører med mulige cyber- og kundekrav",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body className="antialiased">{children}</body>
    </html>
  );
}
