import { describe, expect, it } from 'vitest';

import { scrollRootOf } from './scroll-root';

describe('scrollRootOf', () => {
  it('finds the element the page scrolls in, or none outside the app frame', () => {
    document.body.innerHTML =
      '<div data-scroll-root><ul><li id="sentinel"></li></ul></div><p id="loose"></p>';
    expect(scrollRootOf(document.getElementById('sentinel')!)).toBe(
      document.querySelector('[data-scroll-root]'),
    );
    expect(scrollRootOf(document.getElementById('loose')!)).toBeNull();
  });
});
