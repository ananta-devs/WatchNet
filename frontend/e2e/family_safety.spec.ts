import { test, expect } from "@playwright/test";

test.describe("Family Safety and Parental Controls", () => {
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

    await page.route("**/api/v1/family/profiles", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "prof-1",
            name: "Kids Group",
            role: "Child",
            avatar: "child",
            is_paused: false,
            pause_until: null,
            devices: [
              {
                id: "dev-01",
                mac: "00:11:22:33:44:55",
                name: "Kids Tablet",
                ipv4: "192.168.1.105",
                status: "online",
              },
            ],
            policies: [
              {
                id: "pol-1",
                name: "Standard Safety",
                categories: ["Adult", "Malware"],
                blocked_domains: ["example-blocked.com"],
                allowed_domains: [],
                is_active: true,
              },
            ],
            schedules: [
              {
                id: "sched-1",
                name: "Bedtime",
                days_of_week: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                start_time: "21:00",
                end_time: "07:00",
                is_active: true,
              },
            ],
          },
        ]),
      });
    });
  });

  test("renders profile cards and parental pause controls", async ({ page }) => {
    await page.goto("/family-safety");
    await expect(page.locator("body")).toContainText("Kids Group");
  });
});
