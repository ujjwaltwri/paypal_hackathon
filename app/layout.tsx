import type { Metadata } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Chargeback Copilot",
  description: "Dispute management for small merchants on PayPal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <div className="border-b border-[#fedf89] bg-warn-soft py-1.5 text-center text-[12px] font-medium text-warn">
          Sandbox mode. Disputes come from the PayPal sandbox or built-in demo data. No real money moves.
        </div>
        <TopBar />
        <main className="mx-auto max-w-[1180px] px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
