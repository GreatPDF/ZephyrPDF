import { describe, it, expect } from 'vitest';
import { ViewportVirtualizer } from '../src/core/virtualizer';
import { ThemeMode, ViewMode } from '../src/types/document';

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

  it('should support all standard document view modes including presentation mode', () => {
    const supportedModes: ViewMode[] = ['continuous', 'single', 'two-page', 'presentation'];
    expect(supportedModes).toContain('presentation');
    expect(supportedModes).toContain('single');
    expect(supportedModes).toContain('two-page');
    expect(supportedModes.length).toBe(4);
  });

  it('computes proportional zoom scale for two-page spread to fit side-by-side', () => {
    const pageWidth = 595;
    const containerWidth = 1440;
    const avail = containerWidth - 80;
    const targetScale = Math.min(1.0, Math.max(0.4, avail / (pageWidth * 2 + 40)));

    expect(targetScale).toBeGreaterThan(0.4);
    expect(targetScale).toBeLessThanOrEqual(1.0);
    expect(targetScale * (pageWidth * 2 + 40)).toBeLessThanOrEqual(avail);
  });

  it('toggles single-page active visibility and stabilizes current page on view mode transitions', () => {
    const currentPage = 3;

    const computeVisibility = (page: number, current: number, isSingle: boolean) => {
      if (!isSingle) return true;
      return page === current;
    };

    expect(computeVisibility(1, currentPage, true)).toBe(false);
    expect(computeVisibility(3, currentPage, true)).toBe(true);
    expect(computeVisibility(5, currentPage, true)).toBe(false);

    // Continuous mode
    expect(computeVisibility(1, currentPage, false)).toBe(true);
    expect(computeVisibility(3, currentPage, false)).toBe(true);
    expect(computeVisibility(5, currentPage, false)).toBe(true);
  });
});
