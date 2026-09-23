import * as pdfjsLib from 'pdfjs-dist';
import { ThemeMode } from '../types/document';

export interface RenderOptions {
  scale: number;
  rotation?: number;
  theme?: ThemeMode;
  renderTextLayer?: boolean;
}

export class PageRenderer {
  private activeRenderTasks: Map<number, any> = new Map();

  /**
   * Renders a single PDF page into a canvas with full HiDPI support.
   */
  public async renderPageToCanvas(
    page: pdfjsLib.PDFPageProxy,
    canvas: HTMLCanvasElement,
    options: RenderOptions
  ): Promise<pdfjsLib.PageViewport> {
    const pageIndex = page.pageNumber;

    // Cancel any ongoing render task on this page
    if (this.activeRenderTasks.has(pageIndex)) {
      try {
        const activeTask = this.activeRenderTasks.get(pageIndex);
        activeTask.cancel();
      } catch {
        // Ignored
      }
      this.activeRenderTasks.delete(pageIndex);
    }

    const rotation = ((page.rotate || 0) + (options.rotation || 0)) % 360;
    const viewport = page.getViewport({ scale: options.scale, rotation });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not obtain 2D canvas context');

    ctx.save();
    ctx.scale(dpr, dpr);

    // Apply reading theme styling
    if (options.theme === 'dark') {
      canvas.style.filter = 'invert(0.9) hue-rotate(180deg) contrast(1.1)';
    } else if (options.theme === 'oled') {
      canvas.style.filter = 'invert(0.95) hue-rotate(180deg) contrast(1.25) brightness(0.9)';
    } else if (options.theme === 'high-contrast') {
      canvas.style.filter = 'invert(1) contrast(2) grayscale(1)';
    } else if (options.theme === 'sepia') {
      canvas.style.filter = 'sepia(0.4) contrast(0.95) brightness(0.95)';
    } else {
      canvas.style.filter = 'none';
    }

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);
    this.activeRenderTasks.set(pageIndex, renderTask);

    try {
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') {
        // Normal when rapid zooming or scrolling
      } else {
        console.error(`Page ${pageIndex} render failed:`, err);
      }
    } finally {
      ctx.restore();
      this.activeRenderTasks.delete(pageIndex);
    }

    return viewport;
  }

  /**
   * Render thumbnail image data URL for the sidebar and page organizer.
   */
  public async renderThumbnail(
    page: pdfjsLib.PDFPageProxy,
    width: number = 180,
    rotation: number = 0
  ): Promise<string> {
    const baseViewport = page.getViewport({ scale: 1, rotation });
    const scale = width / baseViewport.width;
    const viewport = page.getViewport({ scale, rotation });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  public cancelAll(): void {
    for (const [, task] of this.activeRenderTasks) {
      try {
        task.cancel();
      } catch {
        // Ignored
      }
    }
    this.activeRenderTasks.clear();
  }
}
