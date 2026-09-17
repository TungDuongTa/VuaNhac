import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "VuaNhac — Guess the song",
  description:
    "Hear a short clip and guess the song. Five difficulties, five chances.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "dark h-full antialiased font-sans",
        outfit.variable,
        syne.variable,
      )}
    >
      <body className="flex min-h-full flex-col bg-black font-sans text-zinc-100">
        {children}
      </body>
    </html>
  );
}
