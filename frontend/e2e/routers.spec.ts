import { test, expect } from "@playwright/test";

test.describe("Routers and Network Gateways Module", () => {
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
        body: JSON.stringify([
          {
            mac: "00:11:22:33:44:55",
            ip: "192.168.1.50",
            hostname: "MacBook",
            connection_type: "wifi",
            band: "5GHz",
            rssi: -55,
          },
        ]),
      });
    });
  });

  test("renders router cards and client signal information", async ({ page }) => {
    await page.goto("/routers");
    await expect(page.locator("body")).toContainText("UniFi Dream Machine Pro");
    await expect(page.locator("body")).toContainText("192.168.1.1");
  });
});
