import {
  Annotation,
  FreehandAnnotation,
  HighlightAnnotation,
  ImageAnnotation,
  LineAnnotation,
  MeasureAnnotation,
  MeasureUnit,
  RedactionAnnotation,
  ShapeAnnotation,
  SignatureAnnotation,
  StampAnnotation,
  StickyNoteAnnotation,
  TextAnnotation,
  ToolType
} from '../types/annotations';
import { AnnotationManager } from './manager';
import {
  formatMeasurement,
  getSvgPathFromPoints,
  normalizeRect,
  pointInRect,
  Rect
} from '../utils/geometry';
import { hexToRgbaCss } from '../utils/color';
import { NotificationService } from '../ui/notification';
import { AnnotationContextMenu } from '../ui/context-menu';

export class PageAnnotationOverlay {
  private container: HTMLElement;
  private svgLayer: SVGSVGElement;
  private pageIndex: number;
  private manager: AnnotationManager;
  private getScale: () => number;
  private getActiveTool: () => ToolType;
  private getActiveColor: () => string;
  private getActiveStrokeWidth: () => number;
  private getActiveStamp: () => string;
  private getActiveSignature: () => string | null;
  private getActiveMeasureUnit?: () => MeasureUnit;
  private getActiveImage?: () => string | null;
  private contextMenu?: AnnotationContextMenu;

