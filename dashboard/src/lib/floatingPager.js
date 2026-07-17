export function shouldShowFloatingPager({ isMission, hasAdjacent, bottomPagerVisible }) {
  return isMission && hasAdjacent && !bottomPagerVisible;
}
