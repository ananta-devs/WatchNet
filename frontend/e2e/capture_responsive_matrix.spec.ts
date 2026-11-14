import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Full Responsive UI Viewport Matrix Capture & Layout Verification", () => {
  const baseOutDir = path.resolve(__dirname, "../../docs/testing/manual/responsive");

  const viewportMatrix = [
    { category: "mobile", width: 320, height: 640, label: "320px" },
    { category: "mobile", width: 360, height: 800, label: "360px" },
    { category: "mobile", width: 375, height: 812, label: "375px" },
    { category: "mobile", width: 390, height: 844, label: "390px" },
    { category: "mobile", width: 414, height: 896, label: "414px" },
    { category: "tablet", width: 640, height: 960, label: "640px" },
    { category: "tablet", width: 768, height: 1024, label: "768px" },
    { category: "tablet", width: 1024, height: 768, label: "1024px" },
    { category: "desktop", width: 1280, height: 720, label: "1280px" },
    { category: "desktop", width: 1366, height: 768, label: "1366px" },
    { category: "desktop", width: 1920, height: 1080, label: "1920px" },
    { category: "ultrawide", width: 2560, height: 1440, label: "2560px" },
  ];

  const primaryRoutes = [
    { name: "login", path: "/login" },
    { name: "dashboard", path: "/dashboard" },
    { name: "devices", path: "/devices" },
    { name: "topology", path: "/topology" },
    { name: "monitoring", path: "/monitoring" },
    { name: "routers", path: "/routers" },
  ];

  test.beforeAll(() => {
    // Create folders
    for (const vp of viewportMatrix) {
      const dir = path.join(baseOutDir, vp.category, vp.label);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    // Intercept common APIs to ensure clean, consistent data
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
          timestamp: new Date().toISOString(),
          wan_ip: "203.0.113.1",
          gateway_latency_ms: 4.2,
          dns_resolution_ms: 12.8,
          is_connected: true,
          dns_resolvers: { "1.1.1.1": 11.2, "8.8.8.8": 14.5 },
          history_24h: [],
        }),
      });
    });

    await page.route("**/api/v1/monitoring/speedtest/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            timestamp: new Date().toISOString(),
            download_mbps: 342.5,
            upload_mbps: 58.2,
            ping_ms: 12,
            jitter_ms: 1.8,
            server_name: "Cloudflare Edge",
          },
        ]),
      });
    });

    await page.route("**/api/v1/monitoring/websites**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "site-1",
            url: "https://enterprise.watchnet.internal",
            name: "Corporate Intranet",
            check_interval_sec: 60,
            is_active: true,
            last_status_code: 200,
            last_latency_ms: 28,
            ssl_days_remaining: 85,
            is_up: true,
            uptime_percentage: 99.98,
          },
        ]),
      });
    });

    await page.route("**/api/v1/topology**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: {
            total_nodes: 4,
            total_edges: 3,
            devices_count: 2,
            infra_count: 2,
          },
          nodes: [
            { id: "wan", label: "Internet WAN", type: "wan", level: 0, ip: "203.0.113.1" },
            { id: "gw", label: "Core Gateway", type: "gateway", level: 1, ip: "192.168.1.1" },
            { id: "dev-01", label: "Gateway Router", type: "device", category: "Network", level: 3, ip: "192.168.1.1" },
            { id: "dev-02", label: "Primary DNS", type: "device", category: "Server", level: 3, ip: "192.168.1.15" },
          ],
          edges: [
            { id: "e1", source: "wan", target: "gw" },
            { id: "e2", source: "gw", target: "dev-01" },
            { id: "e3", source: "gw", target: "dev-02" },
          ],
        }),
      });
    });

    await page.route("**/api/v1/routers**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "r1",
            name: "Main OpenWrt Router",
            vendor: "OpenWrt",
            integration_level: "full_api",
            model: "x86-64 Custom",
            firmware: "OpenWrt 23.05.2",
            host: "192.168.1.1",
            port: 80,
            username: "root",
            is_active: true,
            last_connected_at: new Date().toISOString(),
            client_count: 14,
          },
        ]),
      });
    });

    await page.route("**/api/v1/family/profiles**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "prof-1",
            name: "Alex",
            role: "Child",
            avatar: "default",
            is_paused: false,
            pause_until: null,
            devices: [],
            policies: [],
            schedules: [],
          },
        ]),
      });
    });
  });

  test("Capture full viewport matrix and verify zero horizontal overflow", async ({ page }) => {
    test.setTimeout(180000);

    for (const vp of viewportMatrix) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const dir = path.join(baseOutDir, vp.category, vp.label);

      for (const r of primaryRoutes) {
        await page.goto(r.path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(150);

        // Verify zero unintended horizontal overflow on body/window
        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 2;
        });
        expect(hasHorizontalOverflow).toBe(false);

        // Capture screenshot
        await page.screenshot({
          path: path.join(dir, `${r.name}.png`),
          fullPage: false,
        });
      }

      // If mobile, test drawer open/close behavior
      if (vp.category === "mobile") {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const menuBtn = page.locator('button[aria-label="Toggle navigation menu"]');
        if (await menuBtn.isVisible()) {
          await menuBtn.click();
          await page.waitForTimeout(200);

          // Drawer should be open
          const drawer = page.locator('aside[aria-label="Mobile Navigation"], aside.relative');
          await expect(drawer.first()).toBeVisible();

          // Capture drawer open
          await page.screenshot({
            path: path.join(dir, "mobile_drawer_open.png"),
            fullPage: false,
          });

          // Close drawer
          const closeBtn = page.locator('button[aria-label="Close navigation menu"]');
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(150);
          }
        }
      }
    }
  });
});
