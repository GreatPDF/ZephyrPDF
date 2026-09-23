import { HistoryManager } from './core/history';
import { AnnotationManager } from './annotations/manager';
import { PageManager } from './organizer/page-manager';
import { PageRenderer } from './core/renderer';
import { TextSearchEngine } from './core/text-search';
import { FormHandler } from './core/form-handler';
import { PdfLoader, LoadedDocument } from './core/pdf-loader';
import { PdfExporter } from './export/pdf-exporter';
import { AppToolbar } from './ui/toolbar';
import { AppSidebar } from './ui/sidebar';
import { PageAnnotationOverlay } from './annotations/overlay';
import { SignatureDialog } from './ui/dialogs/signature-dialog';
import { ShortcutsDialog } from './ui/dialogs/shortcuts-dialog';
import { MetadataDialog } from './ui/dialogs/metadata-dialog';
import { CompareDialog } from './ui/dialogs/compare-dialog';
import { WatermarkDialog } from './ui/dialogs/watermark-dialog';
import { OptimizerDialog } from './ui/dialogs/optimizer-dialog';
import { DocumentComparator } from './core/comparator';
import { TextSelectionMenu } from './ui/text-selection-menu';
import { DocumentLoupe } from './ui/loupe';
import { AnnotationContextMenu } from './ui/context-menu';
import { TextExtractor } from './core/text-extractor';
import { SessionManager, DocumentSession } from './core/document-session';
import { DocumentTabBar } from './ui/tab-bar';
import { OrganizerModal } from './ui/organizer-modal';
import { NotificationService } from './ui/notification';
import { createSamplePdf } from './utils/samples';
import { MeasureUnit, ToolType } from './types/annotations';
import { ThemeMode, ViewMode, WatermarkOptions, PageNumberOptions } from './types/document';
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

class ZephyrPDFApp {
  private history: HistoryManager;
  private annotationManager: AnnotationManager;
  private pageManager: PageManager;
  private renderer: PageRenderer;
  private searchEngine: TextSearchEngine;
  private formHandler: FormHandler;
  private loupe: DocumentLoupe;
  private sessionManager: SessionManager;
  private contextMenu!: AnnotationContextMenu;

  private toolbar!: AppToolbar;
  private sidebar!: AppSidebar;
  private tabBar!: DocumentTabBar;

  private currentDoc: LoadedDocument | null = null;
  private pageOverlays: Map<number, PageAnnotationOverlay> = new Map();
  private pageThumbnails: Map<number, string> = new Map();
  private mergedDocs: Map<string, Uint8Array> = new Map();

  // State
  private activeTool: ToolType = 'select';
  private activeColor: string = PRESET_COLORS.highlighterYellow;
  private activeStrokeWidth: number = 2;
  private activeStamp: string = 'APPROVED';
  private activeSignature: string | null = null;
  private activeImage: string | null = null;
  private activeMeasureUnit: MeasureUnit = 'mm';
  private currentScale: number = 1.0;
  private currentTheme: ThemeMode = 'dark';
  private currentPageNumber: number = 1;
  private lastGKeyTime: number = 0;

  private watermarkOptions: WatermarkOptions = {
    enabled: false,
    text: 'CONFIDENTIAL',
    opacity: 0.15,
    fontSize: 48,
    rotationDegrees: -45,
    color: '#94a3b8'
  };

  private pageNumberOptions: PageNumberOptions = {
    enabled: false,
    format: 'Page X of Y',
    position: 'bottom-center',
    fontSize: 9,
    color: '#64748b'
  };

