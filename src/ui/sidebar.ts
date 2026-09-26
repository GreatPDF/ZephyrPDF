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
  onExportAnnotationJson?: () => void;
  onImportAnnotationJson?: (file: File) => void;
}

export class AppSidebar {
  private container: HTMLElement;
  private events: SidebarEvents;
  private activeTab: 'thumbnails' | 'outline' | 'annotations' | 'search' = 'thumbnails';
  private currentPage: number = 1;
  private matchCase: boolean = false;
  private matchWords: boolean = false;

  constructor(container: HTMLElement, events: SidebarEvents) {
    this.container = container;
    this.events = events;
    this.render();
  }

  public getActiveTab(): string {
    return this.activeTab;
  }

  public open(): void {
    this.container.classList.remove('collapsed');
    if (window.innerWidth <= 768) {
      this.container.classList.add('mobile-open');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (backdrop) backdrop.classList.add('visible');
    }
  }

  public close(): void {
    if (window.innerWidth <= 768) {
      this.container.classList.remove('mobile-open');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (backdrop) backdrop.classList.remove('visible');
    } else {
      this.container.classList.add('collapsed');
    }
  }

  public toggle(): void {
    if (window.innerWidth <= 768) {
      if (this.container.classList.contains('mobile-open')) {
        this.close();
      } else {
        this.open();
      }
    } else {
      this.container.classList.toggle('collapsed');
    }
  }

  public isMobileOpen(): boolean {
    return this.container.classList.contains('mobile-open');
  }

  public isOpen(): boolean {
    if (window.innerWidth <= 768) {
      return this.container.classList.contains('mobile-open');
    }
    return !this.container.classList.contains('collapsed');
  }

