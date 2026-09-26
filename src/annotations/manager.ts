import { Annotation } from '../types/annotations';
import { HistoryManager } from '../core/history';

export class AnnotationManager {
  private annotations: Map<string, Annotation> = new Map();
  private selectedId: string | null = null;
  private history: HistoryManager;
  private listeners: Array<() => void> = [];

  constructor(history: HistoryManager) {
    this.history = history;
  }

  public addAnnotation(annotation: Annotation, trackHistory: boolean = true): void {
    if (trackHistory) {
      this.history.execute({
        description: `Add ${annotation.type} annotation`,
        execute: () => {
          this.annotations.set(annotation.id, annotation);
          this.notify();
        },
        undo: () => {
          this.annotations.delete(annotation.id);
          if (this.selectedId === annotation.id) this.selectedId = null;
          this.notify();
        }
      });
    } else {
      this.annotations.set(annotation.id, annotation);
      this.notify();
    }
  }

  public updateAnnotation(
    id: string,
    updates: Partial<Annotation>,
    trackHistory: boolean = true
  ): void {
    const existing = this.annotations.get(id);
    if (!existing) return;

    const previous = { ...existing } as Annotation;
    const updated = { ...existing, ...updates, updatedAt: Date.now() } as Annotation;

    if (trackHistory) {
      this.history.execute({
        description: `Update ${existing.type} annotation`,
        execute: () => {
          this.annotations.set(id, updated);
          this.notify();
        },
        undo: () => {
          this.annotations.set(id, previous);
          this.notify();
        }
      });
    } else {
      this.annotations.set(id, updated);
      this.notify();
    }
  }

  public removeAnnotation(id: string, trackHistory: boolean = true): void {
    const existing = this.annotations.get(id);
    if (!existing) return;

    if (trackHistory) {
      this.history.execute({
        description: `Delete ${existing.type} annotation`,
        execute: () => {
          this.annotations.delete(id);
          if (this.selectedId === id) this.selectedId = null;
          this.notify();
        },
        undo: () => {
          this.annotations.set(id, existing);
          this.notify();
        }
      });
    } else {
      this.annotations.delete(id);
      if (this.selectedId === id) this.selectedId = null;
      this.notify();
    }
  }

  public getAnnotation(id: string): Annotation | undefined {
    return this.annotations.get(id);
  }

  public getAnnotationsForPage(pageIndex: number): Annotation[] {
    const list: Annotation[] = [];
    for (const ann of this.annotations.values()) {
      if (ann.pageIndex === pageIndex) {
        list.push(ann);
      }
    }
    return list;
  }

  public getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  public selectAnnotation(id: string | null): void {
    if (this.selectedId !== id) {
      this.selectedId = id;
      this.notify();
    }
  }

  public getSelectedId(): string | null {
    return this.selectedId;
  }

  public clearAll(trackHistory: boolean = true): void {
    const snapshot = Array.from(this.annotations.values());
    if (trackHistory) {
      this.history.execute({
        description: 'Clear all annotations',
        execute: () => {
          this.annotations.clear();
          this.selectedId = null;
          this.notify();
        },
        undo: () => {
          for (const item of snapshot) {
            this.annotations.set(item.id, item);
          }
          this.notify();
        }
      });
    } else {
      this.annotations.clear();
      this.selectedId = null;
      this.notify();
    }
  }

  public exportJson(): string {
    return JSON.stringify(this.getAllAnnotations(), null, 2);
  }

  public importJson(jsonStr: string, trackHistory: boolean = true): number {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Annotations file must contain a JSON array of annotations');
    }
    const validItems: Annotation[] = [];
    for (const item of parsed) {
      if (item && item.id && item.type) {
        validItems.push(item);
      }
    }
    if (validItems.length === 0) {
      return 0;
    }

    if (trackHistory) {
      const prevEntries = new Map<string, Annotation | undefined>();
      for (const item of validItems) {
        prevEntries.set(item.id, this.annotations.get(item.id));
      }
      this.history.execute({
        description: `Import ${validItems.length} annotation${validItems.length === 1 ? '' : 's'}`,
        execute: () => {
          for (const item of validItems) {
            this.annotations.set(item.id, item);
          }
          this.notify();
        },
        undo: () => {
          for (const [id, prev] of prevEntries.entries()) {
            if (prev) {
              this.annotations.set(id, prev);
            } else {
              this.annotations.delete(id);
              if (this.selectedId === id) this.selectedId = null;
            }
          }
          this.notify();
        }
      });
    } else {
      for (const item of validItems) {
        this.annotations.set(item.id, item);
      }
      this.notify();
    }
    return validItems.length;
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
