import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowFloatingPager } from '../src/lib/floatingPager.js';

test('shows for a mission with an adjacent item away from the bottom pager', () => {
  assert.equal(
    shouldShowFloatingPager({ isMission: true, hasAdjacent: true, bottomPagerVisible: false }),
    true,
  );
});

test('hides when the bottom pager is visible', () => {
  assert.equal(
    shouldShowFloatingPager({ isMission: true, hasAdjacent: true, bottomPagerVisible: true }),
    false,
  );
});

test('hides for references and missions without adjacent items', () => {
  assert.equal(
    shouldShowFloatingPager({ isMission: false, hasAdjacent: true, bottomPagerVisible: false }),
    false,
  );
  assert.equal(
    shouldShowFloatingPager({ isMission: true, hasAdjacent: false, bottomPagerVisible: false }),
    false,
  );
});
