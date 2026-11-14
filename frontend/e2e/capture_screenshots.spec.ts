import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Live Manual Testing & Screenshot Capture in Chrome", () => {
  const outDir = "D:/WatchNet-Rebuild/docs/testing/manual/chrome";

  test.beforeAll(() => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "1", username: "admin", role: "admin" }),
      });
    });

    await page.route("**/api/v1/devices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          devices: [],
          total: 0,
          page: 1,
          size: 50,
          pages: 0,
        }),
      });
    });

    await page.route("**/api/v1/routers*", async (route) => {
      if (route.request().url().includes("/clients")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    await page.route("**/api/v1/monitoring/internet**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_connected: true,
          wan_ip: "198.51.100.1",
          gateway_latency_ms: 12.4,
          dns_resolution_ms: 8.1,
          dns_resolvers: { Cloudflare: 8.1, Google: 11.2, Quad9: 9.4 },
        }),
      });
    });

    await page.route("**/api/v1/monitoring/speedtest/history*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.route("**/api/v1/monitoring/websites*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    await page.route("**/api/v1/system/maintenance/stats*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          database_size_mb: 0.1,
          total_devices: 0,
          total_events: 0,
          total_sessions: 0,
        }),
      });
    });

    await page.route("**/api/v1/system/backups*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("01 - Login Screen Interactive Test", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /WatchNet/i })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "01_login_screen.png"), fullPage: true });
  });

  test("02 - Overview Dashboard Interactive Test", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "02_dashboard_overview.png"), fullPage: true });
  });

  test("03 - Device Inventory Interactive Test", async ({ page }) => {
    await page.goto("/devices");
    await expect(page.getByText("No devices found matching your criteria.")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "03_devices_inventory.png"), fullPage: true });
  });

  test("04 - Router Management Interactive Test", async ({ page }) => {
    await page.goto("/routers");
    await expect(page.getByText("No Routers Registered", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "04_routers_management.png"), fullPage: true });
  });

  test("05 - System Settings & Backup Interactive Test", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: path.join(outDir, "05_settings_backup.png"), fullPage: true });
  });
});

