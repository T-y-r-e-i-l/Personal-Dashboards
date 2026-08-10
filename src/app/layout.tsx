import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Personal Dashboards",
  description: "A calm, capture-first dashboard for your daily life.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
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
