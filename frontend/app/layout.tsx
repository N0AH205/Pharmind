import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pharmind",
    template: "%s · Pharmind",
  },
  icons: { icon: "/pharmind-icon.png", apple: "/pharmind-icon.png" },
  description:
    "AI Drug Research Platform",
  keywords: ["Pharmind", "drug information", "pharmacology", "RAG", "SMILES", "pharmaceutical research"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