  constructor() {
    this.history = new HistoryManager();
    this.annotationManager = new AnnotationManager(this.history);
    this.pageManager = new PageManager(this.history);
    this.renderer = new PageRenderer();
    this.searchEngine = new TextSearchEngine();
    this.formHandler = new FormHandler();
    this.loupe = new DocumentLoupe();
    this.sessionManager = new SessionManager();

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
      onSaveExport: () => this.exportPdf(false),
      onSaveFlatten: () => this.exportPdf(true),
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
        this.loupe.setActive(tool === 'loupe');
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
      onViewModeChange: (mode: ViewMode) => {
        const viewerContainer = document.getElementById('viewer-container');
        if (mode === 'two-page') {
          viewerContainer?.classList.add('mode-two-page');
          NotificationService.show('Two-Page Spread View enabled');
        } else if (mode === 'presentation') {
          document.documentElement.requestFullscreen?.();
          NotificationService.show('Presentation Mode enabled');
        } else {
          viewerContainer?.classList.remove('mode-two-page');
          NotificationService.show('Continuous Scroll View enabled');
        }
      },
      onShowShortcuts: () => new ShortcutsDialog().open(),
      onShowMetadata: () => {
        if (this.currentDoc) {
          new MetadataDialog(this.currentDoc.metadata, {
            onSave: (updated) => {
              this.currentDoc!.metadata = updated;
              if (updated.title) {
                document.title = `${updated.title} · ZephyrPDF`;
              }
              NotificationService.show('Document properties & metadata saved!');
            }
          }).open();
        }
      },
      onMeasureUnitChange: (unit) => {
        this.activeMeasureUnit = unit;
      },
      onCompareFile: async (file: File) => {
        if (!this.currentDoc) {
          NotificationService.show('Open a PDF document first before comparing.');
          return;
        }
        try {
          NotificationService.show(`Analyzing differences with ${file.name}...`);
          const bytes = new Uint8Array(await file.arrayBuffer());
          const docB = await PdfLoader.loadFromBytes(bytes, file.name);
          const summary = await DocumentComparator.compareDocuments(
            this.currentDoc.pdfjsDoc,
            docB.pdfjsDoc,
            this.currentDoc.metadata.fileName,
            file.name
          );
          new CompareDialog(summary).open();
          NotificationService.show(`Comparison complete: ${summary.changedPagesCount} pages differ.`);
        } catch (e: any) {
          console.error(e);
          alert('Failed to compare documents: ' + e.message);
        }
      },
      onInsertImage: (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            this.activeImage = e.target.result as string;
            this.activeTool = 'image';
            this.toolbar.setActiveTool('image');
            NotificationService.show('Image ready! Click on any page to place it.');
          }
        };
        reader.readAsDataURL(file);
      },
      onWatermarkClick: () => {
        new WatermarkDialog(this.watermarkOptions, this.pageNumberOptions, {
          onSave: (wm, pn) => {
            this.watermarkOptions = wm;
            this.pageNumberOptions = pn;
            NotificationService.show('Watermark & page numbering updated!');
          }
        }).open();
      },
      onOptimizeClick: () => {
        if (!this.currentDoc) {
          NotificationService.show('Open a PDF document first before compressing.');
          return;
        }
        new OptimizerDialog({
          pdfjsDoc: this.currentDoc.pdfjsDoc,
          fileName: this.currentDoc.metadata.fileName,
          originalSizeBytes: this.currentDoc.metadata.fileSize
        }).open();
      },
      onExtractText: async () => {
        if (!this.currentDoc) {
          NotificationService.show('Open a PDF document first.');
          return;
        }
        NotificationService.show('Extracting document text...');
        const result = await TextExtractor.extractText(
          this.currentDoc.pdfjsDoc,
          this.currentDoc.metadata.fileName
        );
        const base = this.currentDoc.metadata.fileName.replace(/\.pdf$/i, '');
        TextExtractor.downloadTextFile(result.markdownText, `${base}_extracted.md`, 'text/markdown');
        navigator.clipboard?.writeText(result.plainText);
        NotificationService.show(`Extracted ${result.totalWords.toLocaleString()} words to Markdown file & clipboard!`);
      }
    });

    const tabBarEl = document.getElementById('app-tab-bar')!;
    this.tabBar = new DocumentTabBar(tabBarEl, {
      onSelectTab: async (sessionId) => {
        const session = this.sessionManager.switchSession(sessionId);
        if (session) {
          await this.applySession(session);
        }
      },
      onCloseTab: async (sessionId) => {
        const nextSession = this.sessionManager.closeSession(sessionId);
        this.tabBar.update(this.sessionManager.getAllSessions(), nextSession ? nextSession.id : null);
        if (nextSession) {
          await this.applySession(nextSession);
        } else {
          this.closeAllSessions();
        }
      },
      onNewTab: () => {
        this.triggerFilePicker();
      }
    });

    new TextSelectionMenu({
      annotationManager: this.annotationManager,
      getScale: () => this.currentScale
    });

    this.contextMenu = new AnnotationContextMenu({
      annotationManager: this.annotationManager
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
      },
      onExportCitations: () => {
        const state = this.searchEngine.getState();
        if (!state.query || state.matches.length === 0) {
          NotificationService.show('Perform a search first to export citations.');
          return;
        }

        const fileName = this.currentDoc?.metadata.fileName || 'document.pdf';
        let md = `# Search Citations for "${state.query}"\n`;
        md += `**Document:** ${fileName}\n`;
        md += `**Total Matches:** ${state.matches.length}\n\n`;
        md += `## Occurrences\n`;
        for (const m of state.matches) {
          md += `- **Page ${m.pageIndex + 1}**: "...${m.text}..."\n`;
        }

        navigator.clipboard?.writeText(md);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName.replace(/\.pdf$/i, '')}_search_citations.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        NotificationService.show('Citations copied to clipboard & downloaded!');
      },
      onExportAnnotationReport: () => {
        const annotations = this.annotationManager.getAllAnnotations();
        if (annotations.length === 0) {
          NotificationService.show('No annotations in document to export.');
          return;
        }

        const fileName = this.currentDoc?.metadata.fileName || 'document.pdf';
        let md = `# ZephyrPDF Annotation Report\n`;
        md += `**Document:** ${fileName}\n`;
        md += `**Export Date:** ${new Date().toLocaleString()}\n`;
        md += `**Total Annotations:** ${annotations.length}\n\n`;

        // Group by page
        const byPage = new Map<number, any[]>();
        for (const ann of annotations) {
          const p = ann.pageIndex + 1;
          if (!byPage.has(p)) byPage.set(p, []);
          byPage.get(p)!.push(ann);
        }

        const sortedPages = Array.from(byPage.keys()).sort((a, b) => a - b);
        for (const p of sortedPages) {
          md += `## Page ${p}\n`;
          for (const ann of byPage.get(p)!) {
            let desc = '';
            if (ann.type === 'text') desc = `"${ann.text}"`;
            else if (ann.type === 'measure') desc = `Distance: ${ann.formattedValue}`;
            else if (ann.type === 'stamp') desc = `Stamp: ${ann.stampType}`;
            else if (ann.type === 'sticky_note') desc = `Comment: "${ann.content}"`;
            else if (ann.type === 'redaction') desc = `Redaction: [${ann.overlayText || 'REDACTED'}]`;
            else desc = `Color ${ann.color || ann.strokeColor || ''}`;

            md += `- **[${ann.type.toUpperCase()}]** ${desc}\n`;
          }
          md += `\n`;
        }

        navigator.clipboard?.writeText(md);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName.replace(/\.pdf$/i, '')}_annotation_report.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        NotificationService.show('Annotation report copied & downloaded!');
      },
      onExportAnnotationJson: () => {
        const jsonStr = this.annotationManager.exportJson();
        const fileName = this.currentDoc?.metadata.fileName || 'document.pdf';
        const base = fileName.replace(/\.pdf$/i, '');
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base}_annotations.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        NotificationService.show('Annotations exported to JSON!');
      },
      onImportAnnotationJson: async (file: File) => {
        try {
          const text = await file.text();
          this.annotationManager.importJson(text);
          await this.renderDocument();
          NotificationService.show(`Imported annotations from ${file.name}!`);
        } catch (e: any) {
          alert('Failed to import annotations: ' + e.message);
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
      } else if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        this.pageManager.rotatePage(this.currentPageNumber - 1, -90);
        this.renderDocument();
        NotificationService.show(`Page ${this.currentPageNumber} rotated 90° CCW`);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        this.pageManager.rotatePage(this.currentPageNumber - 1, 90);
        this.renderDocument();
        NotificationService.show(`Page ${this.currentPageNumber} rotated 90° CW`);
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
      } else if (e.key.toLowerCase() === 'x') {
        this.toolbar.setActiveTool('redaction');
        this.activeTool = 'redaction';
      } else if (e.key.toLowerCase() === 'u') {
        this.toolbar.setActiveTool('measure');
        this.activeTool = 'measure';
      } else if (e.key.toLowerCase() === 'z' && !e.ctrlKey && !e.metaKey) {
        this.toolbar.setActiveTool('loupe');
        this.activeTool = 'loupe';
        this.loupe.setActive(true);
      } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        this.toolbar.setActiveTool('snapshot');
        this.activeTool = 'snapshot';
      } else if (e.key === 'Escape') {
        this.annotationManager.selectAnnotation(null);
        this.toolbar.setActiveTool('select');
        this.activeTool = 'select';
        this.loupe.setActive(false);
        window.getSelection()?.removeAllRanges();
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.getElementById('sidebar-search-input') as HTMLInputElement;
        const searchTab = document.querySelector('.sidebar-tab[data-tab="search"]') as HTMLElement;
        searchTab?.click();
        searchInput?.focus();
        searchInput?.select();
      } else if (e.key === 'G' && e.shiftKey) {
        e.preventDefault();
        this.scrollToPage(this.pageManager.getPageCount());
      } else if (e.key === 'g' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const now = Date.now();
        if (now - this.lastGKeyTime < 450) {
          this.scrollToPage(1);
          this.lastGKeyTime = 0;
          return;
        }
        this.lastGKeyTime = now;
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
      NotificationService.show('Generating ZephyrPDF showcase document...');
      const sampleBytes = await createSamplePdf();
      const loaded = await PdfLoader.loadFromBytes(sampleBytes, 'ZephyrPDF_Showcase.pdf');
      await this.setDocument(loaded);
      NotificationService.show('Welcome to ZephyrPDF!');
    } catch (e: any) {
      console.error(e);
      alert('Failed to generate sample PDF: ' + e.message);
    }
  }

  public async setDocument(doc: LoadedDocument): Promise<void> {
    const session = this.sessionManager.createSession(doc);
    this.tabBar.update(this.sessionManager.getAllSessions(), session.id);
    await this.applySession(session);
  }

  public async applySession(session: DocumentSession): Promise<void> {
    this.currentDoc = session.doc;
    this.history = session.history;
    this.annotationManager = session.annotationManager;
    this.pageManager = session.pageManager;
    this.formHandler = session.formHandler;
    this.currentScale = session.scale;
    this.currentPageNumber = session.currentPageNumber;

    this.history.subscribe(() => {
      this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
      this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
    });
    this.annotationManager.subscribe(() => {
      this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
    });

    // Initialize Text Search Engine
    await this.searchEngine.setDocument(session.doc.pdfjsDoc);

    // Hide empty state, show HUD
    document.getElementById('empty-state')!.style.display = 'none';
    document.getElementById('pages-wrapper')!.style.display = 'flex';
    document.getElementById('floating-hud')!.style.display = 'flex';

    // Update document title
    document.title = `${session.doc.metadata.fileName} · ZephyrPDF`;

    // Render outline and annotations in sidebar
    this.sidebar.setOutline(session.doc.outline);
    this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
    this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
    this.toolbar.setZoom(this.currentScale);

    // Generate thumbnails in background
    this.generateThumbnails(session.doc);

    // Initial render
    await this.renderDocument();
    this.updatePageHUD();
  }

  public closeAllSessions(): void {
    this.currentDoc = null;
    document.getElementById('empty-state')!.style.display = 'flex';
    document.getElementById('pages-wrapper')!.style.display = 'none';
    document.getElementById('floating-hud')!.style.display = 'none';
    this.sidebar.setOutline([]);
    this.sidebar.setAnnotations([]);
    this.sidebar.setThumbnails([]);
    document.title = 'ZephyrPDF · The Featherlight Open-Source PDF Viewer & Editor';
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
          getActiveSignature: () => this.activeSignature,
          getActiveMeasureUnit: () => this.activeMeasureUnit,
          getActiveImage: () => this.activeImage,
          contextMenu: this.contextMenu
        });
        overlay.updateSize(viewport.width, viewport.height);
        this.pageOverlays.set(pageItem.originalIndex, overlay);

        // Render interactive AcroForm fields if present
        const fields = this.formHandler.getFieldsForPage(pageItem.originalIndex);
        if (fields.length > 0) {
          const formLayer = document.createElement('div');
          formLayer.className = 'form-fields-layer';
          const pageHeight = viewport.height / this.currentScale;

          for (const f of fields) {
            const topPx = (pageHeight - (f.bounds.y + f.bounds.height)) * this.currentScale;
            const leftPx = f.bounds.x * this.currentScale;
            const widthPx = f.bounds.width * this.currentScale;
            const heightPx = f.bounds.height * this.currentScale;

            if (f.type === 'checkbox') {
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.className = 'pdf-acro-checkbox';
              cb.checked = Boolean(f.value);
              cb.style.left = `${leftPx}px`;
              cb.style.top = `${topPx}px`;
              cb.style.width = `${Math.max(16, widthPx)}px`;
              cb.style.height = `${Math.max(16, heightPx)}px`;
              cb.addEventListener('change', () => {
                this.formHandler.setValue(f.name, cb.checked);
              });
              formLayer.appendChild(cb);
            } else {
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'pdf-acro-input';
              input.value = typeof f.value === 'string' ? f.value : '';
              input.style.left = `${leftPx}px`;
              input.style.top = `${topPx}px`;
              input.style.width = `${widthPx}px`;
              input.style.height = `${heightPx}px`;
              input.addEventListener('input', () => {
                this.formHandler.setValue(f.name, input.value);
              });
              formLayer.appendChild(input);
            }
          }
          pageContainer.appendChild(formLayer);
        }
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
      onClose: () => {},
      onMergeFile: async (file: File) => {
        NotificationService.show(`Merging ${file.name}...`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const docId = 'merged_' + Math.random().toString(36).substring(2, 9);
        this.mergedDocs.set(docId, bytes);

        const loaded = await PdfLoader.loadFromBytes(bytes, file.name);
        this.pageManager.appendDocumentPages(
          docId,
          loaded.metadata.pageCount,
          loaded.pageDimensions
        );

        // Render thumbnails for merged pages
        for (let i = 1; i <= loaded.pdfjsDoc.numPages; i++) {
          const page = await loaded.pdfjsDoc.getPage(i);
          const url = await this.renderer.renderThumbnail(page, 140);
          this.pageThumbnails.set(i - 1, url);
        }

        NotificationService.show(`Merged ${file.name} successfully!`);
      },
      onExtractPages: async (indices: number[]) => {
        if (!this.currentDoc) return;
        NotificationService.show(`Extracting ${indices.length} pages...`);
        const tempManager = new PageManager(new HistoryManager());
        const activePages = this.pageManager.getPages();
        const extractedItems = indices.map(idx => activePages[idx]).filter(Boolean);

        tempManager.initFromDocument(extractedItems.length, extractedItems.map(p => ({
          width: p.width,
          height: p.height,
          rotation: p.rotation
        })));

        const extractedBytes = await PdfExporter.exportDocument(
          this.currentDoc.data,
          tempManager,
          this.annotationManager,
          this.formHandler,
          this.mergedDocs
        );

        const baseName = this.currentDoc.metadata.fileName.replace(/\.pdf$/i, '');
        PdfExporter.downloadBlob(extractedBytes, `${baseName}_extracted.pdf`);
        NotificationService.show('Extracted pages downloaded successfully!');
      }
    }).open();
  }

  public async exportPdf(flattenForm: boolean = false): Promise<void> {
    if (!this.currentDoc) {
      NotificationService.show('No document open to save.');
      return;
    }

    try {
      NotificationService.show(flattenForm ? 'Flattening forms & exporting PDF...' : 'Baking annotations and exporting PDF...');
      const exportedBytes = await PdfExporter.exportDocument(
        this.currentDoc.data,
        this.pageManager,
        this.annotationManager,
        this.formHandler,
        this.mergedDocs,
        flattenForm,
        this.watermarkOptions,
        this.pageNumberOptions,
        this.currentDoc.metadata
      );

      const baseName = this.currentDoc.metadata.fileName.replace(/\.pdf$/i, '');
      const exportName = `${baseName}_${flattenForm ? 'flattened' : 'edited'}.pdf`;
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
  new ZephyrPDFApp();
});
