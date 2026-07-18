import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LectureWeaver | Build an evidence-grounded study pack",
  description:
    "Audit lecture coverage, rebuild clearer notes, and create Anki-ready cards with trusted source evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
