import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import Sidebar from "@/components/Sidebar";
import Footer from "@/components/Footer";
import "./globals.css";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codebase Whisperer",
  description: "Chat with any GitHub repository using AI. Understand architecture, explore code, and get answers instantly using RAG.",
  keywords: ["GitHub", "AI", "Codebase", "RAG", "LLM", "Developer Tools"],
  authors: [{ name: "Sudarshan Dandgawal" }],
  openGraph: {
    title: "Codebase Whisperer",
    description: "Chat with any GitHub repository using AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="flex flex-col min-h-[100dvh]" suppressHydrationWarning>
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex overflow-hidden relative">
              <Sidebar />
              <div className="flex-1 overflow-auto bg-slate-100/80 relative">
                {children}
              </div>
            </div>
          </main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
