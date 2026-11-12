import { test, expect } from "@playwright/test";

test.describe("Authentication Module", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept auth API endpoints
    await page.route("**/api/v1/auth/me", async (route) => {
      // default: not logged in unless cookie or header set
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });
  });

  test("rejects invalid password and shows error alert", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid credentials" }),
      });
    });

    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("WATCHNET");

    await page.fill('input[type="text"]', "admin");
    await page.fill('input[type="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    const alert = page.locator(".text-rose-400");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Invalid username/email or password.");
  });

  test("login with valid credentials, session persistence, and logout flow", async ({ page }) => {
    let isAuthenticated = false;

    await page.route("**/api/v1/auth/login", async (route) => {
      isAuthenticated = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "mock-jwt-token", token_type: "bearer" }),
      });
    });

    await page.route("**/api/v1/auth/me", async (route) => {
      if (isAuthenticated) {
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
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Not authenticated" }),
        });
      }
    });

    await page.route("**/api/v1/auth/logout", async (route) => {
      isAuthenticated = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Successfully logged out" }),
      });
    });

    // Mock dashboard metrics
    await page.route("**/api/v1/system/overview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          active_devices: 42,
          offline_devices: 5,
          total_alerts: 0,
          system_status: "Healthy",
        }),
      });
    });

    await page.goto("/login");
    await page.fill('input[type="text"]', "admin");
    await page.fill('input[type="password"]', "CorrectAdminPassword123!");
    await page.click('button[type="submit"]');

    // Should navigate to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.locator("aside")).toContainText("admin");

    // Click logout
    const logoutBtn = page.locator('button[title="Sign Out"]');
    await logoutBtn.click();

    // Navigates back to login
    await expect(page).toHaveURL(/.*login/);
  });
});
