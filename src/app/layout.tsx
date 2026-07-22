import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
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
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          <Header />
          <div className="flex-1 flex overflow-hidden relative">
            <Sidebar />
            <div className="flex-1 overflow-auto bg-slate-50 relative">
              {children}
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
