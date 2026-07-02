import { describe, expect, it } from "vitest";
import {
  ALL_FONTS,
  HEADING_BODY_FONTS,
  MONO_FONTS,
  getFontByName,
  buildGoogleFontsUrl,
} from "@/lib/brand/fonts";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";

/** The curated font list backs both the brand editor and CSS generation. */
describe("brand font list integrity", () => {
  it("every font has a valid, category-consistent definition", () => {
    const fallback: Record<string, string> = {
      sans: "sans-serif",
      serif: "serif",
      mono: "monospace",
    };
    for (const font of ALL_FONTS) {
      expect(font.name.length, font.name).toBeGreaterThan(0);
      expect(font.weights.length, font.name).toBeGreaterThan(0);
      // family opens with the quoted name and ends with the category fallback
      expect(font.family, font.name).toContain(`"${font.name}"`);
      expect(font.family, font.name).toContain(fallback[font.category]);
      // googleId is either null (self-hosted) or a '+'-joined token, no spaces
      if (font.googleId !== null) {
        expect(font.googleId, font.name).not.toContain(" ");
      }
    }
  });

  it("includes the curated additions", () => {
    for (const name of [
      "Instrument Sans",
      "Space Grotesk",
      "Bricolage Grotesque",
      "IBM Plex Sans",
      "Playfair Display",
      "Spectral",
      "Libre Baskerville",
      "Instrument Serif",
      "IBM Plex Mono",
      "Space Mono",
    ]) {
      expect(getFontByName(name), name).toBeTruthy();
    }
  });

  it("builds a Google Fonts URL honouring each font's weights", () => {
    const url = buildGoogleFontsUrl(["Instrument Serif", "Space Mono"]);
    // Instrument Serif ships a single weight; Space Mono ships 400 + 700.
    expect(url).toContain("family=Instrument+Serif:wght@400");
    expect(url).toContain("family=Space+Mono:wght@400;700");
    expect(url).toContain("display=swap");
  });

  it("emits category-correct CSS font-family fallbacks", () => {
    const tokens = generateCSSTokens({
      ...TRAJECTAS_DEFAULTS,
      headingFont: "Playfair Display",
      bodyFont: "Instrument Sans",
      monoFont: "Space Mono",
    }).tokens;
    expect(tokens["--brand-font-heading"]).toBe('"Playfair Display", Georgia, serif');
    expect(tokens["--brand-font-body"]).toBe('"Instrument Sans", system-ui, sans-serif');
    expect(tokens["--brand-font-mono"]).toBe('"Space Mono", ui-monospace, monospace');
  });

  it("keeps heading/body and mono lists disjoint by category", () => {
    expect(HEADING_BODY_FONTS.every((f) => f.category !== "mono")).toBe(true);
    expect(MONO_FONTS.every((f) => f.category === "mono")).toBe(true);
  });
});
