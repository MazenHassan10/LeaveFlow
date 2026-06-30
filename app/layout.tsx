import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeaveFlow",
  description: "Hour-based PTO requests, approvals, make-up plans, and reporting.",
};

export const viewport: Viewport = {
  themeColor: "#11131A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
