import { AnnotationManager } from '../annotations/manager';
import { HighlightAnnotation, MarkupAnnotation } from '../types/annotations';
import { NotificationService } from './notification';

export interface TextSelectionMenuOptions {
  annotationManager?: AnnotationManager;
  getAnnotationManager?: () => AnnotationManager;
  getScale: () => number;
}

export class TextSelectionMenu {
  private menuEl: HTMLElement;
  private options: TextSelectionMenuOptions;
  private currentSelectionRects: { x: number; y: number; width: number; height: number }[] = [];
  private currentPageIndex: number = 0;
  private selectedText: string = '';

  constructor(options: TextSelectionMenuOptions) {
    this.options = options;
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'text-selection-popup';
    this.menuEl.style.display = 'none';
    this.menuEl.style.position = 'fixed';
    this.menuEl.style.zIndex = '50';
    document.body.appendChild(this.menuEl);

    this.render();
    this.attachEvents();
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

  private render(): void {
    this.menuEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; background: rgba(30, 41, 59, 0.95); backdrop-filter: blur(8px); padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: var(--shadow-lg);">
        <button class="icon-btn text-act-btn" data-action="highlight" data-color="#ffeb3b" title="Highlight Yellow" aria-label="Highlight Yellow" style="width: 28px; height: 28px;">
          <span style="display: block; width: 14px; height: 14px; background: #ffeb3b; border-radius: 50%;"></span>
        </button>
        <button class="icon-btn text-act-btn" data-action="highlight" data-color="#69f0ae" title="Highlight Green" aria-label="Highlight Green" style="width: 28px; height: 28px;">
          <span style="display: block; width: 14px; height: 14px; background: #69f0ae; border-radius: 50%;"></span>
        </button>
        <button class="icon-btn text-act-btn" data-action="highlight" data-color="#ff80ab" title="Highlight Pink" aria-label="Highlight Pink" style="width: 28px; height: 28px;">
          <span style="display: block; width: 14px; height: 14px; background: #ff80ab; border-radius: 50%;"></span>
        </button>
        <div style="width: 1px; height: 18px; background: var(--border-color);"></div>
        <button class="icon-btn text-act-btn" data-action="underline" title="Underline" aria-label="Underline" style="width: 28px; height: 28px; font-weight: bold; text-decoration: underline; font-size: 0.85rem;">
          U
        </button>
        <button class="icon-btn text-act-btn" data-action="strikeout" title="Strikethrough" aria-label="Strikethrough" style="width: 28px; height: 28px; font-weight: bold; text-decoration: line-through; font-size: 0.85rem;">
          S
        </button>
        <div style="width: 1px; height: 18px; background: var(--border-color);"></div>
        <button class="icon-btn text-act-btn" data-action="copy" title="Copy Text" aria-label="Copy Text" style="width: 28px; height: 28px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
    `;

    this.menuEl.querySelectorAll('.text-act-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const color = btn.getAttribute('data-color') || '#ffeb3b';
        this.executeAction(action, color);
      });
    });
  }

  private attachEvents(): void {
    document.addEventListener('mouseup', () => {
      setTimeout(() => this.checkSelection(), 10);
    });

    document.addEventListener('touchend', () => {
      setTimeout(() => this.checkSelection(), 60);
    });

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        this.hide();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.menuEl.contains(e.target as Node)) {
        this.hide();
      }
    });

    document.addEventListener('touchstart', (e) => {
      if (!this.menuEl.contains(e.target as Node)) {
        this.hide();
      }
    }, { passive: true });
  }

  private checkSelection(): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      this.hide();
      return;
    }

    const text = sel.toString().trim();
    if (text.length === 0) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      this.hide();
      return;
    }

    // Find the enclosing page container
    let node: Node | null = range.commonAncestorContainer;
    let pageEl: HTMLElement | null = null;
    while (node && node !== document.body) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList.contains('page-container')) {
          pageEl = el;
          break;
        }
      }
      node = node.parentNode;
    }

    if (!pageEl) {
      this.hide();
      return;
    }

    const pageNum = parseInt(pageEl.getAttribute('data-page') || '1', 10);
    this.currentPageIndex = pageNum - 1;
    this.selectedText = text;

    const pageRect = pageEl.getBoundingClientRect();
    const scale = this.options.getScale();

    // Map range client rects to page coordinates
    const clientRects = Array.from(range.getClientRects());
    this.currentSelectionRects = clientRects.map((cr) => ({
      x: (cr.left - pageRect.left) / scale,
      y: (cr.top - pageRect.top) / scale,
      width: cr.width / scale,
      height: cr.height / scale
    }));

    // Position floating popup directly centered above selection (or below if near top)
    const popupLeft = Math.max(16, Math.min(window.innerWidth - 240, rect.left + rect.width / 2 - 110));
    let popupTop = rect.top - 46;
    if (popupTop < 65) {
      popupTop = rect.bottom + 10;
    }

    this.menuEl.style.left = `${popupLeft}px`;
    this.menuEl.style.top = `${popupTop}px`;
    this.menuEl.style.display = 'block';
  }

  private executeAction(action: string | null, color: string): void {
    if (!action) return;

    if (action === 'copy') {
      navigator.clipboard?.writeText(this.selectedText);
      NotificationService.show(`Copied ${this.selectedText.length} characters to clipboard`);
      this.hide();
      window.getSelection()?.removeAllRanges();
      return;
    }

    if (this.currentSelectionRects.length === 0) {
      this.hide();
      return;
    }

    const id = 'txt_' + Math.random().toString(36).substring(2, 9);
    const now = Date.now();

    if (action === 'highlight') {
      const ann: HighlightAnnotation = {
        id,
        type: 'highlight',
        pageIndex: this.currentPageIndex,
        rects: this.currentSelectionRects,
        color,
        opacity: 0.4,
        createdAt: now,
        updatedAt: now
      };
      this.getManager().addAnnotation(ann);
      NotificationService.show('Highlight added!');
    } else if (action === 'underline' || action === 'strikeout') {
      const ann: MarkupAnnotation = {
        id,
        type: action,
        pageIndex: this.currentPageIndex,
        rects: this.currentSelectionRects,
        color: action === 'strikeout' ? '#ef4444' : '#2563eb',
        strokeWidth: 2,
        createdAt: now,
        updatedAt: now
      };
      this.getManager().addAnnotation(ann);
      NotificationService.show(`${action === 'underline' ? 'Underline' : 'Strikeout'} added!`);
    }

    window.getSelection()?.removeAllRanges();
    this.hide();
  }

  public hide(): void {
    this.menuEl.style.display = 'none';
    this.currentSelectionRects = [];
  }
}
