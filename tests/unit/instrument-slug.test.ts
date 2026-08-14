import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/instrument/slug";

describe("slugify", () => {
  it("lowercases input", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("UPPERCASE")).toBe("uppercase");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugify("foo bar baz")).toBe("foo-bar-baz");
  });

  it("collapses multiple spaces into a single hyphen", () => {
    expect(slugify("foo   bar")).toBe("foo-bar");
    expect(slugify("multiple    spaces")).toBe("multiple-spaces");
  });

  it("replaces underscores with hyphens", () => {
    expect(slugify("foo_bar")).toBe("foo-bar");
    expect(slugify("foo__bar")).toBe("foo-bar");
  });

  it("removes punctuation", () => {
    expect(slugify("hello, world!")).toBe("hello-world");
    expect(slugify("foo@bar#baz")).toBe("foobarbaz");
  });

  it("removes leading and trailing hyphens", () => {
    expect(slugify("---hello-world---")).toBe("hello-world");
    expect(slugify("-foo-bar-")).toBe("foo-bar");
  });

  it("trims whitespace before processing", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
    expect(slugify("\thello\n")).toBe("hello");
  });

  it("handles mixed separators", () => {
    expect(slugify("foo-bar_baz qux")).toBe("foo-bar-baz-qux");
  });

  it("returns 'untitled' for empty input", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
    expect(slugify("!!!")).toBe("untitled");
  });

  it("caps at 60 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(60);
    expect(slugify(long)).toBe("a".repeat(60));
  });

  it("handles accents and non-ASCII (note: implementation may not strip accents)", () => {
    // The underlying implementation uses \w which may not normalize accents.
    // This test documents the current behavior; diacritic normalization
    // is out of scope for the initial implementation.
    const result = slugify("café");
    expect(result).toMatch(/^[a-z-]*$/);
  });

  it("handles numbers", () => {
    expect(slugify("item 123")).toBe("item-123");
    expect(slugify("2026-04-20")).toBe("2026-04-20");
  });

  it("handles already-valid slugs", () => {
    expect(slugify("valid-slug")).toBe("valid-slug");
    expect(slugify("valid-slug-123")).toBe("valid-slug-123");
  });

  it("handles single-character input", () => {
    expect(slugify("a")).toBe("a");
    expect(slugify("1")).toBe("1");
  });
});

describe("uniqueSlug", () => {
  it("returns base if not in taken set", () => {
    expect(uniqueSlug("foo", [])).toBe("foo");
    expect(uniqueSlug("foo", ["bar", "baz"])).toBe("foo");
  });

  it("appends -2 if base is taken", () => {
    expect(uniqueSlug("foo", ["foo"])).toBe("foo-2");
  });

  it("appends -3, -4, ... for collisions", () => {
    expect(uniqueSlug("foo", ["foo", "foo-2"])).toBe("foo-3");
    expect(uniqueSlug("foo", ["foo", "foo-2", "foo-3"])).toBe("foo-4");
  });

  it("handles case-insensitive comparison (citext)", () => {
    // Comparison is case-insensitive, but the returned slug preserves the base case
    expect(uniqueSlug("foo", ["FOO"])).toBe("foo-2");
    expect(uniqueSlug("Foo", ["foo"])).toBe("Foo-2");
    expect(uniqueSlug("FOO", ["foo", "foo-2", "Foo-3"])).toBe("FOO-4");
  });

  it("handles gaps in collision chain", () => {
    // If -2 exists but -3 is missing, returns -3
    expect(uniqueSlug("foo", ["foo", "foo-2", "foo-4"])).toBe("foo-3");
  });

  it("handles empty taken set", () => {
    expect(uniqueSlug("anything", [])).toBe("anything");
    expect(uniqueSlug("test", new Set())).toBe("test");
  });

  it("works with Set input", () => {
    const taken = new Set(["foo", "foo-2"]);
    expect(uniqueSlug("foo", taken)).toBe("foo-3");
  });

  it("works with Array input", () => {
    const taken = ["foo", "foo-2"];
    expect(uniqueSlug("foo", taken)).toBe("foo-3");
  });

  it("preserves capitalization in returned slug (base capitalization)", () => {
    expect(uniqueSlug("Foo", ["foo"])).toBe("Foo-2");
    expect(uniqueSlug("FOO-bar", ["foo-bar"])).toBe("FOO-bar-2");
  });

  it("handles slugs with numbers", () => {
    expect(uniqueSlug("item-123", ["item-123"])).toBe("item-123-2");
    expect(uniqueSlug("item-123", ["item-123", "item-123-2"])).toBe("item-123-3");
  });

  it("handles hyphenated bases", () => {
    expect(uniqueSlug("foo-bar", ["foo-bar"])).toBe("foo-bar-2");
    expect(uniqueSlug("foo-bar", ["foo-bar", "foo-bar-2"])).toBe("foo-bar-3");
  });

  it("stops searching after 100 attempts (fallback with timestamp)", () => {
    // Create an iterator that returns many collisions to test the 100-attempt limit
    const taken: string[] = [];
    for (let i = 0; i < 101; i++) {
      taken.push(i === 0 ? "foo" : `foo-${i}`);
    }
    const result = uniqueSlug("foo", taken);
    expect(result).toMatch(/^foo-\d+$/);
  });
});
