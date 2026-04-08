import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Geist } from "next/font/google";
import "./globals.css";
import { RefineProvider } from "@/providers/refine-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TradeVoy Portal",
  description: "AI 기반 해외 바이어 발굴 - 고객 포털",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AntdRegistry>
          <RefineProvider>{children}</RefineProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
