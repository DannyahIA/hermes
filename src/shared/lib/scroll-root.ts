/** The element the app's content scrolls in, or null outside the app frame. */
export function scrollRootOf(node: Element): Element | null {
  return node.closest('[data-scroll-root]');
}
