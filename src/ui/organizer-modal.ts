import { PageManager } from '../organizer/page-manager';
import { PageItem } from '../types/organizer';

export interface OrganizerEvents {
  onApply: () => void;
  onClose: () => void;
  onMergeFile?: (file: File) => Promise<void>;
  onExtractPages?: (indices: number[]) => Promise<void>;
}

export class OrganizerModal {
  private overlay: HTMLElement | null = null;
  private pageManager: PageManager;
  private thumbnails: Map<number, string>;
  private events: OrganizerEvents;
  private draggedPageIndex: number | null = null;
  private selectedIndices: Set<number> = new Set();

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
          <button class="btn" id="org-add-blank-btn">+ Blank Page</button>
          <button class="btn" id="org-merge-btn">📎 Merge PDF</button>
          <button class="btn" id="org-extract-btn" title="Extract selected pages into separate PDF">Extract Selected</button>
          <div style="display: flex; align-items: center; gap: 4px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 6px;">
            <input type="text" id="org-range-input" placeholder="Range: 1-3, 5" style="background: transparent; border: none; color: var(--text-primary); font-size: 0.8rem; width: 100px; outline: none;" />
            <button class="btn" id="org-range-btn" style="height: 26px; padding: 0 8px; font-size: 0.75rem;">Export</button>
          </div>
          <button class="btn btn-primary" id="org-apply-btn">Apply & Return</button>
        </div>
      </div>
      <div class="organizer-grid" id="org-grid"></div>
      <input type="file" id="org-merge-input" accept="application/pdf" style="display: none;" />
    `;

    document.body.appendChild(this.overlay);

    this.setupListeners();
    this.renderGrid();
  }

  public renderGrid(): void {
    const grid = this.overlay?.querySelector('#org-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const pages = this.pageManager.getPages();

    const countEl = this.overlay?.querySelector('#org-page-count');
    if (countEl) countEl.textContent = `${pages.length} pages`;

    pages.forEach((page: PageItem, index: number) => {
      const card = document.createElement('div');
      const isSelected = this.selectedIndices.has(index);
      card.className = `organizer-card ${isSelected ? 'active' : ''}`;
      if (isSelected) {
        card.style.borderColor = 'var(--accent-color)';
        card.style.backgroundColor = 'var(--accent-light)';
      }
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-index', index.toString());

      const thumbUrl = this.thumbnails.get(page.originalIndex) || '';

      card.innerHTML = `
        <div style="position: absolute; top: 10px; left: 10px; z-index: 2;">
          <input type="checkbox" class="org-select-check" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
        </div>
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

      // Select toggle
      const check = card.querySelector('.org-select-check') as HTMLInputElement;
      check?.addEventListener('change', () => {
        if (check.checked) this.selectedIndices.add(index);
        else this.selectedIndices.delete(index);
        this.renderGrid();
      });

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
        if (!this.selectedIndices.has(index)) {
          card.style.borderColor = 'var(--border-color)';
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!this.selectedIndices.has(index)) {
          card.style.borderColor = 'var(--border-color)';
        }
        if (this.draggedPageIndex !== null && this.draggedPageIndex !== index) {
          this.pageManager.movePage(this.draggedPageIndex, index);
          this.renderGrid();
        }
      });

      // Actions
      const rotLeft = card.querySelector('.rot-left-btn');
      rotLeft?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pageManager.rotatePage(index, -90);
        this.renderGrid();
      });

      const rotRight = card.querySelector('.rot-right-btn');
      rotRight?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pageManager.rotatePage(index, 90);
        this.renderGrid();
      });

      const delBtn = card.querySelector('.del-btn');
      delBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pageManager.getPages().length <= 1) {
          alert('Cannot delete the only page in the document.');
          return;
        }
        this.pageManager.deletePage(index);
        this.selectedIndices.delete(index);
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

    const mergeBtn = this.overlay?.querySelector('#org-merge-btn');
    const mergeInput = this.overlay?.querySelector('#org-merge-input') as HTMLInputElement;

    mergeBtn?.addEventListener('click', () => {
      mergeInput?.click();
    });

    mergeInput?.addEventListener('change', async () => {
      const file = mergeInput.files?.[0];
      if (file && this.events.onMergeFile) {
        await this.events.onMergeFile(file);
        this.renderGrid();
      }
    });

    const extractBtn = this.overlay?.querySelector('#org-extract-btn');
    extractBtn?.addEventListener('click', async () => {
      if (this.selectedIndices.size === 0) {
        alert('Please select at least one page checkbox to extract.');
        return;
      }
      if (this.events.onExtractPages) {
        await this.events.onExtractPages(Array.from(this.selectedIndices));
      }
    });

    const rangeBtn = this.overlay?.querySelector('#org-range-btn');
    const rangeInput = this.overlay?.querySelector('#org-range-input') as HTMLInputElement;
    rangeBtn?.addEventListener('click', async () => {
      const val = rangeInput?.value?.trim();
      if (!val) {
        alert('Please enter a page range, e.g. 1-3, 5');
        return;
      }
      const indices = PageManager.parsePageRange(val, this.pageManager.getPageCount());
      if (indices.length === 0) {
        alert('No valid pages found in specified range.');
        return;
      }
      if (this.events.onExtractPages) {
        await this.events.onExtractPages(indices);
      }
    });
  }
}
