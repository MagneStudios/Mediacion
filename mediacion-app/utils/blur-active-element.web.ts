/**
 * Web-only: blurs the currently focused DOM element before a screen
 * transition. RN Web can leave focus on the just-pressed button while React
 * Navigation marks the outgoing screen `aria-hidden`, which the browser
 * (correctly) flags — a focused descendant inside an aria-hidden subtree is
 * invalid. Called immediately before navigating away from a small, named
 * set of screens; never wired to a route listener or mount effect.
 */
export function blurActiveElement(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}
