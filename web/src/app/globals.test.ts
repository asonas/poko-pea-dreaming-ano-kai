import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Unsupported color: ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('action color', () => {
  it('meets WCAG AA contrast against white normal-size text', () => {
    const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
    const actionColor = css.match(/--pink-deep:\s*(#[\da-f]{6})/i)?.[1];

    expect(actionColor).toBeDefined();
    expect(contrastRatio(actionColor!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
