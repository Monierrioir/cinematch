import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import AppProviders from "@/components/AppProviders";
import NavBar from "@/components/NavBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-heading" });

export const metadata: Metadata = {
  title: "CineMatch",
  description: "Niche movie recommendations based on your taste"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${bebasNeue.variable}`}>
        <AppProviders>
          <NavBar />

          <main className="app-shell min-h-[calc(100vh-4rem)] py-8 md:py-10">
            {children}
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
