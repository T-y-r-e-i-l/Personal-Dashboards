import type { Metadata } from "next";
import { Fraunces, DM_Sans, Caveat, Space_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastHost } from "@/components/ui/Toast";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notes = Caveat({
  variable: "--font-notes",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/** Monospace UI face for Retro Style theme. */
const retro = Space_Mono({
  variable: "--font-retro",
  subsets: ["latin"],
  weight: ["400", "700"],
});

function appOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  title: "Ghost Writer",
  description: "A calm, capture-first dashboard for your daily life.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${notes.variable} ${retro.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {children}
          <ToastHost />
        </QueryProvider>
      </body>
    </html>
  );
}
