import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Varejão Popular",
  description: "Gestão de campanhas, produtos e publicações",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
