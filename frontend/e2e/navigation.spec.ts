import { test, expect } from "@playwright/test";

const routesToTest = [
  { name: "Overview", path: "/dashboard", headerText: "Enterprise Network Overview" },
  { name: "Devices", path: "/devices", headerText: "Device Inventory" },
  { name: "Discovery", path: "/discovery", headerText: "Discovery Engine" },
  { name: "Topology", path: "/topology", headerText: "Network Topology" },
  { name: "Monitoring", path: "/monitoring", headerText: "Active Network Monitoring" },
  { name: "Routers", path: "/routers", headerText: "Router Intelligence" },
  { name: "Activity", path: "/activity", headerText: "DNS Activity & Telemetry" },
  { name: "DNS Intelligence", path: "/dns", headerText: "DNS Activity & Telemetry" },
  { name: "Family Safety", path: "/family-safety", headerText: "Family Safety" },
  { name: "Notifications", path: "/notifications", headerText: "Notification" },
  { name: "Workflows", path: "/workflows", headerText: "Workflow" },
  { name: "Integrations", path: "/integrations", headerText: "Integrations" },
  { name: "Plugins", path: "/plugins", headerText: "Plugin" },
  { name: "Multi-Site", path: "/multisite", headerText: "Multi-Site" },
  { name: "Reports", path: "/reports", headerText: "Compliance" },
  { name: "API / Dev Tools", path: "/api-docs", headerText: "API & Developer" },
  { name: "System Health", path: "/health", headerText: "System Health" },
  { name: "Settings", path: "/settings", headerText: "Settings" },
];

test.describe("Navigation and Layout Verification", () => {
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

    // Mock common endpoints to prevent empty/broken states
    await page.route("**/api/v1/devices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ devices: [], total: 0, page: 1, limit: 50 }),
      });
    });

    await page.route("**/api/v1/discovery**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_running: false, modules_active: ["arp", "icmp"], total_discovered: 0 }),
      });
    });

    await page.route("**/api/v1/monitoring**", async (route) => {
      const url = route.request().url();
      if (url.includes("/speedtest") || url.includes("/websites")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else if (url.includes("/internet")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            wan_ip: "192.168.1.1",
            gateway_latency_ms: 12,
            dns_resolution_ms: 8,
            is_connected: true,
            dns_resolvers: null,
            history_24h: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "healthy", latency_ms: 12, packet_loss: 0 }),
        });
      }
    });

    await page.route("**/api/v1/routers**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/v1/family**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  for (const item of routesToTest) {
    test(`navigates cleanly to ${item.name} (${item.path}) without 404 or layout crash`, async ({ page }) => {
      const response = await page.goto(item.path);
      expect(response?.status()).toBe(200);

      // Verify Shell is rendered
      await expect(page.locator("aside").first()).toBeVisible();
      await expect(page.locator("main").first()).toBeVisible();

      // Verify header / title contains expected text
      await expect(page.locator("h1, h2, main").first()).toContainText(item.headerText);
    });
  }
});