  public setThumbnails(thumbnails: { pageNumber: number; dataUrl: string; rotation?: number }[]): void {
    const list = this.container.querySelector('#sidebar-thumbnails-list');
    if (!list) return;

    list.innerHTML = '';
    for (const thumb of thumbnails) {
      const item = document.createElement('div');
      item.className = `thumbnail-item ${thumb.pageNumber === this.currentPage ? 'active' : ''}`;
      item.setAttribute('data-page', thumb.pageNumber.toString());

      const rot = thumb.rotation || 0;
      const imgContent = thumb.dataUrl
        ? `<img class="thumbnail-image" src="${thumb.dataUrl}" alt="Page ${thumb.pageNumber}" style="transform: rotate(${rot}deg); transition: transform 0.2s ease;" />`
        : `<div class="thumbnail-blank-placeholder" style="width: 100%; height: 100%; min-height: 120px; background: #ffffff; border: 1px dashed var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.75rem; border-radius: 4px; transform: rotate(${rot}deg); transition: transform 0.2s ease;">Blank Page</div>`;

      item.innerHTML = `
        <div class="thumbnail-image-wrapper">
          ${imgContent}
        </div>
        <span class="thumbnail-label">Page ${thumb.pageNumber}</span>
      `;

      item.addEventListener('click', () => {
        this.setCurrentPage(thumb.pageNumber);
        this.events.onPageSelect(thumb.pageNumber);
        if (window.innerWidth <= 768) {
          this.close();
        }
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
        const hasChildren = Boolean(it.children && it.children.length > 0);
        const li = document.createElement('li');
        li.className = 'outline-item';
        li.setAttribute('tabindex', '0');
        li.setAttribute('role', 'treeitem');
        if (hasChildren) {
          li.setAttribute('aria-expanded', 'true');
        }

        const chevronHtml = hasChildren
          ? `<button class="outline-chevron-btn" aria-label="Toggle section" style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0; background: none; border: none; cursor: pointer; color: var(--text-muted); transition: transform 0.15s ease;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"></path></svg>
            </button>`
          : `<span style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: var(--text-muted); opacity: 0.7;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
            </span>`;

        li.innerHTML = `
          ${chevronHtml}
          <span class="outline-title" style="flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${it.bold ? 'font-weight: 600;' : ''} ${it.italic ? 'font-style: italic;' : ''}">${it.title}</span>
          ${it.pageNumber ? `<span class="outline-page-num" style="margin-left: auto; font-size: 0.75rem; color: var(--text-muted); padding-left: 6px;">p.${it.pageNumber}</span>` : ''}
        `;

        const subUl = hasChildren ? document.createElement('ul') : null;
        if (subUl && it.children) {
          subUl.className = 'outline-subtree';
          subUl.style.listStyle = 'none';
          subUl.style.paddingLeft = '14px';
          renderItems(it.children, subUl);
        }

        const chevronBtn = li.querySelector('.outline-chevron-btn') as HTMLButtonElement | null;
        if (chevronBtn && subUl) {
          chevronBtn.style.transform = 'rotate(90deg)';
          chevronBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCollapsed = subUl.style.display === 'none';
            if (isCollapsed) {
              subUl.style.display = 'block';
              chevronBtn.style.transform = 'rotate(90deg)';
              li.setAttribute('aria-expanded', 'true');
            } else {
              subUl.style.display = 'none';
              chevronBtn.style.transform = 'rotate(0deg)';
              li.setAttribute('aria-expanded', 'false');
            }
          });
        }

        const navigateToBookmark = () => {
          if (it.pageNumber) {
            this.setCurrentPage(it.pageNumber);
            this.events.onPageSelect(it.pageNumber);
            if (window.innerWidth <= 768) {
              this.close();
            }
          }
        };

        li.addEventListener('click', (e) => {
          e.stopPropagation();
          navigateToBookmark();
        });

        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            navigateToBookmark();
          } else if (e.key === 'ArrowRight' && hasChildren && subUl) {
            e.preventDefault();
            e.stopPropagation();
            subUl.style.display = 'block';
            if (chevronBtn) chevronBtn.style.transform = 'rotate(90deg)';
            li.setAttribute('aria-expanded', 'true');
          } else if (e.key === 'ArrowLeft' && hasChildren && subUl) {
            e.preventDefault();
            e.stopPropagation();
            subUl.style.display = 'none';
            if (chevronBtn) chevronBtn.style.transform = 'rotate(0deg)';
            li.setAttribute('aria-expanded', 'false');
          }
        });

        parentEl.appendChild(li);
        if (subUl) {
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
      if (ann.type === 'image') label = `Image (${Math.round(ann.width)}×${Math.round(ann.height)})`;
      if (ann.type === 'signature') label = `Signature`;
      if (ann.type === 'sticky_note') label = `Note: "${ann.title || 'Note'}"`;

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary);">${label}</span>
          <span style="font-size: 0.7rem; color: var(--text-muted);">Page ${pageNum}</span>
        </div>
        <button class="icon-btn del-ann-btn" title="Delete" aria-label="Delete annotation" style="width: 24px; height: 24px; color: var(--danger-color);">✕</button>
      `;

      card.addEventListener('click', () => {
        this.events.onAnnotationSelect(ann.id, pageNum);
        if (window.innerWidth <= 768) {
          this.close();
        }
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
    let activeItem: HTMLElement | null = null;
    this.container.querySelectorAll('.thumbnail-item').forEach(item => {
      const isActive = item.getAttribute('data-page') === pageNumber.toString();
      item.classList.toggle('active', isActive);
      if (isActive) activeItem = item as HTMLElement;
    });
    if (activeItem) {
      (activeItem as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="sidebar-header-row">
        <div class="sidebar-tabs">
          <div class="sidebar-tab active" data-tab="thumbnails" title="Page Thumbnails">Pages</div>
          <div class="sidebar-tab" data-tab="outline" title="Document Bookmarks">Bookmarks</div>
          <div class="sidebar-tab" data-tab="annotations" title="Annotations List">Markup</div>
          <div class="sidebar-tab" data-tab="search" title="Search Text">Search</div>
        </div>
        <button class="icon-btn sidebar-close-btn" id="sidebar-close-btn" title="Close Sidebar" aria-label="Close Sidebar">✕</button>
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
          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            <button class="btn" id="export-ann-json-btn" aria-label="Backup annotations to JSON" style="flex: 1; height: 26px; font-size: 0.75rem; padding: 0;">Backup (JSON)</button>
            <button class="btn" id="import-ann-json-btn" aria-label="Restore annotations from JSON" style="flex: 1; height: 26px; font-size: 0.75rem; padding: 0;">Restore</button>
            <input type="file" id="import-ann-json-input" aria-label="Choose JSON annotations file" accept="application/json" style="display: none;" />
          </div>
          <button class="btn" id="export-annotation-report-btn" aria-label="Export Annotation Summary Report to Markdown" style="height: 28px; font-size: 0.75rem; width: 100%; margin-bottom: 8px; justify-content: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span>Export Summary Report (.md)</span>
          </button>
          <div class="annotations-list" id="sidebar-annotations-list">
            <div style="color: var(--text-muted); font-size: 0.8rem; padding: 20px;">No annotations</div>
          </div>
        </div>

        <!-- Search Tab -->
        <div id="tab-pane-search" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 6px; align-items: center;">
              <input type="text" id="sidebar-search-input" class="search-input" placeholder="Search document..." aria-label="Search document" style="flex: 1; width: 100%;" />
              <button class="icon-btn" id="search-case-btn" title="Match Case" aria-label="Match Case" style="width: 28px; height: 28px; font-size: 0.75rem; font-weight: bold;">Aa</button>
              <button class="icon-btn" id="search-word-btn" title="Match Whole Words" aria-label="Match Whole Words" style="width: 28px; height: 28px; font-size: 0.75rem; font-family: monospace;">\\b</button>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span id="search-count-label" style="font-size: 0.75rem; color: var(--text-muted);">0 matches</span>
              <div style="display: flex; gap: 4px;">
                <button class="icon-btn" id="search-prev-btn" style="width: 28px; height: 28px;" title="Previous Match" aria-label="Previous Match">▲</button>
                <button class="icon-btn" id="search-next-btn" style="width: 28px; height: 28px;" title="Next Match" aria-label="Next Match">▼</button>
              </div>
            </div>
            <button class="btn" id="export-search-citations-btn" title="Export Citations as Markdown (.md)" aria-label="Export Search Citations" style="height: 28px; font-size: 0.75rem; width: 100%; margin-top: 4px; justify-content: center; gap: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Export Citations (.md)</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  }

  private setupListeners(): void {
    const closeBtn = this.container.querySelector('#sidebar-close-btn');
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

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
    const caseBtn = this.container.querySelector('#search-case-btn');
    const wordBtn = this.container.querySelector('#search-word-btn');

    const triggerSearch = () => {
      this.events.onSearch(searchInput?.value || '', this.matchCase, this.matchWords);
    };

    searchInput?.addEventListener('input', triggerSearch);

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.events.onSearchPrevious();
        } else {
          this.events.onSearchNext();
        }
      } else if (e.key === 'Escape') {
        searchInput.blur();
      }
    });

    caseBtn?.addEventListener('click', () => {
      this.matchCase = !this.matchCase;
      caseBtn.classList.toggle('active', this.matchCase);
      triggerSearch();
    });

    wordBtn?.addEventListener('click', () => {
      this.matchWords = !this.matchWords;
      wordBtn.classList.toggle('active', this.matchWords);
      triggerSearch();
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

    const exportJsonBtn = this.container.querySelector('#export-ann-json-btn');
    const importJsonBtn = this.container.querySelector('#import-ann-json-btn');
    const importJsonInput = this.container.querySelector('#import-ann-json-input') as HTMLInputElement;

    exportJsonBtn?.addEventListener('click', () => {
      if (this.events.onExportAnnotationJson) this.events.onExportAnnotationJson();
    });

    importJsonBtn?.addEventListener('click', () => {
      importJsonInput?.click();
    });

    importJsonInput?.addEventListener('change', () => {
      const file = importJsonInput.files?.[0];
      if (file && this.events.onImportAnnotationJson) {
        this.events.onImportAnnotationJson(file);
      }
      importJsonInput.value = '';
    });
  }
}
