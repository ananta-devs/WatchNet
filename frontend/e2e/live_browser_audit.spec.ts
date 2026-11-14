import { test, expect } from "@playwright/test";

const routes = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Devices", path: "/devices" },
  { name: "Discovery", path: "/discovery" },
  { name: "Topology", path: "/topology" },
  { name: "Monitoring", path: "/monitoring" },
  { name: "Wallboard", path: "/monitoring/wallboard" },
  { name: "Routers", path: "/routers" },
  { name: "Activity", path: "/activity" },
  { name: "DNS Intelligence", path: "/dns" },
  { name: "Family Safety", path: "/family-safety" },
  { name: "Notifications", path: "/notifications" },
  { name: "Workflows", path: "/workflows" },
  { name: "Integrations", path: "/integrations" },
  { name: "Plugins", path: "/plugins" },
  { name: "Multi-Site", path: "/multisite" },
  { name: "Reports", path: "/reports" },
  { name: "API Docs", path: "/api-docs" },
  { name: "System Health", path: "/health" },
  { name: "Settings", path: "/settings" },
];

test.describe("Live Interactive Chrome Crawl & Browser Console Audit", () => {
  test.setTimeout(180000);

  test("authenticate and audit all routes and buttons with zero console errors", async ({ page }) => {
    const consoleErrors: Array<{ type: string; text: string; location?: string }> = [];
    const pageErrors: Array<{ message: string; stack?: string }> = [];
    const failedNetworkRequests: Array<{ url: string; status: number; method: string }> = [];

    // Step 1: Login
    console.log("Navigating to login page...");
    await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });

    // Fill credentials
    const usernameInput = page.locator('input[type="text"]');
    const passwordInput = page.locator('input[type="password"]');
    await usernameInput.fill("admin");
    await passwordInput.fill("admin123");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    console.log("Successfully logged in as admin!");

    // Also store token in localStorage if it was returned so components reading from localStorage get it
    const cookies = await page.context().cookies();
    console.log(`Received cookies: ${cookies.map((c) => c.name).join(", ")}`);

    // Attach listeners for errors after login to audit authenticated page navigation & interaction
    page.on("dialog", async (dialog) => {
      console.log(`  [Dialog] ${dialog.type()}: ${dialog.message()}`);
      await dialog.accept().catch(() => {});
    });

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      // Track actual errors or unhandled promise rejections
      if (type === "error") {
        consoleErrors.push({
          type,
          text,
          location: `${msg.location().url}:${msg.location().lineNumber}`,
        });
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    page.on("response", (res) => {
      const status = res.status();
      const url = res.url();
      // Ignore favicon or analytics 404s if any, but capture any 4xx/5xx API calls
      if (status >= 400 && url.includes("/api/")) {
        failedNetworkRequests.push({
          url,
          status,
          method: res.request().method(),
        });
      }
    });

    // Step 2: Visit every route, click interactive buttons, check console
    for (const route of routes) {
      console.log(`\n--- Auditing route: ${route.name} (${route.path}) ---`);
      await page.goto(`http://127.0.0.1:3000${route.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500); // Allow dynamic fetches to complete

      // Query elements snapshot once to avoid shifting indexes
      const buttonHandles = await page.$$("main button:visible");
      console.log(`Found ${buttonHandles.length} visible main buttons on ${route.path}`);

      // Click each clickable button safely
      for (let i = 0; i < buttonHandles.length; i++) {
        const btn = buttonHandles[i];
        const label = await btn.evaluate((el) => {
          return (el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
        }).catch(() => "");
        const buttonName = label || `Button #${i + 1}`;

        // Don't click dangerous destructive buttons like "Logout", "Delete Site", "Wipe Database"
        if (
          buttonName.toLowerCase().includes("logout") ||
          buttonName.toLowerCase().includes("sign out") ||
          buttonName.toLowerCase().includes("delete") ||
          buttonName.toLowerCase().includes("wipe") ||
          buttonName.toLowerCase().includes("remove")
        ) {
          console.log(`  Skipping destructive/logout button: [${buttonName}]`);
          continue;
        }

        try {
          const isInteractable = await btn.evaluate((el: any) => {
            return !el.disabled && el.offsetParent !== null;
          }).catch(() => false);

          if (isInteractable) {
            console.log(`  Clicking button: [${buttonName}]`);
            await btn.evaluate((el: any) => el.click()).catch(() => {});
            await page.waitForTimeout(80);

            // If a dialog/modal popped up, close it if there is a close or cancel button
            const closeBtn = await page.$('button[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")');
            if (closeBtn) {
              await closeBtn.evaluate((el: any) => el.click()).catch(() => {});
              await page.waitForTimeout(80);
            }
          }
        } catch (e: any) {
          console.log(`  Could not click button [${buttonName}]: ${e.message}`);
        }
      }

      await page.waitForTimeout(200);
    }

    // Report all captured issues
    console.log("\n================ AUDIT SUMMARY ================");
    console.log(`Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log("Console Errors found:", JSON.stringify(consoleErrors, null, 2));
    }

    console.log(`Page Unhandled Errors: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.log("Page Errors found:", JSON.stringify(pageErrors, null, 2));
    }

    console.log(`Failed API Requests (4xx/5xx): ${failedNetworkRequests.length}`);
    if (failedNetworkRequests.length > 0) {
      console.log("Failed API Requests:", JSON.stringify(failedNetworkRequests, null, 2));
    }
    console.log("===============================================\n");

    // Assert that no errors occurred
    expect(pageErrors, `Unhandled page errors encountered: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `Browser console errors encountered: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(failedNetworkRequests, `API errors encountered: ${JSON.stringify(failedNetworkRequests)}`).toEqual([]);
  });
});
