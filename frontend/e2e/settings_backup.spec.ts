import { test, expect } from "@playwright/test";

test.describe("Settings and Backup Management", () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route("**/api/v1/system/settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          retention_days: 90,
          auto_backup_enabled: true,
          theme: "dark",
        }),
      });
    });

    await page.route("**/api/v1/system/backups", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "bk-1",
            filename: "watchnet_backup_20261112.tar.gz",
            size_bytes: 1450200,
            created_at: "2026-11-12T03:00:00Z",
          },
        ]),
      });
    });
  });

  test("renders settings panels and backup options", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toContainText("Settings");
  });
});
