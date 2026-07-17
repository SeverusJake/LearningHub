# Floating Mission Pager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed top-right Previous/Next mission control that hides when the existing bottom pager enters view.

**Architecture:** `App` supplies ordered-position metadata. `Reader` watches its bottom pager with `IntersectionObserver`, uses a tested pure visibility policy, and portals a compact fixed control to `document.body` so the reader entrance transform cannot offset it.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Lucide React, Node built-in test runner

## Global Constraints

- Show the fixed control only for mission readers with at least one adjacent mission.
- Keep the existing bottom Previous/Next pager unchanged.
- Disable unavailable directions at list boundaries.
- Hide the fixed control while the bottom pager is visible.
- Reuse existing project colors and shadows; no gradients, glass effects, pills, decorative copy, or transform animations.
- Preserve the user's unrelated `Atelier.bat` modification.

---

### Task 1: Tested visibility policy

**Files:**
- Create: `dashboard/src/lib/floatingPager.js`
- Create: `dashboard/test/floatingPager.test.js`
- Modify: `dashboard/package.json`

**Interfaces:**
- Consumes: `{ isMission: boolean, hasAdjacent: boolean, bottomPagerVisible: boolean }`
- Produces: `shouldShowFloatingPager(state): boolean`

- [ ] **Step 1: Add the test command and failing policy tests**

```json
"test": "node --test"
```

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowFloatingPager } from '../src/lib/floatingPager.js';

test('shows for a mission with an adjacent item away from the bottom pager', () => {
  assert.equal(shouldShowFloatingPager({ isMission: true, hasAdjacent: true, bottomPagerVisible: false }), true);
});

test('hides when the bottom pager is visible', () => {
  assert.equal(shouldShowFloatingPager({ isMission: true, hasAdjacent: true, bottomPagerVisible: true }), false);
});

test('hides for references and missions without adjacent items', () => {
  assert.equal(shouldShowFloatingPager({ isMission: false, hasAdjacent: true, bottomPagerVisible: false }), false);
  assert.equal(shouldShowFloatingPager({ isMission: true, hasAdjacent: false, bottomPagerVisible: false }), false);
});
```

- [ ] **Step 2: Run tests and confirm the missing-module failure**

Run: `cd dashboard && npm test`

Expected: FAIL because `src/lib/floatingPager.js` does not exist.

- [ ] **Step 3: Add the minimal policy implementation**

```js
export function shouldShowFloatingPager({ isMission, hasAdjacent, bottomPagerVisible }) {
  return isMission && hasAdjacent && !bottomPagerVisible;
}
```

- [ ] **Step 4: Run tests and confirm green**

Run: `cd dashboard && npm test`

Expected: 3 passing tests, 0 failures.

### Task 2: Fixed mission control and bottom-pager observation

**Files:**
- Modify: `dashboard/src/App.jsx`
- Modify: `dashboard/src/components/Reader.jsx`

**Interfaces:**
- Consumes: `itemIndex`, `itemCount`, `prevItem`, `nextItem`, `onOpenItem`
- Produces: fixed mission navigation with observed bottom-pager visibility

- [ ] **Step 1: Pass ordered-position metadata from `App`**

```jsx
<Reader
  key={`${reader.kind}:${reader.id}`}
  item={readerItem}
  kind={reader.kind}
  initialTab={reader.tab}
  onBack={() => setReader(null)}
  prevItem={prevItem}
  nextItem={nextItem}
  itemIndex={readerIndex}
  itemCount={readerList.length}
  onOpenItem={openAdjacent}
/>
```

- [ ] **Step 2: Observe the bottom pager in `Reader`**

```jsx
const bottomPagerRef = useRef(null);
const [bottomPagerVisible, setBottomPagerVisible] = useState(false);

useEffect(() => {
  const bottomPager = bottomPagerRef.current;
  if (!bottomPager || typeof IntersectionObserver === 'undefined') return undefined;

  const observer = new IntersectionObserver(
    ([entry]) => setBottomPagerVisible(entry.isIntersecting),
    { threshold: 0.05 },
  );
  observer.observe(bottomPager);
  return () => observer.disconnect();
}, [item.id]);
```

Attach `ref={bottomPagerRef}` to the existing bottom `<nav>`.

- [ ] **Step 3: Render the fixed control**

Import `createPortal` from `react-dom` and portal the fixed element to `document.body`.

```jsx
const hasAdjacent = Boolean(prevItem || nextItem);
const showFloatingPager = shouldShowFloatingPager({
  isMission,
  hasAdjacent,
  bottomPagerVisible,
});

{isMission && hasAdjacent && typeof document !== 'undefined' &&
  createPortal(
    <nav
    aria-label="Mission navigation"
    className={`fixed right-4 top-[76px] z-20 flex h-11 w-[220px] items-stretch border border-bord bg-s1 transition-opacity duration-150 md:right-8 ${
      showFloatingPager ? 'opacity-100' : 'pointer-events-none opacity-0'
    }`}
    style={{ boxShadow: 'var(--card-shadow)' }}
  >
    <button
      type="button"
      onClick={() => onOpenItem(prevItem)}
      disabled={!prevItem}
      aria-label={prevItem ? `Previous mission: ${prevItem.title}` : 'No previous mission'}
      className="grid w-11 place-items-center border-r border-bord text-tm hover:bg-s2 hover:text-tp disabled:cursor-default disabled:opacity-30"
    >
      <ChevronLeft size={17} />
    </button>
    <span className="mono flex min-w-0 flex-1 items-center justify-center truncate px-2 text-[11px] font-semibold text-tp">
      {item.trackLabel} {item.num}
      <span className="ml-1.5 text-tm">· {itemIndex + 1}/{itemCount}</span>
    </span>
    <button
      type="button"
      onClick={() => onOpenItem(nextItem)}
      disabled={!nextItem}
      aria-label={nextItem ? `Next mission: ${nextItem.title}` : 'No next mission'}
      className="grid w-11 place-items-center border-l border-bord text-tm hover:bg-s2 hover:text-tp disabled:cursor-default disabled:opacity-30"
    >
      <ChevronRight size={17} />
    </button>
    </nav>,
    document.body,
  )}
```

- [ ] **Step 4: Run automated verification**

Run: `cd dashboard && npm test && npm run build`

Expected: 3 passing tests and Vite build exit code 0.

- [ ] **Step 5: Verify in browser**

Start: `cd dashboard && npm run dev -- --host 127.0.0.1`

Check desktop and mobile widths. Confirm fixed placement, both navigation directions, disabled first/last arrows, scroll reset, and fixed-control hiding when the bottom pager enters view.
