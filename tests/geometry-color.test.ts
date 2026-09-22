import { describe, it, expect } from 'vitest';
import {
  pointInRect,
  distanceBetweenPoints,
  normalizeRect,
  getSvgPathFromPoints
} from '../src/utils/geometry';
import { hexToRgb, hexToPdfRgb, rgbaToCss } from '../src/utils/color';

describe('Geometry Utilities', () => {
  it('should test point inside rectangle', () => {
    const rect = { x: 10, y: 10, width: 50, height: 50 };
    expect(pointInRect({ x: 25, y: 25 }, rect)).toBe(true);
    expect(pointInRect({ x: 5, y: 25 }, rect)).toBe(false);
    expect(pointInRect({ x: 65, y: 25 }, rect)).toBe(false);
  });

  it('should calculate Euclidean distance between two points', () => {
    const dist = distanceBetweenPoints({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(dist).toBe(5);
  });

  it('should normalize rectangle coordinates from arbitrary drag points', () => {
    const rect = normalizeRect({ x: 100, y: 80 }, { x: 40, y: 20 });
    expect(rect.x).toBe(40);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(60);
    expect(rect.height).toBe(60);
  });

  it('should produce valid SVG path from smooth points', () => {
    const path = getSvgPathFromPoints([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    expect(path).toContain('M 0 0');
    expect(path).toContain('Q');
  });
});

describe('Color Utilities', () => {
  it('should convert hex to RGB integers correctly', () => {
    const rgb = hexToRgb('#ff8000');
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(128);
    expect(rgb.b).toBe(0);
  });

  it('should convert hex to PDF 0-1 floating RGB', () => {
    const pdfRgb = hexToPdfRgb('#ffffff');
    expect(pdfRgb.r).toBe(1);
    expect(pdfRgb.g).toBe(1);
    expect(pdfRgb.b).toBe(1);
  });

  it('should format RGBA to CSS string', () => {
    const css = rgbaToCss({ r: 255, g: 0, b: 128 }, 0.5);
    expect(css).toBe('rgba(255, 0, 128, 0.5)');
  });
});
