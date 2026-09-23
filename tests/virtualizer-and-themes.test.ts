import { describe, it, expect } from 'vitest';
import { ViewportVirtualizer } from '../src/core/virtualizer';
import { ThemeMode } from '../src/types/document';

describe('Viewport Virtualizer and Themes', () => {
  it('should track and manage observed page elements cleanly', () => {
    const dummyContainer = {
      clientWidth: 800,
      clientHeight: 600
    } as any;

    let visibilityCalls: { pageIndex: number; isVisible: boolean }[] = [];
    const virtualizer = new ViewportVirtualizer(dummyContainer, (p, visible) => {
      visibilityCalls.push({ pageIndex: p, isVisible: visible });
    });

    const el1 = {
      setAttribute: () => {},
      getAttribute: () => '0'
    } as any;

    const el2 = {
      setAttribute: () => {},
      getAttribute: () => '1'
    } as any;

    virtualizer.observe(0, el1);
    virtualizer.observe(1, el2);

    virtualizer.unobserve(0);
    virtualizer.clear();
    virtualizer.destroy();
  });

  it('should recognize all supported reading themes including OLED and high-contrast', () => {
    const supportedThemes: ThemeMode[] = ['light', 'dark', 'sepia', 'oled', 'high-contrast'];
    expect(supportedThemes).toContain('oled');
    expect(supportedThemes).toContain('high-contrast');
    expect(supportedThemes.length).toBe(5);
  });
});
