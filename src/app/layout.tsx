import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Voice Tutor for Documents",
  description: "Upload a document and learn from it with an AI voice tutor."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#243042"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
