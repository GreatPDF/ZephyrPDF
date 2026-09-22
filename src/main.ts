import { HistoryManager } from './core/history';
import { AnnotationManager } from './annotations/manager';
import { PageManager } from './organizer/page-manager';
import { PageRenderer } from './core/renderer';
import { TextSearchEngine } from './core/text-search';
import { PdfLoader, LoadedDocument } from './core/pdf-loader';
import { PdfExporter } from './export/pdf-exporter';
import { AppToolbar } from './ui/toolbar';
import { AppSidebar } from './ui/sidebar';
import { PageAnnotationOverlay } from './annotations/overlay';
import { SignatureDialog } from './ui/dialogs/signature-dialog';
import { ShortcutsDialog } from './ui/dialogs/shortcuts-dialog';
import { MetadataDialog } from './ui/dialogs/metadata-dialog';
import { OrganizerModal } from './ui/organizer-modal';
import { NotificationService } from './ui/notification';
import { createSamplePdf } from './utils/samples';
import { ToolType } from './types/annotations';
import { ThemeMode } from './types/document';
import { PRESET_COLORS } from './utils/color';

// Global polyfill for environments missing Promise.withResolvers
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

class GreatPDFApp {
  private history: HistoryManager;
  private annotationManager: AnnotationManager;
  private pageManager: PageManager;
  private renderer: PageRenderer;
  private searchEngine: TextSearchEngine;

  private toolbar!: AppToolbar;
  private sidebar!: AppSidebar;

  private currentDoc: LoadedDocument | null = null;
  private pageOverlays: Map<number, PageAnnotationOverlay> = new Map();
  private pageThumbnails: Map<number, string> = new Map();

  // State
  private activeTool: ToolType = 'select';
  private activeColor: string = PRESET_COLORS.highlighterYellow;
  private activeStrokeWidth: number = 2;
  private activeStamp: string = 'APPROVED';
  private activeSignature: string | null = null;
  private currentScale: number = 1.0;
  private currentTheme: ThemeMode = 'dark';
  private currentPageNumber: number = 1;

  constructor() {
    this.history = new HistoryManager();
    this.annotationManager = new AnnotationManager(this.history);
    this.pageManager = new PageManager(this.history);
    this.renderer = new PageRenderer();
    this.searchEngine = new TextSearchEngine();

    this.initUI();
    this.initDropzone();
    this.initShortcuts();
    this.initScrollWatcher();
  }

