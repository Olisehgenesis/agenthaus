import type { Metadata } from "next";
import { headers } from "next/headers";
import { Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Celo AgentHAUS | No-Code AI Agent Platform",
  description: "Create, deploy, and manage AI agents on the Celo blockchain. No coding required.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const cookies = headersList.get("cookie");

  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${geistMono.variable} antialiased bg-gypsum text-forest`}
      >
        <Providers cookies={cookies}>{children}</Providers>
      </body>
    </html>
  );
}
