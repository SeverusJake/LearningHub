# Floating Mission Pager Design

## Goal

Add a compact Previous/Next control to the top-right of mission reader pages. It remains fixed while the reader scrolls and disappears when the existing bottom pager enters the viewport.

## Behavior

- Show the fixed control only for mission readers with at least one adjacent mission.
- Keep the existing bottom Previous/Next pager unchanged.
- Use the left and right chevrons to open the previous and next missions.
- Disable the unavailable direction at the first or last mission.
- Show the current track, mission number, and ordered position in the center: `SysOps 03 · 3/50`.
- Reset scroll to the top after adjacent navigation, preserving current reader behavior.
- Hide the fixed control while the bottom pager is visible. Show it again if the user scrolls away from the bottom pager.

## Layout and Style

- Position the control below the sticky application header, aligned to the viewport's right edge with responsive spacing.
- Match the reference: one compact horizontal rectangular surface, left arrow, centered context, right arrow.
- Reuse project tokens (`bg-s1`, `border-bord`, `text-tp`, `text-tm`) and existing shadow variables.
- Keep corners square, motion limited to a short opacity transition, and avoid gradients, glass effects, decorative copy, or transform animations.
- Give both arrow buttons explicit accessible labels and native disabled states.

## Architecture

- `App.jsx` passes the current mission index and total mission count into `Reader`.
- `Reader.jsx` observes the existing bottom pager with `IntersectionObserver` and owns the visibility state for the fixed control.
- The fixed control renders into `document.body` with a React portal so the reader's entrance transform cannot become its fixed-position containing block.
- A small pure helper defines the visibility rule so it can be verified with Node's built-in test runner without adding a test framework.

## Verification

- Unit tests cover visible, hidden-at-bottom, and no-adjacent-item states.
- Production build verifies React and Tailwind compilation.
- Browser checks verify fixed positioning, navigation, disabled boundary arrows, responsive placement, and hiding when the bottom pager becomes visible.
