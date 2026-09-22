import { Point } from '../types/annotations';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pointInRect(p: { x: number; y: number }, rect: Rect): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  );
}

export function distanceBetweenPoints(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function distanceToLineSegment(
  p: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
  if (l2 === 0) return distanceBetweenPoints(p, p1);
  let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(
    p.x - (p1.x + t * (p2.x - p1.x)),
    p.y - (p1.y + t * (p2.y - p1.y))
  );
}

export function normalizeRect(p1: { x: number; y: number }, p2: { x: number; y: number }): Rect {
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const width = Math.abs(p2.x - p1.x);
  const height = Math.abs(p2.y - p1.y);
  return { x, y, width, height };
}

/**
 * Smooth an array of points using midpoint quadratic bezier curves for freehand ink strokes.
 */
export function getSvgPathFromPoints(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    path += ` Q ${p1.x} ${p1.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

/**
 * Convert screen/canvas coordinates to PDF coordinates (PDF origin is bottom-left, y points up).
 */
export function screenToPdfCoords(
  point: { x: number; y: number },
  pdfPageHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: point.x / scale,
    y: (pdfPageHeight * scale - point.y) / scale
  };
}

/**
 * Convert PDF coordinates (bottom-left origin) to screen coordinates (top-left origin).
 */
export function pdfToScreenCoords(
  point: { x: number; y: number },
  pdfPageHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: point.x * scale,
    y: (pdfPageHeight - point.y) * scale
  };
}
