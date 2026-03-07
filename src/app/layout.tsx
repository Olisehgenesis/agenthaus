import type { Metadata } from "next";
import { headers } from "next/headers";
import { Anton, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
        className={`${anton.variable} ${spaceMono.variable} antialiased bg-gypsum text-forest`}
      >
        <Providers cookies={cookies}>{children}</Providers>
      </body>
    </html>
  );
}
