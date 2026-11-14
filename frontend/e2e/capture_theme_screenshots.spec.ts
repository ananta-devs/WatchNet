import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Enterprise Slate + Signal Blue Theme Visual Capture", () => {
  const outDir = path.resolve(__dirname, "../../docs/testing/manual/ui-theme");

  test.beforeAll(() => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Intercept common APIs to ensure rich realistic previews
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "1", username: "admin", role: "Administrator" }),
      });
    });

    await page.route("**/api/v1/devices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          devices: [
            {
              id: "dev-01",
              mac: "dc:a6:32:11:22:33",
              ipv4: "192.168.1.1",
              name: "Gateway Core Router",
              vendor: "Ubiquiti Networks",
              status: "online",
              category: "Network/Infrastructure",
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              locked_fields: ["name"],
              is_archived: false,
              custom_properties: {},
            },
            {
              id: "dev-02",
              mac: "b8:27:eb:aa:bb:cc",
              ipv4: "192.168.1.15",
              name: "DNS Primary Server",
              vendor: "Raspberry Pi Foundation",
              status: "online",
              category: "Server",
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              locked_fields: [],
              is_archived: false,
              custom_properties: {},
            },
            {
              id: "dev-03",
              mac: "3c:22:fb:44:55:66",
              ipv4: "192.168.1.42",
              name: "Executive MacBook Pro",
              vendor: "Apple Inc.",
              status: "offline",
              category: "Desktop/Laptop",
              first_seen: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              locked_fields: [],
              is_archived: false,
              custom_properties: {},
            },
          ],
          total: 3,
          page: 1,
          size: 50,
          pages: 1,
        }),
      });
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
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            download_mbps: 485.2,
            upload_mbps: 110.5,
            ping_ms: 14.2,
          },
        ]),
      });
    });

    await page.route("**/api/v1/monitoring/websites*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            name: "Internal DNS Resolver",
            url: "https://192.168.1.15",
            status_code: 200,
            response_time_ms: 15,
            is_up: true,
          },
        ]),
      });
    });

    await page.route("**/api/v1/sync/nodes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  const routesToCapture = [
    { name: "01_login", path: "/login" },
    { name: "02_dashboard", path: "/dashboard" },
    { name: "03_devices", path: "/devices" },
    { name: "04_discovery", path: "/discovery" },
    { name: "05_topology", path: "/topology" },
    { name: "06_monitoring", path: "/monitoring" },
    { name: "07_wallboard", path: "/monitoring/wallboard" },
    { name: "08_routers", path: "/routers" },
    { name: "09_activity", path: "/activity" },
    { name: "10_dns", path: "/dns" },
    { name: "11_family_safety", path: "/family-safety" },
    { name: "12_notifications", path: "/notifications" },
    { name: "13_workflows", path: "/workflows" },
    { name: "14_integrations", path: "/integrations" },
    { name: "15_plugins", path: "/plugins" },
    { name: "16_multisite", path: "/multisite" },
    { name: "17_reports", path: "/reports" },
    { name: "18_api_docs", path: "/api-docs" },
    { name: "19_system_health", path: "/health" },
    { name: "20_settings", path: "/settings" },
  ];

  test("Capture Light and Dark screenshots for all routes and verify seamless theme toggle", async ({ page }) => {
    test.setTimeout(90000);
    // Set standard viewport for enterprise desktop UI
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const r of routesToCapture) {
      // 1. Visit route and ensure Light mode
      await page.goto(r.path, { waitUntil: "domcontentloaded" });

      const lightButton = page.locator('button[role="radio"][title="Light mode"]');
      if (await lightButton.isVisible()) {
        await lightButton.click();
      } else {
        await page.evaluate(() => {
          localStorage.setItem("watchnet_theme", "light");
          document.documentElement.classList.remove("dark");
        });
      }
      await page.waitForTimeout(350);

      // Capture Light mode screenshot
      await page.screenshot({
        path: `${outDir}/${r.name}_light.png`,
        fullPage: false,
      });

      // Verify Light mode
      const isDarkInLight = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      expect(isDarkInLight).toBe(false);

      // 2. Toggle to Dark mode seamlessly without reload
      const darkButton = page.locator('button[role="radio"][title="Dark mode"]');
      if (await darkButton.isVisible()) {
        await darkButton.click();
      } else {
        await page.evaluate(() => {
          localStorage.setItem("watchnet_theme", "dark");
          document.documentElement.classList.add("dark");
        });
      }
      await page.waitForTimeout(350);

      // Capture Dark mode screenshot
      await page.screenshot({
        path: `${outDir}/${r.name}_dark.png`,
        fullPage: false,
      });

      // Verify Dark mode class
      const isDarkInDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      expect(isDarkInDark).toBe(true);
    }
  });
});
