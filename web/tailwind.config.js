/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ぽこピーカラー（ロゴから抽出）+ 「ゆめうつつ」薄明トーン
        'pokopea': {
          blue: '#4A85D2',
          pink: '#DF8AC8',
          'pink-deep': '#C05CA4', // 白背景でテキスト/枠に使える濃いピンク
          yellow: '#EEE862',
          gray: '#AEAAAF',
          navy: '#213380',
        },
        'ink': '#2A2F45',
        'ink-soft': '#616a8c',
      },
      fontFamily: {
        display: ['var(--font-display)'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(33, 51, 128, 0.04), 0 8px 24px -12px rgba(33, 51, 128, 0.18)',
        'card-hover': '0 2px 4px rgba(33, 51, 128, 0.06), 0 16px 36px -14px rgba(33, 51, 128, 0.30)',
        console: '0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 40px -12px rgba(33, 51, 128, 0.35)',
      },
    },
  },
  plugins: [],
};