  private initUI(): void {
    const headerEl = document.getElementById('app-header')!;
    const sidebarEl = document.getElementById('app-sidebar')!;

    this.toolbar = new AppToolbar(headerEl, {
      onOpenFile: () => this.triggerFilePicker(),
      onOpenSample: () => this.loadSample(),
      onSaveExport: () => this.exportPdf(),
      onPrint: () => window.print(),
      onToggleOrganizer: () => this.openOrganizer(),
      onUndo: () => this.history.undo(),
      onRedo: () => this.history.redo(),
      onZoomIn: () => this.setZoom(this.currentScale * 1.15),
      onZoomOut: () => this.setZoom(this.currentScale / 1.15),
      onZoomFitWidth: () => this.fitToWidth(),
      onZoomFitPage: () => this.fitToPage(),
      onToolSelect: (tool) => {
        this.activeTool = tool;
        if (tool === 'signature' && !this.activeSignature) {
          this.openSignatureDialog();
        }
      },
      onColorChange: (color) => {
        this.activeColor = color;
      },
      onStrokeWidthChange: (width) => {
        this.activeStrokeWidth = width;
      },
      onStampChange: (stamp) => {
        this.activeStamp = stamp;
      },
      onSignatureClick: () => this.openSignatureDialog(),
      onThemeToggle: (theme) => this.setTheme(theme),
      onViewModeChange: () => {},
      onShowShortcuts: () => new ShortcutsDialog().open(),
      onShowMetadata: () => {
        if (this.currentDoc) {
          new MetadataDialog(this.currentDoc.metadata).open();
        }
      }
    });

    this.sidebar = new AppSidebar(sidebarEl, {
      onPageSelect: (pageNumber) => this.scrollToPage(pageNumber),
      onAnnotationSelect: (id, pageNumber) => {
        this.scrollToPage(pageNumber);
        this.annotationManager.selectAnnotation(id);
      },
      onAnnotationDelete: (id) => this.annotationManager.removeAnnotation(id),
      onSearch: (q, cs, ww) => {
        const matches = this.searchEngine.search(q, cs, ww);
        this.sidebar.setSearchResults(matches, 0);
        if (matches.length > 0) {
          this.scrollToPage(matches[0].pageIndex + 1);
        }
      },
      onSearchNext: () => {
        const match = this.searchEngine.next();
        if (match) {
          this.scrollToPage(match.pageIndex + 1);
          const state = this.searchEngine.getState();
          this.sidebar.setSearchResults(state.matches, state.currentMatchIndex);
        }
      },
      onSearchPrevious: () => {
        const match = this.searchEngine.previous();
        if (match) {
          this.scrollToPage(match.pageIndex + 1);
          const state = this.searchEngine.getState();
          this.sidebar.setSearchResults(state.matches, state.currentMatchIndex);
        }
      }
    });

    this.history.subscribe(() => {
      this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
      this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
    });

    this.annotationManager.subscribe(() => {
      this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
    });

    // Wire HUD
    const hudPrev = document.getElementById('hud-prev-page');
    const hudNext = document.getElementById('hud-next-page');
    const hudInput = document.getElementById('hud-current-page') as HTMLInputElement;

    hudPrev?.addEventListener('click', () => this.scrollToPage(this.currentPageNumber - 1));
    hudNext?.addEventListener('click', () => this.scrollToPage(this.currentPageNumber + 1));
    hudInput?.addEventListener('change', () => {
      const page = parseInt(hudInput.value, 10);
      if (!isNaN(page)) this.scrollToPage(page);
    });

    // Wire file picker input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) {
        await this.loadFile(file);
      }
    });

    // Wire empty state buttons
    document.getElementById('empty-open-btn')?.addEventListener('click', () => this.triggerFilePicker());
    document.getElementById('empty-sample-btn')?.addEventListener('click', () => this.loadSample());
  }

  private initDropzone(): void {
    const dropzone = document.getElementById('dropzone');

    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover'].forEach(name => {
      window.addEventListener(name, (e: any) => {
        handleDrag(e);
        dropzone?.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      window.addEventListener(name, (e: any) => {
        handleDrag(e);
        dropzone?.classList.remove('dragover');
      });
    });

    window.addEventListener('drop', async (e: DragEvent) => {
      handleDrag(e);
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type === 'application/pdf') {
        await this.loadFile(file);
      }
    });
  }

  private initShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing into input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.history.redo();
        } else {
          this.history.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.history.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.exportPdf();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.triggerFilePicker();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      } else if (e.key === '=' || e.key === '+') {
        this.setZoom(this.currentScale * 1.15);
      } else if (e.key === '-') {
        this.setZoom(this.currentScale / 1.15);
      } else if (e.key === '0') {
        this.fitToPage();
      } else if (e.key === '9') {
        this.fitToWidth();
      } else if (e.key.toLowerCase() === 'j') {
        this.scrollToPage(this.currentPageNumber + 1);
      } else if (e.key.toLowerCase() === 'k') {
        this.scrollToPage(this.currentPageNumber - 1);
      } else if (e.key.toLowerCase() === 'v') {
        this.toolbar.setActiveTool('select');
        this.activeTool = 'select';
      } else if (e.key.toLowerCase() === 'h') {
        this.toolbar.setActiveTool('hand');
        this.activeTool = 'hand';
      } else if (e.key.toLowerCase() === 'l') {
        this.toolbar.setActiveTool('highlight');
        this.activeTool = 'highlight';
      } else if (e.key.toLowerCase() === 'p') {
        this.toolbar.setActiveTool('freehand');
        this.activeTool = 'freehand';
      } else if (e.key.toLowerCase() === 'e') {
        this.toolbar.setActiveTool('eraser');
        this.activeTool = 'eraser';
      } else if (e.key.toLowerCase() === 't') {
        this.toolbar.setActiveTool('text');
        this.activeTool = 'text';
      } else if (e.key.toLowerCase() === 'r') {
        this.toolbar.setActiveTool('rectangle');
        this.activeTool = 'rectangle';
      } else if (e.key.toLowerCase() === 'o') {
        this.toolbar.setActiveTool('ellipse');
        this.activeTool = 'ellipse';
      } else if (e.key.toLowerCase() === 'a') {
        this.toolbar.setActiveTool('arrow');
        this.activeTool = 'arrow';
      } else if (e.key.toLowerCase() === 'g') {
        this.openSignatureDialog();
      } else if (e.key === '?') {
        new ShortcutsDialog().open();
      }
    });
  }

  private initScrollWatcher(): void {
    const container = document.getElementById('viewer-container');
    if (!container) return;

    let timeout: any;
    container.addEventListener('scroll', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const pagesWrapper = document.getElementById('pages-wrapper');
        if (!pagesWrapper) return;

        const pageContainers = pagesWrapper.querySelectorAll('.page-container');
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        for (let i = 0; i < pageContainers.length; i++) {
          const el = pageContainers[i] as HTMLElement;
          const top = el.offsetTop - container.offsetTop;
          const height = el.clientHeight;

          if (top + height / 2 >= containerTop && top <= containerTop + containerHeight) {
            const pageNum = parseInt(el.getAttribute('data-page') || '1', 10);
            if (pageNum !== this.currentPageNumber) {
              this.currentPageNumber = pageNum;
              this.updatePageHUD();
              this.sidebar.setCurrentPage(pageNum);
            }
            break;
          }
        }
      }, 50);
    });
  }

  public triggerFilePicker(): void {
    const input = document.getElementById('file-input') as HTMLInputElement;
    input?.click();
  }

  public async loadFile(file: File): Promise<void> {
    try {
      NotificationService.show(`Loading ${file.name}...`);
      const loaded = await PdfLoader.loadFromFile(file);
      await this.setDocument(loaded);
      NotificationService.show(`Loaded ${file.name} successfully!`);
    } catch (e: any) {
      console.error(e);
      alert('Failed to load PDF file: ' + e.message);
    }
  }

  public async loadSample(): Promise<void> {
    try {
      NotificationService.show('Generating GreatPDF showcase document...');
      const sampleBytes = await createSamplePdf();
      const loaded = await PdfLoader.loadFromBytes(sampleBytes, 'GreatPDF_Showcase.pdf');
      await this.setDocument(loaded);
      NotificationService.show('Welcome to GreatPDF!');
    } catch (e: any) {
      console.error(e);
      alert('Failed to generate sample PDF: ' + e.message);
    }
  }

  public async setDocument(doc: LoadedDocument): Promise<void> {
    this.currentDoc = doc;
    this.history.clear();
    this.annotationManager.clearAll(false);

    // Initialize Page Manager
    this.pageManager.initFromDocument(
      doc.metadata.pageCount,
      doc.pageDimensions
    );

    // Initialize Text Search Engine
    await this.searchEngine.setDocument(doc.pdfjsDoc);

    // Hide empty state, show HUD
    document.getElementById('empty-state')!.style.display = 'none';
    document.getElementById('pages-wrapper')!.style.display = 'flex';
    document.getElementById('floating-hud')!.style.display = 'flex';

    // Update document title
    document.title = `${doc.metadata.fileName} · GreatPDF`;

    // Render outline in sidebar
    this.sidebar.setOutline(doc.outline);

    // Generate thumbnails in background
    this.generateThumbnails(doc);

    // Initial render
    await this.renderDocument();
    this.updatePageHUD();
  }

  private async generateThumbnails(doc: LoadedDocument): Promise<void> {
    this.pageThumbnails.clear();
    const thumbs: { pageNumber: number; dataUrl: string }[] = [];

    for (let i = 1; i <= doc.pdfjsDoc.numPages; i++) {
      const page = await doc.pdfjsDoc.getPage(i);
      const url = await this.renderer.renderThumbnail(page, 140);
      this.pageThumbnails.set(i - 1, url);
      thumbs.push({ pageNumber: i, dataUrl: url });
    }

    this.sidebar.setThumbnails(thumbs);
  }

  private async renderDocument(): Promise<void> {
    if (!this.currentDoc) return;

    const wrapper = document.getElementById('pages-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';
    this.pageOverlays.clear();

    const pages = this.pageManager.getPages();

    for (let i = 0; i < pages.length; i++) {
      const pageItem = pages[i];
      const pageContainer = document.createElement('div');
      pageContainer.className = 'page-container';
      pageContainer.setAttribute('data-page', pageItem.pageNumber.toString());

      const canvas = document.createElement('canvas');
      canvas.className = 'page-canvas';
      pageContainer.appendChild(canvas);
      wrapper.appendChild(pageContainer);

      if (pageItem.isBlank) {
        const w = (pageItem.width || 595.28) * this.currentScale;
        const h = (pageItem.height || 841.89) * this.currentScale;
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        const pageProxy = await this.currentDoc.pdfjsDoc.getPage(pageItem.originalIndex + 1);
        const viewport = await this.renderer.renderPageToCanvas(pageProxy, canvas, {
          scale: this.currentScale,
          rotation: pageItem.rotation,
          theme: this.currentTheme
        });

        const overlay = new PageAnnotationOverlay(pageContainer, pageItem.originalIndex, this.annotationManager, {
          getScale: () => this.currentScale,
          getActiveTool: () => this.activeTool,
          getActiveColor: () => this.activeColor,
          getActiveStrokeWidth: () => this.activeStrokeWidth,
          getActiveStamp: () => this.activeStamp,
          getActiveSignature: () => this.activeSignature
        });
        overlay.updateSize(viewport.width, viewport.height);
        this.pageOverlays.set(pageItem.originalIndex, overlay);
      }
    }
  }

  public setZoom(scale: number): void {
    const clamped = Math.max(0.3, Math.min(4.0, scale));
    this.currentScale = clamped;
    this.toolbar.setZoom(clamped);
    this.renderDocument();
  }

  public fitToWidth(): void {
    const container = document.getElementById('viewer-container');
    if (!container || !this.currentDoc || this.currentDoc.pageDimensions.length === 0) return;
    const pageWidth = this.currentDoc.pageDimensions[0].width;
    const availableWidth = container.clientWidth - 80;
    this.setZoom(availableWidth / pageWidth);
  }

  public fitToPage(): void {
    const container = document.getElementById('viewer-container');
    if (!container || !this.currentDoc || this.currentDoc.pageDimensions.length === 0) return;
    const pageHeight = this.currentDoc.pageDimensions[0].height;
    const availableHeight = container.clientHeight - 80;
    this.setZoom(availableHeight / pageHeight);
  }

  public scrollToPage(pageNumber: number): void {
    const total = this.pageManager.getPageCount();
    const clamped = Math.max(1, Math.min(total, pageNumber));
    this.currentPageNumber = clamped;

    const el = document.querySelector(`.page-container[data-page="${clamped}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.updatePageHUD();
    this.sidebar.setCurrentPage(clamped);
  }

  private updatePageHUD(): void {
    const currentInput = document.getElementById('hud-current-page') as HTMLInputElement;
    const totalLabel = document.getElementById('hud-total-pages');
    const total = this.pageManager.getPageCount();

    if (currentInput) currentInput.value = this.currentPageNumber.toString();
    if (totalLabel) totalLabel.textContent = total.toString();
  }

  public setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.renderDocument();
  }

  public openSignatureDialog(): void {
    new SignatureDialog((dataUrl) => {
      this.activeSignature = dataUrl;
      this.activeTool = 'signature';
      this.toolbar.setActiveTool('signature');
      NotificationService.show('Signature ready! Click anywhere on a page to place it.');
    }).open();
  }

  public openOrganizer(): void {
    new OrganizerModal(this.pageManager, this.pageThumbnails, {
      onApply: () => {
        this.renderDocument();
        this.updatePageHUD();
        NotificationService.show('Page changes applied!');
      },
      onClose: () => {}
    }).open();
  }

  public async exportPdf(): Promise<void> {
    if (!this.currentDoc) {
      NotificationService.show('No document open to save.');
      return;
    }

    try {
      NotificationService.show('Baking annotations and exporting PDF...');
      const exportedBytes = await PdfExporter.exportDocument(
        this.currentDoc.data,
        this.pageManager,
        this.annotationManager
      );

      const baseName = this.currentDoc.metadata.fileName.replace(/\.pdf$/i, '');
      const exportName = `${baseName}_edited.pdf`;
      PdfExporter.downloadBlob(exportedBytes, exportName);

      NotificationService.show(`Saved ${exportName} successfully!`);
    } catch (e: any) {
      console.error(e);
      alert('Failed to export PDF: ' + e.message);
    }
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new GreatPDFApp();
});
