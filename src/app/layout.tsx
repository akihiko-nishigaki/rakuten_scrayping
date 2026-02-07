import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { SessionProvider } from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "ランクリ - あなたの副業をもっとスマートに",
  description: "楽天アフィリエイト ランキング＆料率チェックツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <SessionProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </SessionProvider>
      </body>
    </html>
  );
}
