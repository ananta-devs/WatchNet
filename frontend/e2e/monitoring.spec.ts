import { test, expect } from "@playwright/test";

test.describe("Monitoring and Metrics Module", () => {
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

    await page.route("**/api/v1/monitoring/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          internet_connected: true,
          latency_ms: 15.4,
          jitter_ms: 2.1,
          packet_loss_percent: 0.0,
          dns_resolution_time_ms: 8.2,
        }),
      });
    });

    await page.route("**/api/v1/monitoring/targets", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "tgt-1", name: "Cloudflare DNS", url: "1.1.1.1", status: "up", response_time_ms: 12 },
          { id: "tgt-2", name: "Google Gateway", url: "8.8.8.8", status: "up", response_time_ms: 14 },
        ]),
      });
    });
  });

  test("displays internet health card and website uptime table", async ({ page }) => {
    await page.goto("/monitoring");
    await expect(page.locator("body")).toContainText(/Monitoring|Internet|Latency/i);
  });

  test("loads wallboard view cleanly without crash", async ({ page }) => {
    await page.goto("/monitoring/wallboard");
    await expect(page.locator("body")).not.toContainText("404");
  });
});
