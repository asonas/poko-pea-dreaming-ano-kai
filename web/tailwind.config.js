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
        // ぽこピーカラー（ロゴから抽出）
        'pokopea': {
          blue: '#4A85D2',
          pink: '#DF8AC8',
          yellow: '#EEE862',
          gray: '#AEAAAF',
          navy: '#213380',
        },
      },
    },
  },
  plugins: [],
};
