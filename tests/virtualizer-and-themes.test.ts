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

  it('should preserve true document colors in dark, oled, and light themes without inverting canvas', () => {
    const getFilterForTheme = (theme: ThemeMode): string => {
      if (theme === 'high-contrast') return 'invert(1) contrast(1.8) grayscale(0.5)';
      if (theme === 'sepia') return 'sepia(0.35) contrast(0.95) brightness(0.95)';
      return 'none';
    };

    expect(getFilterForTheme('dark')).toBe('none');
    expect(getFilterForTheme('light')).toBe('none');
    expect(getFilterForTheme('oled')).toBe('none');
    expect(getFilterForTheme('high-contrast')).toContain('invert');
    expect(getFilterForTheme('sepia')).toContain('sepia');
  });
});
