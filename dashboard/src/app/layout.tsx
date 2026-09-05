import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FormFlux — form backends without the backend",
    template: "%s · FormFlux",
  },
  description:
    "Point your HTML form at FormFlux and get email delivery, spam protection, file uploads, webhooks, and analytics. No server code.",
  openGraph: {
    title: "FormFlux — form backends without the backend",
    description:
      "Email delivery, spam protection, file uploads, webhooks, and analytics for any HTML form.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
