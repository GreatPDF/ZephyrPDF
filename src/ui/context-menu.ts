import { AnnotationManager } from '../annotations/manager';
import { Annotation } from '../types/annotations';
import { NotificationService } from './notification';

export interface ContextMenuOptions {
  annotationManager?: AnnotationManager;
  getAnnotationManager?: () => AnnotationManager;
  onRefresh?: () => void;
}

export class AnnotationContextMenu {
  private menuEl: HTMLElement;
  private options: ContextMenuOptions;
  private targetAnnotation: Annotation | null = null;

  constructor(options: ContextMenuOptions) {
    this.options = options;
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'annotation-context-menu';
    this.menuEl.style.position = 'fixed';
    this.menuEl.style.display = 'none';
    this.menuEl.style.zIndex = '1000';
    document.body.appendChild(this.menuEl);

    window.addEventListener('mousedown', (e) => {
      if (!this.menuEl.contains(e.target as Node)) {
        this.hide();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.menuEl.style.display !== 'none') {
        this.hide();
      }
    });
  }

  public setAnnotationManager(manager: AnnotationManager): void {
    this.options.annotationManager = manager;
  }

  private getManager(): AnnotationManager {
    if (this.options.getAnnotationManager) {
      return this.options.getAnnotationManager();
    }
    return this.options.annotationManager!;
  }

  public show(ann: Annotation, x: number, y: number): void {
    this.targetAnnotation = ann;
    this.getManager().selectAnnotation(ann.id);
    this.render();

    // Adjust position to stay inside viewport
    const menuWidth = 190;
    const menuHeight = 240;
    const posX = Math.min(x, window.innerWidth - menuWidth - 10);
    const posY = Math.min(y, window.innerHeight - menuHeight - 10);

    this.menuEl.style.left = `${posX}px`;
    this.menuEl.style.top = `${posY}px`;
    this.menuEl.style.display = 'block';
  }

  public hide(): void {
    this.menuEl.style.display = 'none';
    this.targetAnnotation = null;
  }

