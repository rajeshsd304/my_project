import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

// Hind Siliguri covers both Bangla and Latin, so Bangla question content renders correctly.
const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-hind-siliguri",
});

export const metadata: Metadata = {
  title: { default: "NextCampus — Admission Test Preparation", template: "%s · NextCampus" },
  description:
    "Mock exams and admission test preparation for engineering, medical and public university candidates in Bangladesh.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={hindSiliguri.variable}>
      <body className="bg-black font-sans text-fg">{children}</body>
    </html>
  );
}
