import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FunnelChart, type FunnelStep } from "./funnel-chart";

const steps: FunnelStep[] = [
  { label: "Sent", value: 100, color: "bg-primary" },
  { label: "Delivered", value: 75, color: "bg-teal-500" },
  { label: "Read", value: 25, color: "bg-blue-500" },
  { label: "Replied", value: 0, color: "bg-indigo-500" },
];

function oklchLuminance(value: string): number {
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

function themeContrast(mode: "dark" | "light"): number {
  const stylesheet = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const theme = stylesheet.match(
    new RegExp(`html\\[data-mode="${mode}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`),
  )?.[1];
  if (!theme) throw new Error(`Missing ${mode} theme tokens`);

  const token = (name: string) => {
    const value = theme.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`))?.[1];
    if (!value) throw new Error(`Missing ${mode} ${name} token`);
    return oklchLuminance(value);
  };
  const foreground = token("foreground");
  const card = token("card");
  return (Math.max(foreground, card) + 0.05) / (Math.min(foreground, card) + 0.05);
}

describe("broadcast funnel readability", () => {
  it.each(["dark", "light"] as const)(
    "%s theme text/card contrast exceeds WCAG AA",
    (mode) => {
      expect(themeContrast(mode)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("renders every label, value and percentage inside a theme-safe contrast chip", () => {
    const markup = renderToStaticMarkup(<FunnelChart steps={steps} />);

    for (const label of ["Sent", "Delivered", "Read", "Replied"]) {
      expect(markup).toContain(label);
    }
    for (const percentage of ["(100%)", "(75%)", "(25%)", "(0%)"]) {
      expect(markup).toContain(percentage);
    }

    expect(markup).toContain("bg-card");
    expect(markup.match(/text-foreground/g)?.length).toBeGreaterThanOrEqual(9);
    expect(markup.match(/bg-background\/85/g)).toHaveLength(4);
    expect(markup.match(/absolute inset-y-1 left-1/g)).toHaveLength(4);
    expect(markup).toContain("ring-border/60");
    expect(markup).not.toContain("text-muted-foreground/80");
    expect(markup).not.toContain("sm:col-start-3");
  });

  it("preserves all existing bar colors, widths and zero-value visibility", () => {
    const markup = renderToStaticMarkup(<FunnelChart steps={steps} />);

    for (const color of ["bg-primary", "bg-teal-500", "bg-blue-500", "bg-indigo-500"]) {
      expect(markup).toContain(color);
    }
    for (const width of ["width:100%", "width:75%", "width:25%", "width:5%"]) {
      expect(markup).toContain(width);
    }

    expect(markup).toContain('aria-label="Replied: 0 (0%)"');
  });

  it("keeps metrics inside full-width mobile bars and inline beside labels on larger screens", () => {
    const markup = renderToStaticMarkup(<FunnelChart steps={steps} />);

    expect(markup).toContain("grid-cols-1");
    expect(markup).toContain("sm:grid-cols-[5rem_minmax(0,1fr)]");
    expect(markup).toContain("sm:row-start-1");
    expect(markup).toContain("whitespace-nowrap");
    expect(markup).toContain("tabular-nums");
    expect(markup).toContain("max-w-[calc(100%-0.5rem)]");
  });

  it("renders 0% for every step when no messages were sent", () => {
    const markup = renderToStaticMarkup(
      <FunnelChart steps={steps.map((step) => ({ ...step, value: 0 }))} />,
    );

    expect(markup.match(/\(0%\)/g)).toHaveLength(8);
    expect(markup.match(/width:5%/g)).toHaveLength(4);
  });
});
