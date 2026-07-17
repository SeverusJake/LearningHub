# Horizontal Track Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the track combobox with a full-width horizontal track selector.

**Architecture:** Keep filtering state in `App` unchanged. `FilterBar` derives one `All` option plus the existing `TRACKS`, renders them as accessible buttons, and keeps the sort control in the utility row.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Node built-in test runner, React server rendering

## Global Constraints

- Show `All`, `SysOps`, `DevOps`, `Proxmox`, `Money`, and `GameDev` at once.
- Keep selected-track behavior and the sort combobox unchanged.
- Use `aria-pressed` for selection state.
- Use an underline active indicator with no pills, gradients, shadows, or transform animations.
- Use horizontal scrolling on narrow screens.
- Preserve the user's unrelated `Atelier.bat` modification.

---

### Task 1: Horizontal track selector

**Files:**
- Create: `dashboard/test/filterBar.test.js`
- Modify: `dashboard/src/components/FilterBar.jsx`

**Interfaces:**
- Consumes: `track: string`, `onTrack(trackId: string)`, and `TRACKS`
- Produces: `nav[aria-label="Track filters"]` containing six `button[data-track]` controls

- [ ] **Step 1: Write the failing server-render test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('renders every track as a horizontal button instead of a combobox', async (t) => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  t.after(() => vite.close());
  const { default: FilterBar } = await vite.ssrLoadModule('/src/components/FilterBar.jsx');

  const markup = renderToStaticMarkup(
    React.createElement(FilterBar, {
      status: 'all',
      onStatus() {},
      track: 'sysops',
      onTrack() {},
      sort: 'track',
      onSort() {},
    }),
  );

  const buttons = [...markup.matchAll(/<button[^>]*data-track="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>([^<]+)<\/button>/g)]
    .map((match) => ({ id: match[1], pressed: match[2], label: match[3] }));

  assert.deepEqual(buttons, [
    { id: 'all', pressed: 'false', label: 'All' },
    { id: 'sysops', pressed: 'true', label: 'SysOps' },
    { id: 'devops', pressed: 'false', label: 'DevOps' },
    { id: 'proxmox', pressed: 'false', label: 'Proxmox' },
    { id: 'money', pressed: 'false', label: 'Money' },
    { id: 'gamedev', pressed: 'false', label: 'GameDev' },
  ]);
  assert.match(markup, /aria-label="Track filters"/);
  assert.doesNotMatch(markup, /aria-label="Filter by track"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd dashboard && node --test test/filterBar.test.js`

Expected: FAIL because the current component renders no `button[data-track]` controls and still contains `aria-label="Filter by track"`.

- [ ] **Step 3: Replace the track combobox with horizontal buttons**

```jsx
import { TRACKS } from '../lib/content.js';

const STATUS_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Not started' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

const SORTS = [
  { id: 'track', label: 'Track order' },
  { id: 'name', label: 'Name' },
  { id: 'difficulty', label: 'Difficulty' },
];

const selectCls =
  'mono border border-bord bg-s1 px-3 py-2 text-[11px] uppercase tracking-[0.05em] text-ts cursor-pointer hover:bg-s2 focus:border-accent focus:outline-none';

const TRACK_FILTERS = [{ id: 'all', label: 'All' }, ...TRACKS];

export default function FilterBar({ status, onStatus, track, onTrack, sort, onSort }) {
  return (
    <div className="mb-7 space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap">
          {STATUS_PILLS.map((p, i) => {
            const active = status === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onStatus(p.id)}
                className={`mono border px-3.5 py-2 text-[11px] uppercase tracking-[0.06em] transition-all duration-200 cursor-pointer ${
                  i > 0 ? '-ml-px' : ''
                } ${
                  active
                    ? 'z-10 border-accent bg-accent text-s1'
                    : 'border-bord bg-transparent text-ts hover:bg-s2 hover:text-tp'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <select value={sort} onChange={(e) => onSort(e.target.value)} className={`${selectCls} ml-auto`} aria-label="Sort missions">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <nav aria-label="Track filters" className="flex overflow-x-auto border-b border-bord">
        {TRACK_FILTERS.map((option) => {
          const active = track === option.id;
          return (
            <button
              key={option.id}
              type="button"
              data-track={option.id}
              aria-pressed={active}
              onClick={() => onTrack(option.id)}
              className={`mono -mb-px flex-none border-b-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.05em] transition-colors duration-150 cursor-pointer ${
                active ? 'border-accent text-tp' : 'border-transparent text-tm hover:text-tp'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and build**

Run: `cd dashboard && npm test && npm run build`

Expected: 4 passing tests, 0 failures, and Vite build exit code 0.

- [ ] **Step 5: Verify in browser**

Start: `cd dashboard && npm run dev -- --host 127.0.0.1`

Check desktop and mobile widths. Confirm all six options remain on one horizontally scrollable row, clicking a track filters mission sections, active state moves, sort remains usable, and no track combobox remains.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/FilterBar.jsx dashboard/test/filterBar.test.js docs/superpowers/plans/2026-07-18-horizontal-track-filter.md
git commit -m "feat(dashboard): show track filters horizontally"
```
