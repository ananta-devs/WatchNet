import { test, expect } from "@playwright/test";

test.describe("Workflows and Notifications", () => {
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

    await page.route("**/api/v1/notifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "notif-1",
            title: "New Device Connected",
            body: "Raspberry Pi detected on eth0",
            severity: "info",
            created_at: "2026-11-12T12:00:00Z",
            read: false,
          },
        ]),
      });
    });

    await page.route("**/api/v1/workflows**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "wf-1",
            name: "Unknown Device Alert to Discord",
            trigger: "device_discovered",
            action: "send_discord",
            enabled: true,
          },
        ]),
      });
    });
  });

  test("renders notification inbox and channel list", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.locator("body")).toContainText("Notification");
  });

  test("renders workflow rules and trigger configurations", async ({ page }) => {
    await page.goto("/workflows");
    await expect(page.locator("body")).toContainText("Workflow");
  });
});
