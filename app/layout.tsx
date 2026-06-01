import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";
import { SettingsProvider } from "@/components/providers/SettingsProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SalonNext",
  description: "Advanced Salon Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { auth } = await import("@/auth");
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} font-sans antialiased bg-[#FCFAF8] text-[#1c1917]`}
        suppressHydrationWarning
      >
        <SessionProviderWrapper session={session}>
          <SettingsProvider>
            {children}
          </SettingsProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
