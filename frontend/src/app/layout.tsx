import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "AmbatuCode - Neurodivergent-Friendly Code Editor",
  description:
    "An adaptive code editor designed for neurodivergent developers with AI-powered features, emotional state detection, and wellbeing monitoring.",
  keywords: [
    "code editor",
    "neurodivergent",
    "ADHD",
    "autism",
    "dyslexia",
    "accessibility",
    "AI",
    "developer tools",
  ],
  authors: [{ name: "AmbatuCode Team" }],
  icons: {
    icon: [
      { url: '/logo.png?v=1', type: 'image/png' },
      { url: '/favicon.ico?v=1', sizes: 'any' },
    ],
    shortcut: '/logo.png?v=1',
    apple: '/logo.png?v=1',
  },
  openGraph: {
    title: "AmbatuCode - Neurodivergent-Friendly Code Editor",
    description:
      "An adaptive code editor designed for neurodivergent developers",
    type: "website",
    images: ['/logo.png'],
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/logo.png?v=1" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo.png?v=1" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png?v=1" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
