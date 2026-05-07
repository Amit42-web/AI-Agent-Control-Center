import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Agent Control Center | Convin",
  description: "Test voice-bot calls, detect issues, analyze errors, and generate fix suggestions in one simple flow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased min-h-screen flex flex-col">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
