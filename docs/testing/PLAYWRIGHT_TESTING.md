# WatchNet Playwright E2E Testing Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Framework:** Playwright (Chromium, Firefox, WebKit)  
**Scope:** Complete User Journeys, Live SSE Events, Responsive Viewports  

---

## 1. Architectural Scope & Objectives

Playwright drives full end-to-end (E2E) browser validation against a running WatchNet stack (Next.js, FastAPI, PostgreSQL, Redis):
1. **Critical User Workflows:** Login -> Device Discovery Sweep -> Attribute Locking -> Parental Profile Creation -> Notification Dispatch.
2. **Real-Time SSE Updates:** Verify that when a collector ingests a new device, the browser DOM dynamically appends the new table row without manual page refresh.
3. **Cross-Browser & Mobile Viewports:** Test responsive rendering across Desktop (1920x1080), Tablet (iPad Air), and Mobile (iPhone 14 Pro).

```mermaid
flowchart TD
    P[Playwright Test Runner] -->|Chromium / WebKit / Firefox| B[Browser Session]
    B -->|HTTP/SSE| WEB[Next.js App Server (Port 3000)]
    WEB -->|REST API| API[FastAPI Backend (Port 8000)]
    API --> DB[(PostgreSQL 16)]
    P -->|Trigger Mock Network Event| API
    API -->|SSE Event Stream| B
    P -->|Assert DOM Mutation| B
```

---

## 2. Test Suite Layout

```
tests/e2e/
├── playwright.config.ts        # Base URL, browser matrix, screenshot on failure
├── fixtures/
│   ├── auth.fixture.ts         # Pre-authenticated storage states (admin & viewer)
│   └── seed.fixture.ts         # Database reset and deterministic test data seeds
├── specs/
│   ├── 01_auth.spec.ts         # Login form, token refresh, invalid credentials
│   ├── 02_devices.spec.ts      # Device search, filtering, lock name, bulk tags
│   ├── 03_presence.spec.ts     # 24h heatmap rendering, datepicker navigation
│   ├── 04_parental.spec.ts     # Profile creation, domain blacklist, bedtime toggles
│   ├── 05_diagnostics.spec.ts  # Ping/Traceroute console execution
│   └── 06_realtime_sse.spec.ts # Live device detection DOM append test
```

---

## 3. Reference Playwright E2E Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Real-Time Device Discovery Flow', () => {
  test('dynamically renders newly discovered device via SSE', async ({ page, request }) => {
    // 1. Navigate to Devices view as authenticated admin
    await page.goto('/devices');
    await expect(page.locator('h1')).toContainText('Network Devices');

    const initialCount = await page.locator('table tbody tr').count();

    // 2. Simulate background collector ingesting a new rogue device
    const newMac = 'aa:bb:cc:11:22:99';
    const sweepPayload = {
      observations: [{
        mac_address: newMac,
        ip_address: '192.168.1.188',
        hostname: 'test-smart-speaker',
        vendor: 'Amazon Technologies Inc.'
      }]
    };

    const ingestResponse = await request.post('http://localhost:8000/api/v1/discovery/ingest', {
      data: sweepPayload,
      headers: { 'Authorization': 'Bearer test-admin-token' }
    });
    expect(ingestResponse.status()).toBe(202);

    // 3. Assert row appears in UI within 3 seconds via SSE without page reload
    const newRow = page.locator(`tr:has-text("${newMac}")`);
    await expect(newRow).toBeVisible({ timeout: 4000 });
    await expect(newRow).toContainText('test-smart-speaker');
    await expect(page.locator('table tbody tr')).toHaveCount(initialCount + 1);
  });
});
```

---

## 4. Execution & Artifact Capture

```bash
# Run headless in CI with video and trace capture on failure
npx playwright test --config=playwright.config.ts --reporter=html
```
- **Failure Artifacts:** Automatic high-resolution screenshot and Playwright Trace Viewer zip recorded on test failures in `test-results/`.
