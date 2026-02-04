import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ぽこピーのゆめうつつのあの回',
  description: '『ぽこピーのゆめうつつ』のあの回どれだっけかな？のときに役に立つサイトです',
  openGraph: {
    title: 'ぽこピーのゆめうつつのあの回',
    description: '『ぽこピーのゆめうつつ』のあの回どれだっけかな？のときに役に立つサイトです',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary',
    title: 'ぽこピーのゆめうつつのあの回',
    description: '『ぽこピーのゆめうつつ』のあの回どれだっけかな？のときに役に立つサイトです',
  },
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
