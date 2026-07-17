# Horizontal Track Filter Design

## Goal

Replace the track filter combobox with a horizontal selector that exposes every track at once.

## Behavior

- Show `All`, `SysOps`, `DevOps`, `Proxmox`, `Money`, and `GameDev` as buttons.
- Keep the selected track state and filtering behavior unchanged.
- Mark the active button with `aria-pressed="true"`.
- Keep the status filters and sort combobox unchanged.
- Allow horizontal scrolling on narrow screens instead of wrapping or collapsing back into a dropdown.

## Layout and Style

- Put the track selector on its own full-width row beneath the status and sort controls.
- Use simple text tabs with a bottom-border active indicator.
- Reuse existing typography, accent, border, and text tokens.
- Avoid pills, gradients, shadows, decorative labels, and transform animations.

## Verification

- Server-render `FilterBar` and assert all six track buttons exist, the active button is pressed, and the old track combobox is absent.
- Run the full Node test suite and production build.
- Check desktop and mobile layouts in the browser and confirm filtering works.
