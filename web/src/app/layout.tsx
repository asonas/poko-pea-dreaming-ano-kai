import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ぽこピーのゆめうつつ 検索',
  description: 'ぽこピーのゆめうつつの文字起こしをセマンティック検索',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
