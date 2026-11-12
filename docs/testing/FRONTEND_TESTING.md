# WatchNet Frontend Testing Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Standard  
**Frameworks:** Vitest, React Testing Library, Mock Service Worker (MSW), TypeScript  
**Applicability:** Next.js App Router, shadcn/ui components, Zustand Stores, TanStack Query  

---

## 1. Architectural Scope & Testing Boundaries

The WatchNet frontend testing suite ensures visual correctness, state management consistency, and user accessibility across all viewports:
1. **Component Unit Tests:** Isolated rendering of atomic UI elements (status badges, signal meters, heatmap blocks, modals) using React Testing Library.
2. **Page & Route Integration Tests:** Testing Next.js client and server component flows with Mock Service Worker (MSW) mocking API responses.
3. **Accessibility (a11y) Conformance:** Automated axe-core auditing to ensure WCAG 2.1 AA compliance for color contrast, ARIA landmarks, and keyboard navigation.

```mermaid
flowchart LR
    A[Component Code / Hook] --> B[Vitest Test Runner]
    B --> C[React Testing Library (JSDOM)]
    C --> D[Mock Service Worker (Network Interception)]
    C --> E[jest-axe (Accessibility Rules)]
    B --> F{Coverage & Spec Match}
    F -->|Pass| G[Green Build / Pre-commit]
```

---

## 2. Test Suite Organization

```
apps/web/
├── __tests__/
│   ├── setup.ts               # MSW server lifecycle, matchers, JSDOM mocks
│   ├── components/
│   │   ├── DeviceTable.test.tsx    # Sorting, filtering, batch selection
│   │   ├── Heatmap24h.test.tsx     # 24-slot hourly presence visualization
│   │   ├── SignalMeter.test.tsx    # RSSI dBm color threshold rendering
│   │   └── ParentalPolicyModal.test.tsx # Schedule picker & category toggles
│   ├── hooks/
│   │   ├── useDevices.test.ts      # TanStack query caching & invalidation
│   │   └── useSSELiveEvents.test.ts # Reconnect logic & optimistic state updates
│   └── mocks/
│       ├── handlers.ts             # REST route mock handlers
│       └── mockData.ts             # Realistic device inventories & topology nodes
```

---

## 3. Reference Component Test (Vitest + RTL)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DeviceTableRow } from '@/components/devices/DeviceTableRow';

const mockDevice = {
  id: 'dev_01hw8v3m4q2',
  custom_name: 'Living Room Apple TV',
  ip_address: '192.168.1.120',
  mac_address: '00:11:22:33:44:55',
  is_online: true,
  is_name_locked: true,
};

describe('DeviceTableRow Component', () => {
  it('renders online status indicator and device name', () => {
    render(<DeviceTableRow device={mockDevice} onSelect={vi.fn()} />);

    expect(screen.getByText('Living Room Apple TV')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.120')).toBeInTheDocument();
    
    // Check lock icon rendered
    const lockIcon = screen.getByLabelText(/name locked/i);
    expect(lockIcon).toBeInTheDocument();

    // Check online badge state
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-online', 'true');
  });

  it('triggers onSelect callback when checkbox clicked', () => {
    const handleSelect = vi.fn();
    render(<DeviceTableRow device={mockDevice} onSelect={handleSelect} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(handleSelect).toHaveBeenCalledWith(mockDevice.id, true);
  });
});
```

---

## 4. Test Execution & Coverage Targets

```bash
# Execute unit and component integration tests with coverage
pnpm --filter @watchnet/web test:coverage
```
- **Line Coverage Target:** >80% on core components and utility libraries.
- **Critical Path Requirement:** Zero console error warnings permitted during render passes.
