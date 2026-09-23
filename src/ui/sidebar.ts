import { OutlineItem, SearchMatch } from '../types/document';
import { Annotation } from '../types/annotations';

export interface SidebarEvents {
  onPageSelect: (pageNumber: number) => void;
  onAnnotationSelect: (id: string, pageNumber: number) => void;
  onAnnotationDelete: (id: string) => void;
  onSearch: (query: string, caseSensitive: boolean, matchWholeWords: boolean) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onExportCitations?: () => void;
  onExportAnnotationReport?: () => void;
}

export class AppSidebar {
  private container: HTMLElement;
  private events: SidebarEvents;
  private activeTab: 'thumbnails' | 'outline' | 'annotations' | 'search' = 'thumbnails';
  private currentPage: number = 1;

  constructor(container: HTMLElement, events: SidebarEvents) {
    this.container = container;
    this.events = events;
    this.render();
  }

  public getActiveTab(): string {
    return this.activeTab;
  }

  public setThumbnails(thumbnails: { pageNumber: number; dataUrl: string }[]): void {
    const list = this.container.querySelector('#sidebar-thumbnails-list');
    if (!list) return;

    list.innerHTML = '';
    for (const thumb of thumbnails) {
      const item = document.createElement('div');
      item.className = `thumbnail-item ${thumb.pageNumber === this.currentPage ? 'active' : ''}`;
      item.setAttribute('data-page', thumb.pageNumber.toString());

      item.innerHTML = `
        <div class="thumbnail-image-wrapper">
          <img class="thumbnail-image" src="${thumb.dataUrl}" alt="Page ${thumb.pageNumber}" />
        </div>
        <span class="thumbnail-label">Page ${thumb.pageNumber}</span>
      `;

      item.addEventListener('click', () => {
        this.setCurrentPage(thumb.pageNumber);
        this.events.onPageSelect(thumb.pageNumber);
      });

      list.appendChild(item);
    }
  }

