import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8'
);

function luminance(value: string): number {
  const [lightness, chroma, hue] = value.split(/\s+/).map(Number);
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function token(block: string, name: string): string {
  const value = block.match(new RegExp(`--${name}:\\s*oklch\\(([^)/]+)`))?.[1];
  if (!value) throw new Error(`Missing ${name} token`);
  return value.trim();
}

const lightBlock = stylesheet.match(
  /html\[data-mode="light"\]\s*\{([\s\S]*?)\n\}/
)?.[1];

if (!lightBlock) throw new Error('Missing light theme tokens');

describe('global light theme readability', () => {
  it('keeps primary and muted text comfortably above WCAG AA', () => {
    const background = token(lightBlock, 'background');
    const card = token(lightBlock, 'card');

    expect(
      contrast(token(lightBlock, 'foreground'), background)
    ).toBeGreaterThan(7);
    expect(
      contrast(token(lightBlock, 'card-foreground'), card)
    ).toBeGreaterThan(7);
    expect(
      contrast(token(lightBlock, 'muted-foreground'), background)
    ).toBeGreaterThan(4.5);
    expect(
      contrast(token(lightBlock, 'muted-foreground'), card)
    ).toBeGreaterThan(4.5);
  });

  it('uses off-white surfaces instead of pure white', () => {
    expect(token(lightBlock, 'background')).not.toMatch(/^1(?:\.0+)?\s/);
    expect(token(lightBlock, 'card')).not.toMatch(/^1(?:\.0+)?\s/);
    expect(token(lightBlock, 'popover')).not.toMatch(/^1(?:\.0+)?\s/);
  });

  it.each(['violet', 'emerald', 'cobalt', 'amber', 'rose'])(
    '%s primary text exceeds WCAG AA on light cards',
    (theme) => {
      const block = stylesheet.match(
        new RegExp(
          `html\\[data-mode="light"\\]\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`
        )
      )?.[1];
      if (!block) throw new Error(`Missing ${theme} light accent tokens`);
      expect(
        contrast(token(block, 'primary'), token(lightBlock, 'card'))
      ).toBeGreaterThan(4.5);
    }
  );
});
