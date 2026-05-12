import { expect, test } from "@playwright/test";

test.describe("marketing motion", () => {
  test("promotes the public homepage to the animated surface", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    const root = page.locator('[data-surface="marketing"]');
    await expect(root).toHaveAttribute("data-motion", "on");
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect
      .poll(async () =>
        page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext("2d");
          if (!context) return false;

          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 3; i < pixels.data.length; i += 4) {
            if (pixels.data[i] > 0) return true;
          }

          return false;
        }),
      )
      .toBe(true);
    await expect(page.locator(".problem-sticky")).toHaveCSS(
      "position",
      "sticky",
    );

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.45));

    await expect
      .poll(async () =>
        page
          .locator('[data-section="problem"]')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue("--scroll-progress").trim(),
          ),
      )
      .not.toBe("0");
  });

  test("keeps the readable static surface for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const root = page.locator('[data-surface="marketing"]');
    await expect(root).not.toHaveAttribute("data-motion", "on");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".problem-sticky")).toHaveCSS(
      "position",
      "static",
    );
    await expect(page.locator(".builtfor-panel").first()).toHaveCSS(
      "opacity",
      "1",
    );
  });

  test("does not fail on legacy motion and viewport observer APIs", async ({
    page,
  }) => {
    const pageErrors: string[] = [];

    await page.emulateMedia({ reducedMotion: "no-preference" });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const nativeMatchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query) => {
        const mediaQuery = nativeMatchMedia(query);
        Object.defineProperty(mediaQuery, "addEventListener", {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(mediaQuery, "removeEventListener", {
          value: undefined,
          configurable: true,
        });
        return mediaQuery;
      };

      Object.defineProperty(window, "IntersectionObserver", {
        value: undefined,
        configurable: true,
      });
    });

    await page.goto("/");

    await expect(page.locator('[data-surface="marketing"]')).toHaveAttribute(
      "data-motion",
      "on",
    );
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator(".builtfor-panel").first()).toHaveCSS(
      "opacity",
      "1",
    );
    expect(pageErrors).toEqual([]);
  });
});
