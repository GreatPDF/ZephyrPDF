import { DocumentDiffSummary } from '../../core/comparator';

export class CompareDialog {
  private backdrop: HTMLElement | null = null;
  private summary: DocumentDiffSummary;
  private currentPageIndex: number = 0;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    } else if (e.key === 'ArrowLeft') {
      if (this.currentPageIndex > 0) {
        this.currentPageIndex--;
        const card = this.backdrop?.querySelector('.modal-card') as HTMLElement;
        if (card) this.updatePage(card);
      }
    } else if (e.key === 'ArrowRight') {
      if (this.currentPageIndex < this.summary.pageDiffs.length - 1) {
        this.currentPageIndex++;
        const card = this.backdrop?.querySelector('.modal-card') as HTMLElement;
        if (card) this.updatePage(card);
      }
    }
  };

  constructor(summary: DocumentDiffSummary) {
    this.summary = summary;
  }

  public open(): void {
    this.render();
  }

  public close(): void {
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  private render(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '920px';
    card.style.height = '88vh';

    const totalPages = this.summary.pageDiffs.length;
    const currentDiff = this.summary.pageDiffs[this.currentPageIndex];

    card.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <h3 style="margin: 0; font-size: 1.15rem;">Document Comparison</h3>
          <span class="brand-badge" style="background: ${this.summary.changedPagesCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${this.summary.changedPagesCount > 0 ? '#ef4444' : '#10b981'};">
            ${this.summary.changedPagesCount} of ${totalPages} pages changed
          </span>
        </div>
        <button class="icon-btn" id="close-compare-btn" title="Close dialog" aria-label="Close dialog">✕</button>
      </div>

      <div style="padding: 10px 20px; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px; font-size: 0.85rem;">
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 2px;"></span>
            <span style="color: var(--text-secondary);">Red: Removed / Replaced</span>
          </span>
          <span style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 12px; height: 12px; background: #10b981; border-radius: 2px;"></span>
            <span style="color: var(--text-secondary);">Green: Added Content</span>
          </span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="icon-btn" id="prev-diff-page" title="Previous Page" aria-label="Previous Diff Page" style="width: 28px; height: 28px;">◀</button>
          <span style="font-size: 0.85rem; font-weight: 600;" id="diff-page-indicator">Page ${this.currentPageIndex + 1} of ${totalPages}</span>
          <button class="icon-btn" id="next-diff-page" title="Next Page" aria-label="Next Diff Page" style="width: 28px; height: 28px;">▶</button>
        </div>
      </div>

      <div class="modal-body" style="flex: 1; overflow: auto; display: flex; flex-direction: column; align-items: center; padding: 20px; background: var(--bg-canvas);" id="diff-view-area">
        ${
          currentDiff && currentDiff.diffImageDataUrl
            ? `<div style="background: white; box-shadow: var(--shadow-lg); border-radius: 4px; overflow: hidden; max-width: 100%;">
                 <img src="${currentDiff.diffImageDataUrl}" style="display: block; max-width: 100%; height: auto;" />
               </div>`
            : `<div style="color: var(--text-muted); padding: 40px;">No differences detected on this page.</div>`
        }
      </div>

      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; color: var(--text-muted);" id="diff-stats-label">
          ${currentDiff ? `Difference: ${currentDiff.diffPercent}% (${currentDiff.differingPixels.toLocaleString()} pixels)` : ''}
        </span>
        <button class="btn btn-primary" id="ok-compare-btn">Done</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.setupListeners(card);
  }

  private updatePage(card: HTMLElement): void {
    const totalPages = this.summary.pageDiffs.length;
    const currentDiff = this.summary.pageDiffs[this.currentPageIndex];

    const indicator = card.querySelector('#diff-page-indicator');
    if (indicator) indicator.textContent = `Page ${this.currentPageIndex + 1} of ${totalPages}`;

    const stats = card.querySelector('#diff-stats-label');
    if (stats) {
      stats.textContent = currentDiff
        ? `Difference: ${currentDiff.diffPercent}% (${currentDiff.differingPixels.toLocaleString()} pixels)`
        : '';
    }

    const area = card.querySelector('#diff-view-area');
    if (area) {
      area.innerHTML =
        currentDiff && currentDiff.diffImageDataUrl
          ? `<div style="background: white; box-shadow: var(--shadow-lg); border-radius: 4px; overflow: hidden; max-width: 100%;">
               <img src="${currentDiff.diffImageDataUrl}" style="display: block; max-width: 100%; height: auto;" />
             </div>`
          : `<div style="color: var(--text-muted); padding: 40px;">No differences detected on this page.</div>`;
    }
  }

  private setupListeners(card: HTMLElement): void {
    const closeBtn = card.querySelector('#close-compare-btn');
    const okBtn = card.querySelector('#ok-compare-btn');
    const prevBtn = card.querySelector('#prev-diff-page');
    const nextBtn = card.querySelector('#next-diff-page');

    closeBtn?.addEventListener('click', () => this.close());
    okBtn?.addEventListener('click', () => this.close());

    prevBtn?.addEventListener('click', () => {
      if (this.currentPageIndex > 0) {
        this.currentPageIndex--;
        this.updatePage(card);
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (this.currentPageIndex < this.summary.pageDiffs.length - 1) {
        this.currentPageIndex++;
        this.updatePage(card);
      }
    });
  }
}