  // Active interaction state
  private isDrawing: boolean = false;
  private startPoint: { x: number; y: number } | null = null;
  private currentPoints: { x: number; y: number }[] = [];
  private previewElement: SVGElement | null = null;
  private draggingAnnotationId: string | null = null;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    container: HTMLElement,
    pageIndex: number,
    manager: AnnotationManager,
    options: {
      getScale: () => number;
      getActiveTool: () => ToolType;
      getActiveColor: () => string;
      getActiveStrokeWidth: () => number;
      getActiveStamp: () => string;
      getActiveSignature: () => string | null;
      getActiveMeasureUnit?: () => MeasureUnit;
      getActiveImage?: () => string | null;
      contextMenu?: AnnotationContextMenu;
    }
  ) {
    this.container = container;
    this.pageIndex = pageIndex;
    this.manager = manager;
    this.getScale = options.getScale;
    this.getActiveTool = options.getActiveTool;
    this.getActiveColor = options.getActiveColor;
    this.getActiveStrokeWidth = options.getActiveStrokeWidth;
    this.getActiveStamp = options.getActiveStamp;
    this.getActiveSignature = options.getActiveSignature;
    this.getActiveMeasureUnit = options.getActiveMeasureUnit;
    this.getActiveImage = options.getActiveImage;
    this.contextMenu = options.contextMenu;

    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.classList.add('annotation-layer');
    this.svgLayer.style.position = 'absolute';
    this.svgLayer.style.top = '0';
    this.svgLayer.style.left = '0';
    this.svgLayer.style.width = '100%';
    this.svgLayer.style.height = '100%';
    this.svgLayer.style.pointerEvents = 'all';
    this.svgLayer.style.overflow = 'visible';

    this.container.appendChild(this.svgLayer);

    this.attachEvents();
    this.render();

    this.manager.subscribe(() => {
      this.render();
    });
  }

  public updateSize(width: number, height: number): void {
    this.svgLayer.setAttribute('width', width.toString());
    this.svgLayer.setAttribute('height', height.toString());
    this.svgLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  private attachEvents(): void {
    this.svgLayer.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));

    this.svgLayer.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const coords = this.getEventCoords(e as any);
      const annotations = this.manager.getAnnotationsForPage(this.pageIndex);
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (this.hitTestAnnotation(ann, coords)) {
          if (this.contextMenu) {
            this.contextMenu.show(ann, e.clientX, e.clientY);
          }
          return;
        }
      }
    });

    this.svgLayer.addEventListener('pointerleave', () => {
      if (this.previewElement && this.previewElement.id === 'image-placement-preview') {
        this.previewElement.remove();
        this.previewElement = null;
      }
    });
  }

  private getEventCoords(e: PointerEvent): { x: number; y: number } {
    const rect = this.svgLayer.getBoundingClientRect();
    const scale = this.getScale();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    };
  }

  private onPointerDown(e: PointerEvent): void {
    const tool = this.getActiveTool();
    if (tool === 'hand') return;

    if (this.previewElement && this.previewElement.id === 'image-placement-preview') {
      this.previewElement.remove();
      this.previewElement = null;
    }

    const coords = this.getEventCoords(e);
    const scale = this.getScale();

    // Check hit test for selection or dragging
    if (tool === 'select') {
      const annotations = this.manager.getAnnotationsForPage(this.pageIndex);
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (this.hitTestAnnotation(ann, coords)) {
          this.manager.selectAnnotation(ann.id);
          this.draggingAnnotationId = ann.id;
          this.dragOffset = this.getAnnotationOffset(ann, coords);
          return;
        }
      }
      this.manager.selectAnnotation(null);
      return;
    }

    if (tool === 'eraser') {
      const annotations = this.manager.getAnnotationsForPage(this.pageIndex);
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (this.hitTestAnnotation(ann, coords)) {
          this.manager.removeAnnotation(ann.id);
          return;
        }
      }
      return;
    }

    // Direct placement tools
    if (tool === 'stamp') {
      const stampType = this.getActiveStamp() as any;
      const stampAnn: StampAnnotation = {
        id: 'stamp_' + Math.random().toString(36).substring(2, 9),
        type: 'stamp',
        pageIndex: this.pageIndex,
        stampType,
        x: coords.x - 75,
        y: coords.y - 25,
        width: 150,
        height: 50,
        color: this.getActiveColor(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.manager.addAnnotation(stampAnn);
      return;
    }

    if (tool === 'signature') {
      const sigData = this.getActiveSignature();
      if (sigData) {
        const sigAnn: SignatureAnnotation = {
          id: 'sig_' + Math.random().toString(36).substring(2, 9),
          type: 'signature',
          pageIndex: this.pageIndex,
          dataUrl: sigData,
          x: coords.x - 80,
          y: coords.y - 30,
          width: 160,
          height: 60,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.manager.addAnnotation(sigAnn);
      }
      return;
    }

    if (tool === 'image') {
      const imgData = this.getActiveImage ? this.getActiveImage() : null;
      if (imgData) {
        const imgAnn: ImageAnnotation = {
          id: 'img_' + Math.random().toString(36).substring(2, 9),
          type: 'image',
          pageIndex: this.pageIndex,
          dataUrl: imgData,
          x: coords.x - 75,
          y: coords.y - 50,
          width: 150,
          height: 100,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.manager.addAnnotation(imgAnn);
      }
      return;
    }

    if (tool === 'sticky_note') {
      const noteAnn: StickyNoteAnnotation = {
        id: 'note_' + Math.random().toString(36).substring(2, 9),
        type: 'sticky_note',
        pageIndex: this.pageIndex,
        x: coords.x,
        y: coords.y,
        title: 'Note',
        content: 'Type your comment here...',
        color: this.getActiveColor(),
        isOpen: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.manager.addAnnotation(noteAnn);
      return;
    }

    if (tool === 'text') {
      const textAnn: TextAnnotation = {
        id: 'text_' + Math.random().toString(36).substring(2, 9),
        type: 'text',
        pageIndex: this.pageIndex,
        x: coords.x,
        y: coords.y,
        width: 150,
        height: 32,
        text: 'Enter text here',
        fontSize: 14,
        fontFamily: 'Helvetica, Arial, sans-serif',
        color: this.getActiveColor(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.manager.addAnnotation(textAnn);
      this.manager.selectAnnotation(textAnn.id);
      return;
    }

    // Drag-to-create tools: freehand, highlight, rectangle, ellipse, line, arrow
    this.isDrawing = true;
    this.startPoint = coords;
    this.currentPoints = [coords];

    if (tool === 'freehand' || tool === 'freehand_highlight') {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const strokeW = tool === 'freehand_highlight' ? Math.max(16, this.getActiveStrokeWidth() * 6) : this.getActiveStrokeWidth();
      path.setAttribute('stroke', this.getActiveColor());
      path.setAttribute('stroke-width', (strokeW * scale).toString());
      path.setAttribute('stroke-linecap', 'square');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('fill', 'none');
      if (tool === 'freehand_highlight') {
        path.setAttribute('style', 'mix-blend-mode: multiply; opacity: 0.4;');
      }
      this.svgLayer.appendChild(path);
      this.previewElement = path;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const scale = this.getScale();

    // Handle dragging an existing annotation
    if (this.draggingAnnotationId) {
      const coords = this.getEventCoords(e);
      const ann = this.manager.getAnnotation(this.draggingAnnotationId);
      if (ann) {
        if ('x' in ann && 'y' in ann) {
          this.manager.updateAnnotation(
            ann.id,
            {
              x: coords.x - this.dragOffset.x,
              y: coords.y - this.dragOffset.y
            },
            false
          );
        }
      }
      return;
    }

    const tool = this.getActiveTool();

    // Live placement preview for image tool before clicking
    if (tool === 'image' && !this.isDrawing) {
      const imgData = this.getActiveImage ? this.getActiveImage() : null;
      if (imgData) {
        if (!this.previewElement || this.previewElement.id !== 'image-placement-preview') {
          if (this.previewElement) this.previewElement.remove();
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('id', 'image-placement-preview');
          const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          img.setAttribute('href', imgData);
          img.setAttribute('opacity', '0.65');
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', '#38bdf8');
          rect.setAttribute('stroke-width', '1.5');
          rect.setAttribute('stroke-dasharray', '4,3');
          g.appendChild(img);
          g.appendChild(rect);
          this.svgLayer.appendChild(g);
          this.previewElement = g;
        }

        const coords = this.getEventCoords(e);
        const w = 150 * scale;
        const h = 100 * scale;
        const x = coords.x * scale - w / 2;
        const y = coords.y * scale - h / 2;

        const img = this.previewElement.querySelector('image');
        const rect = this.previewElement.querySelector('rect');
        img?.setAttribute('x', x.toString());
        img?.setAttribute('y', y.toString());
        img?.setAttribute('width', w.toString());
        img?.setAttribute('height', h.toString());
        rect?.setAttribute('x', x.toString());
        rect?.setAttribute('y', y.toString());
        rect?.setAttribute('width', w.toString());
        rect?.setAttribute('height', h.toString());
        return;
      }
    } else if (this.previewElement && this.previewElement.id === 'image-placement-preview') {
      this.previewElement.remove();
      this.previewElement = null;
    }

    if (!this.isDrawing || !this.startPoint) return;

    const coords = this.getEventCoords(e);

    if (tool === 'freehand' || tool === 'freehand_highlight') {
      this.currentPoints.push(coords);
      if (this.previewElement) {
        const scaledPoints = this.currentPoints.map(p => ({
          x: p.x * scale,
          y: p.y * scale
        }));
        this.previewElement.setAttribute('d', getSvgPathFromPoints(scaledPoints));
      }
    } else if (
      tool === 'highlight' ||
      tool === 'rectangle' ||
      tool === 'ellipse' ||
      tool === 'line' ||
      tool === 'arrow' ||
      tool === 'redaction' ||
      tool === 'measure' ||
      tool === 'snapshot'
    ) {
      if (!this.previewElement) {
        const el = document.createElementNS(
          'http://www.w3.org/2000/svg',
          tool === 'ellipse'
            ? 'ellipse'
            : tool === 'line' || tool === 'arrow' || tool === 'measure'
            ? 'line'
            : 'rect'
        );
        el.setAttribute(
          'stroke',
          tool === 'redaction' ? '#ef4444' : tool === 'snapshot' ? '#0284c7' : this.getActiveColor()
        );
        el.setAttribute('stroke-width', (this.getActiveStrokeWidth() * scale).toString());
        el.setAttribute(
          'fill',
          tool === 'highlight'
            ? hexToRgbaCss(this.getActiveColor(), 0.35)
            : tool === 'redaction'
            ? 'rgba(0, 0, 0, 0.75)'
            : tool === 'snapshot'
            ? 'rgba(56, 189, 248, 0.2)'
            : 'none'
        );
        if (tool === 'redaction' || tool === 'snapshot') {
          el.setAttribute('stroke-dasharray', '4,2');
        }
        this.svgLayer.appendChild(el);
        this.previewElement = el;
      }

      const rect = normalizeRect(this.startPoint, coords);
      if (tool === 'rectangle' || tool === 'highlight' || tool === 'redaction' || tool === 'snapshot') {
        this.previewElement.setAttribute('x', (rect.x * scale).toString());
        this.previewElement.setAttribute('y', (rect.y * scale).toString());
        this.previewElement.setAttribute('width', (rect.width * scale).toString());
        this.previewElement.setAttribute('height', (rect.height * scale).toString());
      } else if (tool === 'ellipse') {
        this.previewElement.setAttribute('cx', ((rect.x + rect.width / 2) * scale).toString());
        this.previewElement.setAttribute('cy', ((rect.y + rect.height / 2) * scale).toString());
        this.previewElement.setAttribute('rx', ((rect.width / 2) * scale).toString());
        this.previewElement.setAttribute('ry', ((rect.height / 2) * scale).toString());
      } else if (tool === 'line' || tool === 'arrow' || tool === 'measure') {
        this.previewElement.setAttribute('x1', (this.startPoint.x * scale).toString());
        this.previewElement.setAttribute('y1', (this.startPoint.y * scale).toString());
        this.previewElement.setAttribute('x2', (coords.x * scale).toString());
        this.previewElement.setAttribute('y2', (coords.y * scale).toString());
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.draggingAnnotationId) {
      this.draggingAnnotationId = null;
      return;
    }

    if (!this.isDrawing || !this.startPoint) return;

    const coords = this.getEventCoords(e);
    const tool = this.getActiveTool();
    const scale = this.getScale();

    if (this.previewElement) {
      this.previewElement.remove();
      this.previewElement = null;
    }

    const id = 'ann_' + Math.random().toString(36).substring(2, 9);
    const now = Date.now();

    if ((tool === 'freehand' || tool === 'freehand_highlight') && this.currentPoints.length > 1) {
      const isHighlighter = tool === 'freehand_highlight';
      const ann: FreehandAnnotation = {
        id,
        type: 'freehand',
        pageIndex: this.pageIndex,
        points: this.currentPoints,
        color: this.getActiveColor(),
        strokeWidth: isHighlighter ? Math.max(16, this.getActiveStrokeWidth() * 6) : this.getActiveStrokeWidth(),
        opacity: isHighlighter ? 0.4 : 1,
        isHighlighter,
        createdAt: now,
        updatedAt: now
      };
      this.manager.addAnnotation(ann);
    } else if (tool === 'highlight') {
      const rect = normalizeRect(this.startPoint, coords);
      if (rect.width > 4 && rect.height > 4) {
        const ann: HighlightAnnotation = {
          id,
          type: 'highlight',
          pageIndex: this.pageIndex,
          rects: [rect],
          color: this.getActiveColor(),
          opacity: 0.4,
          createdAt: now,
          updatedAt: now
        };
        this.manager.addAnnotation(ann);
      }
    } else if (tool === 'rectangle' || tool === 'ellipse') {
      const rect = normalizeRect(this.startPoint, coords);
      if (rect.width > 4 && rect.height > 4) {
        const ann: ShapeAnnotation = {
          id,
          type: tool,
          pageIndex: this.pageIndex,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          strokeColor: this.getActiveColor(),
          strokeWidth: this.getActiveStrokeWidth(),
          createdAt: now,
          updatedAt: now
        };
        this.manager.addAnnotation(ann);
      }
    } else if (tool === 'redaction') {
      const rect = normalizeRect(this.startPoint, coords);
      if (rect.width > 4 && rect.height > 4) {
        const ann: RedactionAnnotation = {
          id,
          type: 'redaction',
          pageIndex: this.pageIndex,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          overlayText: 'REDACTED',
          createdAt: now,
          updatedAt: now
        };
        this.manager.addAnnotation(ann);
      }
    } else if (tool === 'line' || tool === 'arrow') {
      const dist = Math.hypot(coords.x - this.startPoint.x, coords.y - this.startPoint.y);
      if (dist > 5) {
        const ann: LineAnnotation = {
          id,
          type: tool,
          pageIndex: this.pageIndex,
          x1: this.startPoint.x,
          y1: this.startPoint.y,
          x2: coords.x,
          y2: coords.y,
          strokeColor: this.getActiveColor(),
          strokeWidth: this.getActiveStrokeWidth(),
          arrowHead: tool === 'arrow',
          createdAt: now,
          updatedAt: now
        };
        this.manager.addAnnotation(ann);
      }
    } else if (tool === 'measure') {
      const dist = Math.hypot(coords.x - this.startPoint.x, coords.y - this.startPoint.y);
      if (dist > 5) {
        const unit = this.getActiveMeasureUnit ? this.getActiveMeasureUnit() : 'mm';
        const formattedValue = formatMeasurement(dist, unit);
        const ann: MeasureAnnotation = {
          id,
          type: 'measure',
          pageIndex: this.pageIndex,
          x1: this.startPoint.x,
          y1: this.startPoint.y,
          x2: coords.x,
          y2: coords.y,
          distancePt: dist,
          unit,
          formattedValue,
          color: this.getActiveColor(),
          createdAt: now,
          updatedAt: now
        };
        this.manager.addAnnotation(ann);
      }
    } else if (tool === 'snapshot') {
      const rect = normalizeRect(this.startPoint, coords);
      if (rect.width > 8 && rect.height > 8) {
        const pageCanvas = this.container.querySelector('.page-canvas') as HTMLCanvasElement | null;
        if (pageCanvas) {
          const dpr = pageCanvas.width / (pageCanvas.clientWidth || 1);
          const clipCanvas = document.createElement('canvas');
          clipCanvas.width = Math.floor(rect.width * scale * dpr);
          clipCanvas.height = Math.floor(rect.height * scale * dpr);
          const clipCtx = clipCanvas.getContext('2d');
          if (clipCtx) {
            clipCtx.drawImage(
              pageCanvas,
              rect.x * scale * dpr,
              rect.y * scale * dpr,
              rect.width * scale * dpr,
              rect.height * scale * dpr,
              0,
              0,
              clipCanvas.width,
              clipCanvas.height
            );

            clipCanvas.toBlob(async (blob) => {
              if (blob) {
                try {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  NotificationService.show('Area snapshot copied to clipboard!');
                } catch {
                  NotificationService.show('Snapshot captured successfully!');
                }
              }
            });
          }
        }
      }
    }

    this.isDrawing = false;
    this.startPoint = null;
    this.currentPoints = [];
  }

  private hitTestAnnotation(ann: Annotation, p: { x: number; y: number }): boolean {
    if (ann.type === 'highlight') {
      return ann.rects.some(r => pointInRect(p, r));
    }
    if (
      ann.type === 'rectangle' ||
      ann.type === 'ellipse' ||
      ann.type === 'text' ||
      ann.type === 'stamp' ||
      ann.type === 'signature' ||
      ann.type === 'redaction' ||
      ann.type === 'image'
    ) {
      const rect: Rect = { x: ann.x, y: ann.y, width: ann.width, height: ann.height };
      return pointInRect(p, rect);
    }
    if (ann.type === 'sticky_note') {
      return Math.hypot(p.x - ann.x, p.y - ann.y) < 18;
    }
    if (ann.type === 'line' || ann.type === 'arrow' || ann.type === 'measure') {
      // Check distance to segment
      const l2 = (ann.x2 - ann.x1) ** 2 + (ann.y2 - ann.y1) ** 2;
      let t = ((p.x - ann.x1) * (ann.x2 - ann.x1) + (p.y - ann.y1) * (ann.y2 - ann.y1)) / (l2 || 1);
      t = Math.max(0, Math.min(1, t));
      const dist = Math.hypot(p.x - (ann.x1 + t * (ann.x2 - ann.x1)), p.y - (ann.y1 + t * (ann.y2 - ann.y1)));
      return dist <= 8;
    }
    if (ann.type === 'freehand') {
      for (const pt of ann.points) {
        if (Math.hypot(p.x - pt.x, p.y - pt.y) <= 10) return true;
      }
    }
    return false;
  }

  private getAnnotationOffset(ann: Annotation, p: { x: number; y: number }): { x: number; y: number } {
    if ('x' in ann && 'y' in ann) {
      return { x: p.x - ann.x, y: p.y - ann.y };
    }
    return { x: 0, y: 0 };
  }

  public render(): void {
    // Clear existing SVG children except active preview if drawing
    while (this.svgLayer.firstChild) {
      this.svgLayer.removeChild(this.svgLayer.firstChild);
    }

    const annotations = this.manager.getAnnotationsForPage(this.pageIndex);
    const scale = this.getScale();
    const selectedId = this.manager.getSelectedId();

    for (const ann of annotations) {
      const isSelected = ann.id === selectedId;

      if (ann.type === 'highlight') {
        for (const rect of ann.rects) {
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          r.setAttribute('x', (rect.x * scale).toString());
          r.setAttribute('y', (rect.y * scale).toString());
          r.setAttribute('width', (rect.width * scale).toString());
          r.setAttribute('height', (rect.height * scale).toString());
          r.setAttribute('fill', hexToRgbaCss(ann.color, ann.opacity));
          r.setAttribute('style', 'mix-blend-mode: multiply;');
          if (isSelected) {
            r.setAttribute('stroke', '#1976d2');
            r.setAttribute('stroke-width', '1.5');
            r.setAttribute('stroke-dasharray', '4,2');
          }
          this.svgLayer.appendChild(r);
        }
      } else if (ann.type === 'freehand') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const scaledPoints = ann.points.map(p => ({
          x: p.x * scale,
          y: p.y * scale
        }));
        path.setAttribute('d', getSvgPathFromPoints(scaledPoints));
        path.setAttribute('stroke', ann.color);
        path.setAttribute('stroke-width', (ann.strokeWidth * scale).toString());
        path.setAttribute('stroke-linecap', ann.isHighlighter ? 'square' : 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        if (ann.isHighlighter) {
          path.setAttribute('style', 'mix-blend-mode: multiply;');
          path.setAttribute('opacity', (ann.opacity || 0.4).toString());
        }
        if (isSelected) {
          path.setAttribute('filter', 'drop-shadow(0 0 3px #1976d2)');
        }
        this.svgLayer.appendChild(path);
      } else if (ann.type === 'rectangle') {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', (ann.x * scale).toString());
        r.setAttribute('y', (ann.y * scale).toString());
        r.setAttribute('width', (ann.width * scale).toString());
        r.setAttribute('height', (ann.height * scale).toString());
        r.setAttribute('stroke', ann.strokeColor);
        r.setAttribute('stroke-width', (ann.strokeWidth * scale).toString());
        r.setAttribute('fill', ann.fillColor || 'none');
        if (isSelected) {
          r.setAttribute('stroke-dasharray', '4,2');
          r.setAttribute('stroke', '#1976d2');
        }
        this.svgLayer.appendChild(r);
      } else if (ann.type === 'ellipse') {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        el.setAttribute('cx', ((ann.x + ann.width / 2) * scale).toString());
        el.setAttribute('cy', ((ann.y + ann.height / 2) * scale).toString());
        el.setAttribute('rx', ((ann.width / 2) * scale).toString());
        el.setAttribute('ry', ((ann.height / 2) * scale).toString());
        el.setAttribute('stroke', ann.strokeColor);
        el.setAttribute('stroke-width', (ann.strokeWidth * scale).toString());
        el.setAttribute('fill', ann.fillColor || 'none');
        if (isSelected) {
          el.setAttribute('stroke-dasharray', '4,2');
          el.setAttribute('stroke', '#1976d2');
        }
        this.svgLayer.appendChild(el);
      } else if (ann.type === 'line' || ann.type === 'arrow') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', (ann.x1 * scale).toString());
        line.setAttribute('y1', (ann.y1 * scale).toString());
        line.setAttribute('x2', (ann.x2 * scale).toString());
        line.setAttribute('y2', (ann.y2 * scale).toString());
        line.setAttribute('stroke', ann.strokeColor);
        line.setAttribute('stroke-width', (ann.strokeWidth * scale).toString());
        line.setAttribute('stroke-linecap', 'round');
        this.svgLayer.appendChild(line);

        if (ann.arrowHead) {
          // Draw arrowhead triangle
          const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
          const arrowLen = 12 * scale;
          const arrowAngle = Math.PI / 6;
          const p1x = ann.x2 * scale - arrowLen * Math.cos(angle - arrowAngle);
          const p1y = ann.y2 * scale - arrowLen * Math.sin(angle - arrowAngle);
          const p2x = ann.x2 * scale - arrowLen * Math.cos(angle + arrowAngle);
          const p2y = ann.y2 * scale - arrowLen * Math.sin(angle + arrowAngle);

          const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
          head.setAttribute('points', `${ann.x2 * scale},${ann.y2 * scale} ${p1x},${p1y} ${p2x},${p2y}`);
          head.setAttribute('fill', ann.strokeColor);
          this.svgLayer.appendChild(head);
        }
      } else if (ann.type === 'text') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (ann.x * scale).toString());
        text.setAttribute('y', ((ann.y + ann.fontSize) * scale).toString());
        text.setAttribute('font-size', `${ann.fontSize * scale}px`);
        text.setAttribute('font-family', ann.fontFamily);
        text.setAttribute('fill', ann.color);
        text.setAttribute('font-weight', ann.bold ? 'bold' : 'normal');
        text.setAttribute('font-style', ann.italic ? 'italic' : 'normal');
        text.textContent = ann.text;

        if (isSelected) {
          const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          box.setAttribute('x', ((ann.x - 4) * scale).toString());
          box.setAttribute('y', ((ann.y - 2) * scale).toString());
          box.setAttribute('width', ((ann.width + 8) * scale).toString());
          box.setAttribute('height', ((ann.height + 4) * scale).toString());
          box.setAttribute('fill', 'none');
          box.setAttribute('stroke', '#1976d2');
          box.setAttribute('stroke-width', '1.5');
          box.setAttribute('stroke-dasharray', '3,3');
          g.appendChild(box);
        }

        g.appendChild(text);
        this.svgLayer.appendChild(g);
      } else if (ann.type === 'stamp') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', (ann.x * scale).toString());
        rect.setAttribute('y', (ann.y * scale).toString());
        rect.setAttribute('width', (ann.width * scale).toString());
        rect.setAttribute('height', (ann.height * scale).toString());
        rect.setAttribute('rx', (6 * scale).toString());
        rect.setAttribute('fill', hexToRgbaCss(ann.color, 0.1));
        rect.setAttribute('stroke', ann.color);
        rect.setAttribute('stroke-width', (3 * scale).toString());

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', ((ann.x + ann.width / 2) * scale).toString());
        text.setAttribute('y', ((ann.y + ann.height / 2 + 6) * scale).toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', `${18 * scale}px`);
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('letter-spacing', '2px');
        text.setAttribute('fill', ann.color);
        text.textContent = ann.customText || ann.stampType;

        g.appendChild(rect);
        g.appendChild(text);
        if (isSelected) {
          g.setAttribute('filter', 'drop-shadow(0 0 4px #1976d2)');
        }
        this.svgLayer.appendChild(g);
      } else if (ann.type === 'signature') {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('x', (ann.x * scale).toString());
        img.setAttribute('y', (ann.y * scale).toString());
        img.setAttribute('width', (ann.width * scale).toString());
        img.setAttribute('height', (ann.height * scale).toString());
        img.setAttribute('href', ann.dataUrl);

        if (isSelected) {
          const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          box.setAttribute('x', (ann.x * scale).toString());
          box.setAttribute('y', (ann.y * scale).toString());
          box.setAttribute('width', (ann.width * scale).toString());
          box.setAttribute('height', (ann.height * scale).toString());
          box.setAttribute('fill', 'none');
          box.setAttribute('stroke', '#1976d2');
          box.setAttribute('stroke-width', '1.5');
          box.setAttribute('stroke-dasharray', '3,3');
          this.svgLayer.appendChild(box);
        }
        this.svgLayer.appendChild(img);
      } else if (ann.type === 'image') {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('x', (ann.x * scale).toString());
        img.setAttribute('y', (ann.y * scale).toString());
        img.setAttribute('width', (ann.width * scale).toString());
        img.setAttribute('height', (ann.height * scale).toString());
        img.setAttribute('href', ann.dataUrl);

        if (isSelected) {
          const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          box.setAttribute('x', (ann.x * scale).toString());
          box.setAttribute('y', (ann.y * scale).toString());
          box.setAttribute('width', (ann.width * scale).toString());
          box.setAttribute('height', (ann.height * scale).toString());
          box.setAttribute('fill', 'none');
          box.setAttribute('stroke', '#1976d2');
          box.setAttribute('stroke-width', '1.5');
          box.setAttribute('stroke-dasharray', '3,3');
          this.svgLayer.appendChild(box);
        }
        this.svgLayer.appendChild(img);
      } else if (ann.type === 'sticky_note') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', (ann.x * scale).toString());
        circle.setAttribute('cy', (ann.y * scale).toString());
        circle.setAttribute('r', (12 * scale).toString());
        circle.setAttribute('fill', ann.color || '#ffca28');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', '1');
        circle.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))');

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.setAttribute('x', (ann.x * scale).toString());
        icon.setAttribute('y', ((ann.y + 4) * scale).toString());
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('font-size', `${12 * scale}px`);
        icon.setAttribute('fill', '#000');
        icon.textContent = '✎';

        g.appendChild(circle);
        g.appendChild(icon);
        this.svgLayer.appendChild(g);
      } else if (ann.type === 'redaction') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', (ann.x * scale).toString());
        rect.setAttribute('y', (ann.y * scale).toString());
        rect.setAttribute('width', (ann.width * scale).toString());
        rect.setAttribute('height', (ann.height * scale).toString());
        rect.setAttribute('fill', '#000000');
        rect.setAttribute('stroke', isSelected ? '#1976d2' : '#000000');
        rect.setAttribute('stroke-width', (2 * scale).toString());
        g.appendChild(rect);

        if (ann.width > 36 && ann.height > 12) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', ((ann.x + ann.width / 2) * scale).toString());
          text.setAttribute('y', ((ann.y + ann.height / 2 + 3) * scale).toString());
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-size', `${Math.min(9, ann.height * 0.6) * scale}px`);
          text.setAttribute('font-family', 'monospace');
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('fill', '#ffffff');
          text.textContent = ann.overlayText || 'REDACTED';
          g.appendChild(text);
        }
        this.svgLayer.appendChild(g);
      } else if (ann.type === 'measure') {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', (ann.x1 * scale).toString());
        line.setAttribute('y1', (ann.y1 * scale).toString());
        line.setAttribute('x2', (ann.x2 * scale).toString());
        line.setAttribute('y2', (ann.y2 * scale).toString());
        line.setAttribute('stroke', ann.color);
        line.setAttribute('stroke-width', (2 * scale).toString());
        g.appendChild(line);

        // Perpendicular end ticks
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        const tickLen = 7 * scale;
        const perpX = Math.sin(angle) * tickLen;
        const perpY = -Math.cos(angle) * tickLen;

        const tick1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick1.setAttribute('x1', (ann.x1 * scale - perpX).toString());
        tick1.setAttribute('y1', (ann.y1 * scale - perpY).toString());
        tick1.setAttribute('x2', (ann.x1 * scale + perpX).toString());
        tick1.setAttribute('y2', (ann.y1 * scale + perpY).toString());
        tick1.setAttribute('stroke', ann.color);
        tick1.setAttribute('stroke-width', (2 * scale).toString());
        g.appendChild(tick1);

        const tick2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick2.setAttribute('x1', (ann.x2 * scale - perpX).toString());
        tick2.setAttribute('y1', (ann.y2 * scale - perpY).toString());
        tick2.setAttribute('x2', (ann.x2 * scale + perpX).toString());
        tick2.setAttribute('y2', (ann.y2 * scale + perpY).toString());
        tick2.setAttribute('stroke', ann.color);
        tick2.setAttribute('stroke-width', (2 * scale).toString());
        g.appendChild(tick2);

        // Centered badge with measurement text
        const midX = ((ann.x1 + ann.x2) / 2) * scale;
        const midY = ((ann.y1 + ann.y2) / 2) * scale;
        const badgeWidth = 64 * scale;
        const badgeHeight = 20 * scale;

        const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        badgeRect.setAttribute('x', (midX - badgeWidth / 2).toString());
        badgeRect.setAttribute('y', (midY - badgeHeight / 2).toString());
        badgeRect.setAttribute('width', badgeWidth.toString());
        badgeRect.setAttribute('height', badgeHeight.toString());
        badgeRect.setAttribute('rx', (4 * scale).toString());
        badgeRect.setAttribute('fill', '#1e293b');
        badgeRect.setAttribute('stroke', isSelected ? '#1976d2' : ann.color);
        badgeRect.setAttribute('stroke-width', '1.5');
        g.appendChild(badgeRect);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', midX.toString());
        label.setAttribute('y', (midY + 4 * scale).toString());
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', `${10 * scale}px`);
        label.setAttribute('font-family', 'sans-serif');
        label.setAttribute('font-weight', '600');
        label.setAttribute('fill', '#ffffff');
        label.textContent = ann.formattedValue;
        g.appendChild(label);

        this.svgLayer.appendChild(g);
      }
    }
  }

  public destroy(): void {
    this.svgLayer.remove();
  }
}
