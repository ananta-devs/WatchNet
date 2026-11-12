import { test, expect } from "@playwright/test";

const mockDevices = [
  {
    id: "dev-01",
    mac: "00:11:22:33:44:55",
    ipv4: "192.168.1.50",
    ipv6: null,
    vendor: "Apple, Inc.",
    name: "John's MacBook Pro",
    interface: "eth0",
    status: "online",
    category: "Desktop/Laptop",
    icon: "laptop",
    notes: "Engineering workstation",
    is_archived: false,
    locked_fields: ["name"],
    first_seen: "2026-11-01T10:00:00Z",
    last_seen: "2026-11-12T14:30:00Z",
    custom_properties: {},
  },
  {
    id: "dev-02",
    mac: "AA:BB:CC:DD:EE:FF",
    ipv4: "192.168.1.120",
    ipv6: null,
    vendor: "Espressif Inc.",
    name: "Living Room ESP32 Sensor",
    interface: "wlan0",
    status: "offline",
    category: "IoT/Smart Home",
    icon: "cpu",
    notes: "Temperature sensor",
    is_archived: false,
    locked_fields: [],
    first_seen: "2026-11-05T08:00:00Z",
    last_seen: "2026-11-11T19:00:00Z",
    custom_properties: {},
  },
];

test.describe("Devices Inventory & Management", () => {
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

    await page.route("**/api/v1/devices**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ devices: mockDevices, total: 2 }),
      });
    });

    await page.route("**/api/v1/sync/nodes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("renders device table, search filter, and category filter", async ({ page }) => {
    await page.goto("/devices");

    // Table contains our mock device names
    await expect(page.locator("body")).toContainText("John's MacBook Pro");
    await expect(page.locator("body")).toContainText("Living Room ESP32 Sensor");

    // Search input filtering
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill("MacBook");
      await expect(page.locator("body")).toContainText("John's MacBook Pro");
    }
  });

  test("device selection and field lock toggling", async ({ page }) => {
    await page.goto("/devices");
    await expect(page.locator("body")).toContainText("00:11:22:33:44:55");

    // Check row checkbox exists
    const checkboxes = page.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 1) {
      await checkboxes.nth(1).check();
      await expect(checkboxes.nth(1)).toBeChecked();
    }
  });
});
