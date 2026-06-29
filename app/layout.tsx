import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time-Off Tracker",
  description: "Hour-based PTO requests, approvals, make-up plans, and reporting."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