  public setOutline(outline: OutlineItem[]): void {
    const wrapper = this.container.querySelector('#sidebar-outline-content');
    if (!wrapper) return;

    if (outline.length === 0) {
      wrapper.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 0.85rem;">No bookmarks in this document.</div>`;
      return;
    }

    wrapper.innerHTML = '';
    const tree = document.createElement('ul');
    tree.className = 'outline-tree';

    const renderItems = (items: OutlineItem[], parentEl: HTMLElement) => {
      for (const it of items) {
        const li = document.createElement('li');
        li.className = 'outline-item';
        li.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"></path></svg>
          <span>${it.title}</span>
          ${it.pageNumber ? `<span style="margin-left: auto; font-size: 0.75rem; color: var(--text-muted);">p.${it.pageNumber}</span>` : ''}
        `;

        li.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.pageNumber) {
            this.setCurrentPage(it.pageNumber);
            this.events.onPageSelect(it.pageNumber);
          }
        });

        parentEl.appendChild(li);

        if (it.children && it.children.length > 0) {
          const subUl = document.createElement('ul');
          subUl.style.listStyle = 'none';
          subUl.style.paddingLeft = '16px';
          renderItems(it.children, subUl);
          parentEl.appendChild(subUl);
        }
      }
    };

    renderItems(outline, tree);
    wrapper.appendChild(tree);
  }

  public setAnnotations(annotations: Annotation[]): void {
    const list = this.container.querySelector('#sidebar-annotations-list');
    if (!list) return;

    if (annotations.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 0.85rem;">No annotations added yet.</div>`;
      return;
    }

    list.innerHTML = '';
    for (const ann of annotations) {
      const card = document.createElement('div');
      card.className = 'annotation-card';
      const pageNum = ann.pageIndex + 1;

      let label = ann.type.toUpperCase();
      if (ann.type === 'text') label = `Text: "${ann.text.substring(0, 15)}..."`;
      if (ann.type === 'stamp') label = `Stamp: ${ann.stampType}`;

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">${label}</span>
          <span style="font-size: 0.7rem; color: var(--text-muted);">Page ${pageNum}</span>
        </div>
        <button class="icon-btn del-ann-btn" title="Delete" style="width: 24px; height: 24px; color: var(--danger-color);">✕</button>
      `;

      card.addEventListener('click', () => {
        this.events.onAnnotationSelect(ann.id, pageNum);
      });

      const delBtn = card.querySelector('.del-ann-btn');
      delBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events.onAnnotationDelete(ann.id);
      });

      list.appendChild(card);
    }
  }

  public setSearchResults(matches: SearchMatch[], currentIndex: number): void {
    const countEl = this.container.querySelector('#search-count-label');
    if (countEl) {
      countEl.textContent = matches.length > 0 ? `${currentIndex + 1} of ${matches.length}` : '0 matches';
    }
  }

  public setCurrentPage(pageNumber: number): void {
    this.currentPage = pageNumber;
    this.container.querySelectorAll('.thumbnail-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-page') === pageNumber.toString());
    });
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="sidebar-tabs">
        <div class="sidebar-tab active" data-tab="thumbnails" title="Page Thumbnails">Pages</div>
        <div class="sidebar-tab" data-tab="outline" title="Document Bookmarks">Bookmarks</div>
        <div class="sidebar-tab" data-tab="annotations" title="Annotations List">Markup</div>
        <div class="sidebar-tab" data-tab="search" title="Search Text">Search</div>
      </div>

      <div class="sidebar-content">
        <!-- Thumbnails Tab -->
        <div id="tab-pane-thumbnails" style="display: block;">
          <div class="thumbnail-list" id="sidebar-thumbnails-list">
            <div style="color: var(--text-muted); font-size: 0.8rem; padding: 20px;">No document loaded</div>
          </div>
        </div>

        <!-- Bookmarks Tab -->
        <div id="tab-pane-outline" style="display: none;">
          <div id="sidebar-outline-content"></div>
        </div>

        <!-- Annotations Tab -->
        <div id="tab-pane-annotations" style="display: none;">
          <button class="btn" id="export-annotation-report-btn" style="height: 28px; font-size: 0.75rem; width: 100%; margin-bottom: 8px;">
            📋 Export Summary Report (.md)
          </button>
          <div class="annotations-list" id="sidebar-annotations-list">
            <div style="color: var(--text-muted); font-size: 0.8rem; padding: 20px;">No annotations</div>
          </div>
        </div>

        <!-- Search Tab -->
        <div id="tab-pane-search" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 6px;">
              <input type="text" id="sidebar-search-input" class="search-input" placeholder="Search document..." style="flex: 1; width: 100%;" />
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span id="search-count-label" style="font-size: 0.75rem; color: var(--text-muted);">0 matches</span>
              <div style="display: flex; gap: 4px;">
                <button class="icon-btn" id="search-prev-btn" style="width: 28px; height: 28px;" title="Previous Match">▲</button>
                <button class="icon-btn" id="search-next-btn" style="width: 28px; height: 28px;" title="Next Match">▼</button>
              </div>
            </div>
            <button class="btn" id="export-search-citations-btn" style="height: 28px; font-size: 0.75rem; width: 100%; margin-top: 4px;">
              📋 Export Citations (.md)
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  }

  private setupListeners(): void {
    const tabs = this.container.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(other => other.classList.remove('active'));
        t.classList.add('active');
        const tabName = t.getAttribute('data-tab') as any;
        this.activeTab = tabName;

        ['thumbnails', 'outline', 'annotations', 'search'].forEach(p => {
          const pane = this.container.querySelector('#tab-pane-' + p) as HTMLElement;
          if (pane) {
            pane.style.display = p === tabName ? 'block' : 'none';
          }
        });
      });
    });

    const searchInput = this.container.querySelector('#sidebar-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.events.onSearch(searchInput.value, false, false);
    });

    const prevBtn = this.container.querySelector('#search-prev-btn');
    const nextBtn = this.container.querySelector('#search-next-btn');
    const exportCitationsBtn = this.container.querySelector('#export-search-citations-btn');

    prevBtn?.addEventListener('click', () => this.events.onSearchPrevious());
    nextBtn?.addEventListener('click', () => this.events.onSearchNext());
    exportCitationsBtn?.addEventListener('click', () => {
      if (this.events.onExportCitations) this.events.onExportCitations();
    });

    const exportReportBtn = this.container.querySelector('#export-annotation-report-btn');
    exportReportBtn?.addEventListener('click', () => {
      if (this.events.onExportAnnotationReport) this.events.onExportAnnotationReport();
    });
  }
}
