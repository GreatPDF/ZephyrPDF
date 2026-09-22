import { PageManager } from '../organizer/page-manager';
import { PageItem } from '../types/organizer';

export interface OrganizerEvents {
  onApply: () => void;
  onClose: () => void;
}

export class OrganizerModal {
  private overlay: HTMLElement | null = null;
  private pageManager: PageManager;
  private thumbnails: Map<number, string>;
  private events: OrganizerEvents;
  private draggedPageIndex: number | null = null;

  constructor(
    pageManager: PageManager,
    thumbnails: Map<number, string>,
    events: OrganizerEvents
  ) {
    this.pageManager = pageManager;
    this.thumbnails = thumbnails;
    this.events = events;
  }

  public open(): void {
    this.render();
  }

  public close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.events.onClose();
  }

  private render(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'organizer-overlay';

    this.overlay.innerHTML = `
      <div class="organizer-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <h2 style="font-size: 1.25rem; font-weight: 600;">Page Organizer</h2>
          <span style="font-size: 0.85rem; color: var(--text-muted);" id="org-page-count">${this.pageManager.getPageCount()} pages</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn" id="org-rotate-all-btn">Rotate All 90°</button>
          <button class="btn" id="org-add-blank-btn">+ Add Blank Page</button>
          <button class="btn btn-primary" id="org-apply-btn">Apply & Return to Reader</button>
        </div>
      </div>
      <div class="organizer-grid" id="org-grid"></div>
    `;

    document.body.appendChild(this.overlay);

    this.setupListeners();
    this.renderGrid();
  }

  private renderGrid(): void {
    const grid = this.overlay?.querySelector('#org-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const pages = this.pageManager.getPages();

    const countEl = this.overlay?.querySelector('#org-page-count');
    if (countEl) countEl.textContent = `${pages.length} pages`;

    pages.forEach((page: PageItem, index: number) => {
      const card = document.createElement('div');
      card.className = 'organizer-card';
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-index', index.toString());

      const thumbUrl = this.thumbnails.get(page.originalIndex) || '';

      card.innerHTML = `
        <div style="width: 140px; height: 180px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 4px; overflow: hidden; box-shadow: var(--shadow-sm); transform: rotate(${page.rotation}deg); transition: transform 0.2s ease;">
          ${page.isBlank ? '<div style="color: #999; font-size: 0.85rem;">[Blank Page]</div>' : `<img src="${thumbUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`}
        </div>
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Page ${index + 1}</span>
        <div class="organizer-card-actions">
          <button class="icon-btn rot-left-btn" title="Rotate 90° CCW" style="width: 28px; height: 28px;">↺</button>
          <button class="icon-btn rot-right-btn" title="Rotate 90° CW" style="width: 28px; height: 28px;">↻</button>
          <button class="icon-btn del-btn" title="Delete Page" style="width: 28px; height: 28px; color: var(--danger-color);">✕</button>
        </div>
      `;

      // Drag & Drop reordering
      card.addEventListener('dragstart', (e) => {
        this.draggedPageIndex = index;
        card.style.opacity = '0.5';
        e.dataTransfer?.setData('text/plain', index.toString());
      });

      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
        this.draggedPageIndex = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.style.borderColor = 'var(--accent-color)';
      });

      card.addEventListener('dragleave', () => {
        card.style.borderColor = 'var(--border-color)';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.style.borderColor = 'var(--border-color)';
        if (this.draggedPageIndex !== null && this.draggedPageIndex !== index) {
          this.pageManager.movePage(this.draggedPageIndex, index);
          this.renderGrid();
        }
      });

      // Actions
      const rotLeft = card.querySelector('.rot-left-btn');
      rotLeft?.addEventListener('click', () => {
        this.pageManager.rotatePage(index, -90);
        this.renderGrid();
      });

      const rotRight = card.querySelector('.rot-right-btn');
      rotRight?.addEventListener('click', () => {
        this.pageManager.rotatePage(index, 90);
        this.renderGrid();
      });

      const delBtn = card.querySelector('.del-btn');
      delBtn?.addEventListener('click', () => {
        if (this.pageManager.getPages().length <= 1) {
          alert('Cannot delete the only page in the document.');
          return;
        }
        this.pageManager.deletePage(index);
        this.renderGrid();
      });

      grid.appendChild(card);
    });
  }

  private setupListeners(): void {
    const applyBtn = this.overlay?.querySelector('#org-apply-btn');
    applyBtn?.addEventListener('click', () => {
      this.events.onApply();
      this.close();
    });

    const addBlankBtn = this.overlay?.querySelector('#org-add-blank-btn');
    addBlankBtn?.addEventListener('click', () => {
      const count = this.pageManager.getPageCount();
      this.pageManager.insertBlankPage(count);
      this.renderGrid();
    });

    const rotateAllBtn = this.overlay?.querySelector('#org-rotate-all-btn');
    rotateAllBtn?.addEventListener('click', () => {
      this.pageManager.rotateAll(90);
      this.renderGrid();
    });
  }
}