  private render(): void {
    if (!this.targetAnnotation) return;
    const isText = this.targetAnnotation.type === 'text';

    this.menuEl.innerHTML = `
      <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow-lg); padding: 4px; min-width: 180px; font-size: 0.85rem; color: var(--text-primary); display: flex; flex-direction: column; gap: 2px;">
        <button class="ctx-item" id="ctx-duplicate" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: none; border: none; border-radius: 4px; color: var(--text-primary); cursor: pointer; text-align: left; width: 100%;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Duplicate</span>
        </button>
        <button class="ctx-item" id="ctx-scale-up" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: none; border: none; border-radius: 4px; color: var(--text-primary); cursor: pointer; text-align: left; width: 100%;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          <span>Scale Larger (+25%)</span>
        </button>
        <button class="ctx-item" id="ctx-scale-down" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: none; border: none; border-radius: 4px; color: var(--text-primary); cursor: pointer; text-align: left; width: 100%;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          <span>Scale Smaller (-25%)</span>
        </button>

        ${
          isText
            ? `
          <div style="height: 1px; background: var(--border-color); margin: 2px 0;"></div>
          <div style="padding: 2px 10px; font-size: 0.75rem; color: var(--text-secondary);">Font Size:</div>
          <div style="display: flex; gap: 4px; padding: 2px 10px 4px;">
            <button class="btn ctx-font-size-btn" data-size="10" style="padding: 2px 6px; font-size: 0.75rem; height: 22px;">10</button>
            <button class="btn ctx-font-size-btn" data-size="14" style="padding: 2px 6px; font-size: 0.75rem; height: 22px;">14</button>
            <button class="btn ctx-font-size-btn" data-size="18" style="padding: 2px 6px; font-size: 0.75rem; height: 22px;">18</button>
            <button class="btn ctx-font-size-btn" data-size="24" style="padding: 2px 6px; font-size: 0.75rem; height: 22px;">24</button>
          </div>
          `
            : ''
        }

        <div style="height: 1px; background: var(--border-color); margin: 2px 0;"></div>
        <div style="padding: 2px 10px; font-size: 0.75rem; color: var(--text-secondary);">Change Color:</div>
        <div style="display: flex; gap: 6px; padding: 2px 10px 6px;">
          <button type="button" class="ctx-color-swatch" data-color="#ffeb3b" aria-label="Yellow" style="width: 18px; height: 18px; border-radius: 50%; background: #ffeb3b; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); padding: 0;"></button>
          <button type="button" class="ctx-color-swatch" data-color="#69f0ae" aria-label="Green" style="width: 18px; height: 18px; border-radius: 50%; background: #69f0ae; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); padding: 0;"></button>
          <button type="button" class="ctx-color-swatch" data-color="#40c4ff" aria-label="Blue" style="width: 18px; height: 18px; border-radius: 50%; background: #40c4ff; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); padding: 0;"></button>
          <button type="button" class="ctx-color-swatch" data-color="#ff80ab" aria-label="Pink" style="width: 18px; height: 18px; border-radius: 50%; background: #ff80ab; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); padding: 0;"></button>
          <button type="button" class="ctx-color-swatch" data-color="#d32f2f" aria-label="Red" style="width: 18px; height: 18px; border-radius: 50%; background: #d32f2f; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); padding: 0;"></button>
          <button type="button" class="ctx-color-swatch" data-color="#212121" aria-label="Black" style="width: 18px; height: 18px; border-radius: 50%; background: #212121; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); padding: 0;"></button>
        </div>
        <div style="height: 1px; background: var(--border-color); margin: 2px 0;"></div>
        <button class="ctx-item" id="ctx-delete" style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: none; border: none; border-radius: 4px; color: var(--danger-color); cursor: pointer; text-align: left; width: 100%;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>Delete Item</span>
        </button>
      </div>
    `;

    this.menuEl.querySelectorAll('.ctx-item').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
      });
      btn.addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.backgroundColor = 'transparent';
      });
    });

    this.attachEvents();
  }

  private attachEvents(): void {
    const duplicateBtn = this.menuEl.querySelector('#ctx-duplicate');
    const scaleUpBtn = this.menuEl.querySelector('#ctx-scale-up');
    const scaleDownBtn = this.menuEl.querySelector('#ctx-scale-down');
    const deleteBtn = this.menuEl.querySelector('#ctx-delete');

    duplicateBtn?.addEventListener('click', () => {
      if (!this.targetAnnotation) return;
      const copy = {
        ...this.targetAnnotation,
        id: 'dup_' + Math.random().toString(36).substring(2, 9),
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as any;

      if ('x' in copy && 'y' in copy) {
        copy.x += 20;
        copy.y += 20;
      }
      this.getManager().addAnnotation(copy);
      NotificationService.show('Item duplicated!');
      this.hide();
    });

    scaleUpBtn?.addEventListener('click', () => {
      if (!this.targetAnnotation) return;
      this.scaleItem(1.25);
      this.hide();
    });

    scaleDownBtn?.addEventListener('click', () => {
      if (!this.targetAnnotation) return;
      this.scaleItem(0.8);
      this.hide();
    });

    deleteBtn?.addEventListener('click', () => {
      if (!this.targetAnnotation) return;
      this.getManager().removeAnnotation(this.targetAnnotation.id);
      NotificationService.show('Item deleted!');
      this.hide();
    });

    this.menuEl.querySelectorAll('.ctx-font-size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.targetAnnotation) return;
        const size = parseInt(btn.getAttribute('data-size') || '14', 10);
        this.getManager().updateAnnotation(this.targetAnnotation.id, {
          fontSize: size
        } as any);
        NotificationService.show(`Font size set to ${size}pt`);
        this.hide();
      });
    });

    this.menuEl.querySelectorAll('.ctx-color-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        if (!this.targetAnnotation) return;
        const color = swatch.getAttribute('data-color');
        if (color) {
          const updates: any = {};
          if ('color' in this.targetAnnotation) updates.color = color;
          if ('strokeColor' in this.targetAnnotation) updates.strokeColor = color;
          this.getManager().updateAnnotation(this.targetAnnotation.id, updates);
          NotificationService.show('Color updated!');
        }
        this.hide();
      });
    });
  }

  private scaleItem(factor: number): void {
    if (!this.targetAnnotation) return;
    const ann = this.targetAnnotation;
    const updates: any = {};

    if ('width' in ann && 'height' in ann) {
      updates.width = Math.round(ann.width * factor);
      updates.height = Math.round(ann.height * factor);
    }
    if ('fontSize' in ann) {
      updates.fontSize = Math.round((ann as any).fontSize * factor);
    }

    this.getManager().updateAnnotation(ann.id, updates);
    NotificationService.show(`Resized by ${Math.round(factor * 100)}%`);
  }
}
