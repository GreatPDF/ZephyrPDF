import { PageItem } from '../types/organizer';
import { HistoryManager } from '../core/history';

export class PageManager {
  private pages: PageItem[] = [];
  private history: HistoryManager;
  private listeners: Array<() => void> = [];

  constructor(history: HistoryManager) {
    this.history = history;
  }

  public initFromDocument(pageCount: number, dimensions: { width: number; height: number; rotation: number }[]): void {
    this.pages = [];
    for (let i = 0; i < pageCount; i++) {
      const dim = dimensions[i] || { width: 595.28, height: 841.89, rotation: 0 };
      this.pages.push({
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        originalIndex: i,
        pageNumber: i + 1,
        rotation: dim.rotation || 0,
        isDeleted: false,
        width: dim.width,
        height: dim.height
      });
    }
    this.notify();
  }

  public getPages(): PageItem[] {
    return this.pages.filter(p => !p.isDeleted);
  }

  public getAllPages(): PageItem[] {
    return [...this.pages];
  }

  public getPageCount(): number {
    return this.getPages().length;
  }

  public movePage(fromIndex: number, toIndex: number, trackHistory: boolean = true): void {
    const active = this.getPages();
    if (fromIndex < 0 || fromIndex >= active.length || toIndex < 0 || toIndex >= active.length) {
      return;
    }

    const previousPages = [...this.pages];

    const doMove = (from: number, to: number) => {
      const activeList = this.getPages();
      const [item] = activeList.splice(from, 1);
      activeList.splice(to, 0, item);
      this.pages = activeList;
      this.recomputePageNumbers();
      this.notify();
    };

    if (trackHistory) {
      this.history.execute({
        description: `Move page ${fromIndex + 1} to ${toIndex + 1}`,
        execute: () => doMove(fromIndex, toIndex),
        undo: () => {
          this.pages = previousPages;
          this.notify();
        }
      });
    } else {
      doMove(fromIndex, toIndex);
    }
  }

  public rotatePage(index: number, deltaDegrees: number, trackHistory: boolean = true): void {
    const active = this.getPages();
    if (index < 0 || index >= active.length) return;
    const page = active[index];
    const prevRotation = page.rotation;
    const newRotation = (prevRotation + deltaDegrees + 360) % 360;

    if (trackHistory) {
      this.history.execute({
        description: `Rotate page ${index + 1} by ${deltaDegrees}°`,
        execute: () => {
          page.rotation = newRotation;
          this.notify();
        },
        undo: () => {
          page.rotation = prevRotation;
          this.notify();
        }
      });
    } else {
      page.rotation = newRotation;
      this.notify();
    }
  }

  public rotateAll(deltaDegrees: number, trackHistory: boolean = true): void {
    const active = this.getPages();
    const prevRotations = active.map(p => p.rotation);

    if (trackHistory) {
      this.history.execute({
        description: `Rotate all pages by ${deltaDegrees}°`,
        execute: () => {
          active.forEach(p => {
            p.rotation = (p.rotation + deltaDegrees + 360) % 360;
          });
          this.notify();
        },
        undo: () => {
          active.forEach((p, i) => {
            p.rotation = prevRotations[i];
          });
          this.notify();
        }
      });
    } else {
      active.forEach(p => {
        p.rotation = (p.rotation + deltaDegrees + 360) % 360;
      });
      this.notify();
    }
  }

  public deletePage(index: number, trackHistory: boolean = true): void {
    const active = this.getPages();
    if (active.length <= 1) {
      throw new Error('A document must contain at least one page');
    }
    if (index < 0 || index >= active.length) return;
    const page = active[index];

    if (trackHistory) {
      this.history.execute({
        description: `Delete page ${index + 1}`,
        execute: () => {
          page.isDeleted = true;
          this.recomputePageNumbers();
          this.notify();
        },
        undo: () => {
          page.isDeleted = false;
          this.recomputePageNumbers();
          this.notify();
        }
      });
    } else {
      page.isDeleted = true;
      this.recomputePageNumbers();
      this.notify();
    }
  }

  public insertBlankPage(
    atIndex: number,
    width: number = 595.28,
    height: number = 841.89,
    trackHistory: boolean = true
  ): void {
    const newPage: PageItem = {
      id: 'blank_' + Math.random().toString(36).substring(2, 9),
      originalIndex: -1,
      pageNumber: atIndex + 1,
      rotation: 0,
      isDeleted: false,
      isBlank: true,
      width,
      height
    };

    const previousPages = [...this.pages];

    const doInsert = () => {
      const active = this.getPages();
      const insertAt = Math.max(0, Math.min(atIndex, active.length));
      active.splice(insertAt, 0, newPage);
      this.pages = active;
      this.recomputePageNumbers();
      this.notify();
    };

    if (trackHistory) {
      this.history.execute({
        description: `Insert blank page at ${atIndex + 1}`,
        execute: () => doInsert(),
        undo: () => {
          this.pages = previousPages;
          this.notify();
        }
      });
    } else {
      doInsert();
    }
  }

  public appendDocumentPages(
    sourceDocId: string,
    pageCount: number,
    dimensions: { width: number; height: number; rotation: number }[],
    trackHistory: boolean = true
  ): void {
    const newItems: PageItem[] = [];
    for (let i = 0; i < pageCount; i++) {
      const dim = dimensions[i] || { width: 595.28, height: 841.89, rotation: 0 };
      newItems.push({
        id: `m_${sourceDocId}_${i}`,
        originalIndex: i,
        pageNumber: 0,
        rotation: dim.rotation || 0,
        isDeleted: false,
        sourceDocId,
        width: dim.width,
        height: dim.height
      });
    }

    const previousPages = [...this.pages];

    const doAppend = () => {
      this.pages.push(...newItems);
      this.recomputePageNumbers();
      this.notify();
    };

    if (trackHistory) {
      this.history.execute({
        description: `Append ${pageCount} pages from external document`,
        execute: () => doAppend(),
        undo: () => {
          this.pages = previousPages;
          this.notify();
        }
      });
    } else {
      doAppend();
    }
  }

  private recomputePageNumbers(): void {
    const active = this.getPages();
    active.forEach((p, idx) => {
      p.pageNumber = idx + 1;
    });
  }

  public static parsePageRange(rangeStr: string, maxPages: number): number[] {
    const indices = new Set<number>();
    const parts = rangeStr.split(/[,;\s]+/);

    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;

      if (clean.includes('-')) {
        const [startStr, endStr] = clean.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(maxPages, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            indices.add(p - 1);
          }
        }
      } else {
        const single = parseInt(clean, 10);
        if (!isNaN(single) && single >= 1 && single <= maxPages) {
          indices.add(single - 1);
        }
      }
    }

    return Array.from(indices).sort((a, b) => a - b);
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      l();
    }
  }
}
