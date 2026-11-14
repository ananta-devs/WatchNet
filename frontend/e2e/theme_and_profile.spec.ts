import { test, expect } from "@playwright/test";

test.describe("Dark Mode / Light Mode and Profile Header Tests", () => {
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

    await page.route("**/api/v1/system/overview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          active_devices: 42,
          offline_devices: 5,
          total_alerts: 0,
          system_status: "Healthy",
        }),
      });
    });
  });

  test("theme toggle toggles html .dark class, localStorage, and header button text", async ({ page }) => {
    await page.goto("/dashboard");

    const html = page.locator("html");
    const themeBtn = page.locator('header button[title="Toggle theme"]');
    await expect(themeBtn).toBeVisible();

    // Default theme is dark
    await expect(html).toHaveClass(/dark/);
    await expect(themeBtn).toContainText("Light Mode");

    // Click to switch to Light Mode
    await themeBtn.click();
    await expect(html).not.toHaveClass(/dark/);
    await expect(themeBtn).toContainText("Dark Mode");

    // Verify localStorage has 'light'
    const storedTheme1 = await page.evaluate(() => localStorage.getItem("watchnet_theme"));
    expect(storedTheme1).toBe("light");

    // Reload page and verify light mode persists
    await page.reload();
    await expect(html).not.toHaveClass(/dark/);
    await expect(themeBtn).toContainText("Dark Mode");

    // Click to switch back to Dark Mode
    await themeBtn.click();
    await expect(html).toHaveClass(/dark/);
    await expect(themeBtn).toContainText("Light Mode");

    const storedTheme2 = await page.evaluate(() => localStorage.getItem("watchnet_theme"));
    expect(storedTheme2).toBe("dark");
  });

  test("profile and signout button are in top bar header and absent from sidebar bottom", async ({ page }) => {
    await page.goto("/dashboard");

    // Check header contains user profile info and Sign Out button
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header).toContainText(/admin/i);
    await expect(header).toContainText("Administrator");

    const headerLogoutBtn = header.locator('button[title="Sign Out"]');
    await expect(headerLogoutBtn).toBeVisible();

    // Check sidebar does NOT contain Sign Out button
    const aside = page.locator("aside");
    await expect(aside).toBeVisible();
    const asideLogoutBtn = aside.locator('button[title="Sign Out"]');
    await expect(asideLogoutBtn).toHaveCount(0);
  });
});
