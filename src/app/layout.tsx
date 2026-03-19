import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NCERT Atlas",
  description: "Open or download NCERT books from a cover-first bookshelf.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
