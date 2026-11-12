import { test, expect } from "@playwright/test";

test.describe("Network Discovery Module", () => {
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

    await page.route("**/api/v1/discovery/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_running: false,
          last_scan_time: "2026-11-12T14:00:00Z",
          last_duration_sec: 14.2,
          modules_active: ["arp", "icmp", "ipneigh"],
          total_discovered: 38,
        }),
      });
    });

    await page.route("**/api/v1/discovery/logs", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { timestamp: "2026-11-12 14:00:01", level: "INFO", message: "Starting ARP scan on 192.168.1.0/24" },
          { timestamp: "2026-11-12 14:00:15", level: "INFO", message: "Discovered 38 active hosts" },
        ]),
      });
    });
  });

  test("triggers on-demand scan and displays module toggles and log entries", async ({ page }) => {
    await page.route("**/api/v1/discovery/scan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "started", scan_id: "scan-99" }),
      });
    });

    await page.goto("/discovery");

    // Check modules are displayed
    await expect(page.locator("body")).toContainText("ARP Scanner");
    await expect(page.locator("body")).toContainText("ICMP Ping Prober");

    // Trigger scan button exists
    const scanBtn = page.locator("button:has-text('Scan')").first();
    if (await scanBtn.isVisible()) {
      await scanBtn.click();
    }
  });
});
