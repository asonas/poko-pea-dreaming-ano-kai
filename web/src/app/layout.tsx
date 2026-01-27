import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ぽこピーのゆめうつつのあの回',
  description: 'ぽこピーのゆめうつつのあの回を探せるWebアプリケーション',
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
