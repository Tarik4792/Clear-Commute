import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearCommute — MTA Crowd Intelligence",
  description: "AI-powered crowd forecasts for every MTA line. Beat the rush.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
