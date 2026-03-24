import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Context Graph System",
  description: "Order-to-cash context graph with LLM-powered PostgreSQL queries.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
