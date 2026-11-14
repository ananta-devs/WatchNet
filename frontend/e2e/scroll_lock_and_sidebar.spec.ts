import { test, expect } from "@playwright/test";

test.describe("Sidebar and Dialog Scroll Behavior", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate session mock
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "usr-001",
          username: "admin",
          email: "admin@watchnet.local",
          role: "Administrator",
          is_active: true,
        }),
      });
    });

    await page.route("**/api/v1/routers**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "rtr-1",
            name: "UniFi Dream Machine Pro",
            vendor: "UniFi",
            model: "UDM-Pro",
            firmware: "3.2.12",
            host: "192.168.1.1",
            port: 443,
            username: "ubnt",
            is_active: true,
            last_connected_at: "2026-11-12T14:00:00Z",
            client_count: 24,
          },
        ]),
      });
    });

    await page.route("**/api/v1/routers/*/clients", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem("access_token", "mock-auth-token-12345");
      localStorage.setItem("user", JSON.stringify({
        id: "usr_admin",
        username: "admin",
        role: "admin",
        display_name: "System Administrator"
      }));
    });
  });

  test("desktop sidebar is sticky/fixed to viewport and does not show scrollbars", async ({ page }) => {
    await page.goto("/dashboard");
    const aside = page.locator("aside").first();
    await expect(aside).toBeVisible();

    // Verify aside has sticky top-0 and h-screen
    await expect(aside).toHaveClass(/sticky/);
    await expect(aside).toHaveClass(/top-0/);
    await expect(aside).toHaveClass(/h-screen/);

    // Verify nav has no-scrollbar utility class
    const nav = aside.locator("nav");
    await expect(nav).toHaveClass(/no-scrollbar/);
  });

  test("scrolling main content does not scroll aside or header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/dashboard");

    const aside = page.locator("aside").first();
    const main = page.locator("main").first();
    const header = page.locator("header").first();

    await expect(aside).toBeVisible();
    await expect(main).toBeVisible();

    // Get initial bounding box or scroll position of aside and header
    const initialAsideScrollTop = await aside.evaluate((el) => el.scrollTop);
    const initialHeaderBox = await header.boundingBox();
    const initialAsideBox = await aside.boundingBox();

    // Add extra scrollable height to main if needed to ensure overflow-y scroll can occur
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.id = "test-scroll-spacer";
      spacer.style.height = "2500px";
      document.querySelector("main")?.appendChild(spacer);
    });

    // Scroll main element down by 600px
    await main.evaluate((el) => {
      el.scrollTop = 600;
    });

    // Assert main is scrolled
    const mainScrollTop = await main.evaluate((el) => el.scrollTop);
    expect(mainScrollTop).toBeGreaterThanOrEqual(500);

    // Assert aside scroll position and position did not move
    const afterAsideScrollTop = await aside.evaluate((el) => el.scrollTop);
    expect(afterAsideScrollTop).toBe(initialAsideScrollTop);

    const afterAsideBox = await aside.boundingBox();
    expect(afterAsideBox?.y).toBe(initialAsideBox?.y);

    const afterHeaderBox = await header.boundingBox();
    expect(afterHeaderBox?.y).toBe(initialHeaderBox?.y);

    // Verify window itself did not scroll
    const windowScrollY = await page.evaluate(() => window.scrollY);
    expect(windowScrollY).toBe(0);
  });

  test("routers modal dialog locks background body scroll and restores on close", async ({ page }) => {
    await page.goto("/routers");
    await expect(page.locator("h1").filter({ hasText: "Router Intelligence & Vendor Adapters" })).toBeVisible();

    // Verify initial body overflow is not hidden
    const initialOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(initialOverflow).not.toBe("hidden");

    // Click "Add Router" to open modal
    const addRouterBtn = page.locator("button").filter({ hasText: "Add Router" });
    await addRouterBtn.click();

    // Dialog is visible
    const modalHeading = page.locator("h3").filter({ hasText: "Register Gateway Router" });
    await expect(modalHeading).toBeVisible();

    // Verify body & html overflow are now hidden
    const lockedBodyOverflow = await page.evaluate(() => document.body.style.overflow);
    const lockedHtmlOverflow = await page.evaluate(() => document.documentElement.style.overflow);
    expect(lockedBodyOverflow).toBe("hidden");
    expect(lockedHtmlOverflow).toBe("hidden");

    // Close modal via close button inside modal
    const closeBtn = page.locator("div.fixed button:has(svg.lucide-x)");
    await closeBtn.click();
    await expect(modalHeading).not.toBeVisible();

    // Verify body & html overflow are restored
    const restoredBodyOverflow = await page.evaluate(() => document.body.style.overflow);
    const restoredHtmlOverflow = await page.evaluate(() => document.documentElement.style.overflow);
    expect(restoredBodyOverflow).not.toBe("hidden");
    expect(restoredHtmlOverflow).not.toBe("hidden");
  });

  test("mobile sidebar drawer locks body scroll and closes cleanly", async ({ page }) => {
    // Set viewport to mobile screen
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard");

    // Open mobile sidebar
    const hamburgerBtn = page.locator("header button").first();
    await hamburgerBtn.click();

    // Verify mobile drawer is visible
    const mobileDrawer = page.locator("aside.relative");
    await expect(mobileDrawer).toBeVisible();

    // Verify body is locked
    const lockedBodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(lockedBodyOverflow).toBe("hidden");

    // Click backdrop to close (use position outside the drawer)
    const backdrop = page.locator('div[aria-label="Close menu backdrop"]');
    await backdrop.click({ position: { x: 300, y: 100 } });

    // Verify closed and restored
    await expect(mobileDrawer).not.toBeVisible();
    const restoredBodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(restoredBodyOverflow).not.toBe("hidden");
  });
});
