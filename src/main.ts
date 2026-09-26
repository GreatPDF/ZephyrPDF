import 'pdfjs-dist/web/pdf_viewer.css';
import * as pdfjsLib from 'pdfjs-dist';
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
import { FeedbackDialog } from './ui/dialogs/feedback-dialog';
import { MetadataDialog } from './ui/dialogs/metadata-dialog';
import { CompareDialog } from './ui/dialogs/compare-dialog';
import { WatermarkDialog } from './ui/dialogs/watermark-dialog';
import { OptimizerDialog } from './ui/dialogs/optimizer-dialog';
import { FormFieldDialog } from './ui/dialogs/form-field-dialog';
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
import { MeasureUnit, ToolType, ImageAnnotation, Annotation } from './types/annotations';
import { processImageFile, ProcessedImage } from './utils/image';
import { ThemeMode, ViewMode, WatermarkOptions, PageNumberOptions } from './types/document';
import { PRESET_COLORS } from './utils/color';
import { APP_VERSION } from './version';

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
  private textSelectionMenu!: TextSelectionMenu;

  private toolbar!: AppToolbar;
  private sidebar!: AppSidebar;
  private tabBar!: DocumentTabBar;

  private currentDoc: LoadedDocument | null = null;
  private pageOverlays: Map<number, PageAnnotationOverlay> = new Map();
  private pageThumbnails: Map<string, string> = new Map();
  private mergedDocs: Map<string, Uint8Array> = new Map();
  private loadedMergedPdfjsDocs: Map<string, pdfjsLib.PDFDocumentProxy> = new Map();

  // State
  private activeTool: ToolType = 'select';
  private activeColor: string = PRESET_COLORS.highlighterYellow;
  private activeStrokeWidth: number = 2;
  private activeStamp: string = 'APPROVED';
  private activeSignature: string | null = null;
  private activeImage: ProcessedImage | null = null;
  private activeMeasureUnit: MeasureUnit = 'mm';
  private currentScale: number = 1.0;
  private currentTheme: ThemeMode = 'dark';
  private currentPageNumber: number = 1;
  private lastGKeyTime: number = 0;
  private gKeyTimeout: any = null;
  private prePresentationViewMode: ViewMode = 'continuous';

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
    this.initClipboardPaste();
    this.initScrollWatcher();

    (window as any).app = this;
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
      onToggleSidebar: () => this.sidebar.toggle(),
      onUndo: () => this.history.undo(),
      onRedo: () => this.history.redo(),
      onZoomIn: () => this.setZoom(this.currentScale * 1.15),
      onZoomOut: () => this.setZoom(this.currentScale / 1.15),
      onResetZoom: () => this.setZoom(1.0),
      onZoomFitWidth: () => this.fitToWidth(),
      onZoomFitPage: () => this.fitToPage(),
      onToolSelect: (tool) => {
        this.setActiveTool(tool);
        if (tool === 'signature' && !this.activeSignature) {
          this.openSignatureDialog();
        }
      },
      onColorChange: (color) => {
        this.activeColor = color;
        const selectedId = this.annotationManager.getSelectedId();
        if (selectedId) {
          const selected = this.annotationManager.getAnnotation(selectedId);
          if (selected) {
            const updates: any = {};
            if ('strokeColor' in selected) updates.strokeColor = color;
            if ('color' in selected) updates.color = color;
            this.annotationManager.updateAnnotation(selectedId, updates);
          }
        }
      },
      onStrokeWidthChange: (width) => {
        this.activeStrokeWidth = width;
        const selectedId = this.annotationManager.getSelectedId();
        if (selectedId) {
          const selected = this.annotationManager.getAnnotation(selectedId);
          if (selected && 'strokeWidth' in selected) {
            this.annotationManager.updateAnnotation(selectedId, { strokeWidth: width });
          }
        }
      },
      onStampChange: (stamp) => {
        this.activeStamp = stamp;
      },
      onSignatureClick: () => this.openSignatureDialog(),
      onThemeToggle: (theme) => this.setTheme(theme),
      onViewModeChange: (mode: ViewMode) => {
        if (mode !== 'presentation' && document.body.classList.contains('presentation-mode')) {
          this.applyPresentationMode(false);
        }
        const viewerContainer = document.getElementById('viewer-container');
        viewerContainer?.classList.remove('mode-single', 'mode-two-page');

        if (mode === 'two-page') {
          viewerContainer?.classList.add('mode-two-page');
          if (this.currentDoc && this.currentDoc.pageDimensions.length > 0) {
            const container = document.getElementById('viewer-container');
            if (container) {
              const pageWidth = this.currentDoc.pageDimensions[0].width;
              const avail = container.clientWidth - 80;
              const targetScale = Math.min(1.0, Math.max(0.4, avail / (pageWidth * 2 + 40)));
              this.setZoom(targetScale);
            }
          }
          NotificationService.show('Two-Page Spread View enabled');
        } else if (mode === 'single') {
          viewerContainer?.classList.add('mode-single');
          this.updateSinglePageVisibility();
          this.scrollToPage(this.currentPageNumber);
          NotificationService.show('Single Page View enabled');
        } else if (mode === 'presentation') {
          this.togglePresentationMode();
          NotificationService.show('Presentation Mode enabled');
        } else {
          NotificationService.show('Continuous Scroll View enabled');
        }
      },
      onShowShortcuts: () => new ShortcutsDialog(() => this.showFeedbackDialog()).open(),
      onShowFeedback: () => this.showFeedbackDialog(),
      onShowMetadata: () => {
        if (!this.currentDoc) {
          NotificationService.show('Open a PDF document first.', 3000, true);
          return;
        }
        new MetadataDialog(this.currentDoc.metadata, {
          onSave: (updated) => {
            this.currentDoc!.metadata = updated;
            if (updated.title) {
              document.title = `${updated.title} · ZephyrPDF`;
            }
            NotificationService.show('Document properties & metadata saved!');
          }
        }).open();
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
          NotificationService.show('Failed to compare documents: ' + (e?.message || 'Error'), 4000, true);
        }
      },
      onInsertImage: async (file: File) => {
        try {
          const processed = await processImageFile(file);
          this.activeImage = processed;
          this.setActiveTool('image');
          NotificationService.show('Image ready! Click on any page to place it.');
        } catch {
          NotificationService.show('Failed to load image file.', 3000, true);
        }
      },
      onWatermarkClick: () => {
        if (!this.currentDoc) {
          NotificationService.show('Open a PDF document first before adding watermarks.', 3000, true);
          return;
        }
        new WatermarkDialog(this.watermarkOptions, this.pageNumberOptions, {
          onSave: (wm, pn) => {
            this.watermarkOptions = wm;
            this.pageNumberOptions = pn;
            this.renderDocument();
            NotificationService.show('Watermark & page numbering applied!');
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
          NotificationService.show('Open a PDF document first.', 3000, true);
          return;
        }
        NotificationService.show('Extracting document text...');
        const result = await TextExtractor.extractText(
          this.currentDoc.pdfjsDoc,
          this.currentDoc.metadata.fileName,
          this.pageManager,
          this.annotationManager
        );
        const base = this.currentDoc.metadata.fileName.replace(/\.pdf$/i, '');
        TextExtractor.downloadTextFile(result.markdownText, `${base}_extracted.md`, 'text/markdown');
        try {
          await navigator.clipboard?.writeText(result.plainText);
        } catch {
          // Non-blocking clipboard permission fallback
        }
        NotificationService.show(`Extracted ${result.totalWords.toLocaleString()} words to Markdown file & clipboard!`);
      },
      onAddFieldClick: () => {
        if (!this.currentDoc) {
          NotificationService.show('Open a PDF document first.');
          return;
        }
        const dims = this.currentDoc.pageDimensions[this.currentPageNumber - 1] || { width: 595, height: 842 };
        new FormFieldDialog({
          pageCount: this.pageManager.getPageCount(),
          currentPage: this.currentPageNumber,
          pageWidth: dims.width,
          pageHeight: dims.height,
          existingFields: this.formHandler.getAllFields(),
          onAddField: (field) => {
            this.formHandler.createField(field);
            this.renderDocument();
            NotificationService.show(`Interactive ${field.type} field "${field.name}" added to Page ${field.pageIndex + 1}!`);
          },
          onDeleteField: (name) => {
            this.formHandler.deleteField(name);
            this.renderDocument();
            NotificationService.show(`Form field "${name}" removed.`);
          }
        }).open();
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
      onCloseTab: (sessionId) => {
        this.closeTab(sessionId);
      },
      onNewTab: () => {
        this.triggerFilePicker();
      }
    });

    this.textSelectionMenu = new TextSelectionMenu({
      getAnnotationManager: () => this.annotationManager,
      getScale: () => this.currentScale
    });

    this.contextMenu = new AnnotationContextMenu({
      getAnnotationManager: () => this.annotationManager
    });

    const backdropEl = document.getElementById('sidebar-backdrop');
    backdropEl?.addEventListener('click', () => {
      this.sidebar.close();
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
        this.updateSearchHighlights(q, cs, ww, 0);
        if (matches.length > 0) {
          this.scrollToPage(matches[0].pageIndex + 1);
        }
      },
      onSearchNext: () => this.searchNext(),
      onSearchPrevious: () => this.searchPrevious(),
      onSelectSearchMatch: (index) => this.searchGoToMatch(index),
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

        try {
          navigator.clipboard?.writeText(md)?.catch?.(() => {});
        } catch {
          // Ignore clipboard permission errors
        }
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
          NotificationService.show('No annotations in document to export.', 3000, true);
          return;
        }

        const fileName = this.currentDoc?.metadata.fileName || 'document.pdf';
        const md = this.generateAnnotationReport(annotations, fileName);

        try {
          navigator.clipboard?.writeText(md)?.catch?.(() => {});
        } catch {
          // Ignore clipboard permission errors
        }
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName.replace(/\.pdf$/i, '')}_annotation_report.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        NotificationService.show(`Annotation report (${annotations.length} items) copied & downloaded!`);
      },
      onExportAnnotationJson: () => {
        const all = this.annotationManager.getAllAnnotations();
        if (all.length === 0) {
          NotificationService.show('No annotations to backup.', 3000, true);
          return;
        }
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
        NotificationService.show(`Exported ${all.length} annotation${all.length === 1 ? '' : 's'} to JSON!`);
      },
      onImportAnnotationJson: async (file: File) => {
        try {
          const text = await file.text();
          const count = this.annotationManager.importJson(text, true);
          if (count === 0) {
            NotificationService.show('No valid annotations found in file.', 4000, true);
            return;
          }
          await this.renderDocument();
          NotificationService.show(`Successfully restored ${count} annotation${count === 1 ? '' : 's'} from ${file.name}!`);
        } catch (e: any) {
          NotificationService.show('Failed to import annotations: ' + (e?.message || 'Invalid JSON format'), 4000, true);
        }
      }
    });

    this.history.subscribe(() => {
      this.toolbar.setHistoryState(this.history.canUndo(), this.history.canRedo());
      this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
    });

    this.annotationManager.subscribe(() => {
      this.sidebar.setAnnotations(this.annotationManager.getAllAnnotations());
      const selectedId = this.annotationManager.getSelectedId();
      if (selectedId) {
        const selected = this.annotationManager.getAnnotation(selectedId);
        if (selected) {
          const color = (selected as any).color || (selected as any).strokeColor;
          if (color) {
            this.activeColor = color;
            this.toolbar.setActiveColor(color);
          }
          const width = (selected as any).strokeWidth;
          if (typeof width === 'number') {
            this.activeStrokeWidth = width;
            this.toolbar.setActiveStrokeWidth(width);
          }
        }
      }
    });

    // Wire HUD
    const hudPrev = document.getElementById('hud-prev-page');
    const hudNext = document.getElementById('hud-next-page');
    const hudInput = document.getElementById('hud-current-page') as HTMLInputElement;

    hudPrev?.addEventListener('click', () => this.scrollToPage(this.currentPageNumber - 1));
    hudNext?.addEventListener('click', () => this.scrollToPage(this.currentPageNumber + 1));
    hudInput?.addEventListener('focus', () => hudInput.select());
    hudInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const page = parseInt(hudInput.value, 10);
        if (!isNaN(page)) {
          this.scrollToPage(page);
          hudInput.blur();
        }
      }
    });
    hudInput?.addEventListener('change', () => {
      const page = parseInt(hudInput.value, 10);
      if (!isNaN(page)) this.scrollToPage(page);
    });

    const hudRotateCcw = document.getElementById('hud-rotate-ccw');
    const hudRotateCw = document.getElementById('hud-rotate-cw');

    hudRotateCcw?.addEventListener('click', () => {
      if (!this.currentDoc) return;
      this.pageManager.rotatePage(this.currentPageNumber - 1, -90);
      this.renderDocument();
      NotificationService.show(`Page ${this.currentPageNumber} rotated 90° CCW`);
    });

    hudRotateCw?.addEventListener('click', () => {
      if (!this.currentDoc) return;
      this.pageManager.rotatePage(this.currentPageNumber - 1, 90);
      this.renderDocument();
      NotificationService.show(`Page ${this.currentPageNumber} rotated 90° CW`);
    });

    // Mobile Pinch-to-Zoom Gesture Support
    const viewerContainer = document.getElementById('viewer-container');
    const pagesWrapper = document.getElementById('pages-wrapper');
    let initialPinchDistance: number | null = null;
    let initialScale: number = 1.0;
    let targetZoomScale: number = 1.0;

    viewerContainer?.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = this.currentScale;
        targetZoomScale = initialScale;
      }
    }, { passive: true });

    viewerContainer?.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance !== null && initialPinchDistance > 0) {
        if (e.cancelable) e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDistance / initialPinchDistance;
        targetZoomScale = Math.max(0.3, Math.min(4.0, initialScale * factor));
        if (pagesWrapper) {
          pagesWrapper.style.transform = `scale(${factor})`;
          pagesWrapper.style.transformOrigin = 'center top';
        }
      }
    }, { passive: false });

    viewerContainer?.addEventListener('touchend', (e: TouchEvent) => {
      if (e.touches.length < 2 && initialPinchDistance !== null) {
        initialPinchDistance = null;
        if (pagesWrapper) {
          pagesWrapper.style.transform = '';
          pagesWrapper.style.transformOrigin = '';
        }
        if (Math.abs(targetZoomScale - this.currentScale) > 0.05) {
          this.setZoom(targetZoomScale);
        }
      }
    }, { passive: true });

    // Smooth Desktop Wheel Zoom (Ctrl + Wheel) centered at cursor
    viewerContainer?.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newScale = Math.max(0.3, Math.min(4.0, this.currentScale * zoomFactor));

        if (Math.abs(newScale - this.currentScale) > 0.01) {
          const rect = viewerContainer.getBoundingClientRect();
          const cursorX = e.clientX - rect.left;
          const cursorY = e.clientY - rect.top;

          const scrollX = viewerContainer.scrollLeft;
          const scrollY = viewerContainer.scrollTop;
          const prevScale = this.currentScale;

          this.setZoom(newScale);

          const scaleRatio = newScale / prevScale;
          viewerContainer.scrollLeft = (scrollX + cursorX) * scaleRatio - cursorX;
          viewerContainer.scrollTop = (scrollY + cursorY) * scaleRatio - cursorY;
        }
      }
    }, { passive: false });

    // Hand Tool & Middle-Mouse Pan Support
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let scrollStartX = 0;
    let scrollStartY = 0;

    viewerContainer?.addEventListener('mousedown', (e: MouseEvent) => {
      // Pan if Hand tool is active (left-click) OR middle mouse click (button 1)
      if ((this.activeTool === 'hand' && e.button === 0) || e.button === 1) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        scrollStartX = viewerContainer.scrollLeft;
        scrollStartY = viewerContainer.scrollTop;
        viewerContainer.classList.add('panning');
        viewerContainer.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (isPanning && viewerContainer) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        viewerContainer.scrollLeft = scrollStartX - dx;
        viewerContainer.scrollTop = scrollStartY - dy;
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        if (viewerContainer) {
          viewerContainer.classList.remove('panning');
          viewerContainer.style.cursor = this.activeTool === 'hand' ? 'grab' : '';
        }
      }
    });

    window.addEventListener('blur', () => {
      if (isPanning && viewerContainer) {
        isPanning = false;
        viewerContainer.classList.remove('panning');
        viewerContainer.style.cursor = this.activeTool === 'hand' ? 'grab' : '';
      }
    });

    // Wire file picker input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      for (const file of files) {
        await this.loadFile(file);
      }
      fileInput.value = '';
    });

    // Wire empty state buttons
    document.getElementById('empty-open-btn')?.addEventListener('click', () => this.triggerFilePicker());
    document.getElementById('empty-sample-btn')?.addEventListener('click', () => this.loadSample());

    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      this.applyPresentationMode(isFullscreen);
    });
  }

  private initDropzone(): void {
    const dropzone = document.getElementById('dropzone');
    const globalOverlay = document.getElementById('global-drag-overlay');
    let dragCounter = 0;

    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('dragenter', (e: DragEvent) => {
      handleDrag(e);
      dragCounter++;
      if (this.currentDoc) {
        if (globalOverlay) globalOverlay.style.display = 'flex';
      } else {
        dropzone?.classList.add('dragover');
      }
    });

    window.addEventListener('dragover', (e: DragEvent) => {
      handleDrag(e);
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('dragleave', (e: DragEvent) => {
      handleDrag(e);
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropzone?.classList.remove('dragover');
        if (globalOverlay) globalOverlay.style.display = 'none';
      }
    });

    window.addEventListener('drop', async (e: DragEvent) => {
      handleDrag(e);
      dragCounter = 0;
      dropzone?.classList.remove('dragover');
      if (globalOverlay) globalOverlay.style.display = 'none';
      const files = Array.from(e.dataTransfer?.files || []);
      const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      const imgFiles = files.filter(f => f.type.startsWith('image/'));

      if (pdfFiles.length === 0 && imgFiles.length > 0) {
        if (!this.currentDoc) {
          NotificationService.show('Please open a PDF document first before adding images.', 4000, true);
          return;
        }
        for (const imgFile of imgFiles) {
          try {
            const processed = await processImageFile(imgFile);
            this.pasteImageOntoCurrentPage(processed);
          } catch {
            NotificationService.show('Failed to load dropped image.', 3000, true);
          }
        }
        return;
      }

      if (pdfFiles.length === 0 && files.length > 0) {
        NotificationService.show('Please drop standard PDF documents or images.', 4000, true);
        return;
      }

      for (const file of pdfFiles) {
        await this.loadFile(file);
      }
    });
  }

  private initClipboardPaste(): void {
    window.addEventListener('paste', async (e: ClipboardEvent) => {
      // Ignore if user is typing or pasting into an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            try {
              const processed = await processImageFile(file);
              this.pasteImageOntoCurrentPage(processed);
            } catch {
              NotificationService.show('Failed to paste image.', 3000, true);
            }
          }
          break;
        }
      }
    });
  }

  public pasteImageOntoCurrentPage(processed: ProcessedImage): void {
    if (!this.currentDoc) {
      NotificationService.show('Open a PDF document first before placing images.', 3000, true);
      return;
    }
    const pageIdx = Math.max(0, this.currentPageNumber - 1);
    const dims = this.currentDoc.pageDimensions[pageIdx] || { width: 595, height: 842 };
    const x = Math.round((dims.width - processed.width) / 2);
    const y = Math.round((dims.height - processed.height) / 2);

    const imgAnn: ImageAnnotation = {
      id: 'img_' + Math.random().toString(36).substring(2, 9),
      type: 'image',
      pageIndex: pageIdx,
      dataUrl: processed.dataUrl,
      x: Math.max(10, x),
      y: Math.max(10, y),
      width: processed.width,
      height: processed.height,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.annotationManager.addAnnotation(imgAnn);
    this.annotationManager.selectAnnotation(imgAnn.id);
    this.setActiveTool('select');
    NotificationService.show(`Image placed onto Page ${pageIdx + 1}!`);
  }

  private initShortcuts(): void {
    let isSpacePressed = false;
    let toolBeforeSpace: ToolType = 'select';

    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing into input or textarea (unless pressing Escape)
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.key !== 'Escape') {
          return;
        }
      }

      // Spacebar temporary hand pan
      if (e.code === 'Space' && !isSpacePressed) {
        isSpacePressed = true;
        toolBeforeSpace = this.activeTool;
        this.setActiveTool('hand');
        e.preventDefault();
        return;
      }

      // Arrow keys pixel nudge for selected annotations
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const selectedId = this.annotationManager.getSelectedId();
        if (selectedId) {
          const ann = this.annotationManager.getAnnotation(selectedId);
          if (ann) {
            const step = e.shiftKey ? 10 : 1;
            let dx = 0;
            let dy = 0;
            if (e.key === 'ArrowLeft') dx = -step;
            else if (e.key === 'ArrowRight') dx = step;
            else if (e.key === 'ArrowUp') dy = -step;
            else if (e.key === 'ArrowDown') dy = step;

            if ('x' in ann && 'y' in ann) {
              e.preventDefault();
              this.annotationManager.updateAnnotation(selectedId, {
                x: ann.x + dx,
                y: ann.y + dy
              });
              return;
            } else if ('x1' in ann && 'y1' in ann && 'x2' in ann && 'y2' in ann) {
              e.preventDefault();
              this.annotationManager.updateAnnotation(selectedId, {
                x1: ann.x1 + dx,
                y1: ann.y1 + dy,
                x2: ann.x2 + dx,
                y2: ann.y2 + dy
              });
              return;
            } else if ('points' in ann && Array.isArray((ann as any).points)) {
              e.preventDefault();
              const shiftedPoints = (ann as any).points.map((p: any) => ({
                x: p.x + dx,
                y: p.y + dy
              }));
              this.annotationManager.updateAnnotation(selectedId, {
                points: shiftedPoints
              });
              return;
            }
          }
        } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.scrollToPage(this.currentPageNumber - 1);
        } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.scrollToPage(this.currentPageNumber + 1);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.sidebar.toggle();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.sidebar.open();
        const searchTab = document.querySelector('.sidebar-tab[data-tab="search"]') as HTMLElement;
        searchTab?.click();
        const searchInput = document.getElementById('sidebar-search-input') as HTMLInputElement;
        searchInput?.focus();
        searchInput?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        this.openGoToPageDialog();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
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
        this.exportPdf(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.triggerFilePicker();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') || (e.altKey && e.key.toLowerCase() === 'w')) {
        const active = this.sessionManager.getActiveSession();
        if (active) {
          e.preventDefault();
          this.closeTab(active.id);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'PageDown' || (e.key === 'Tab' && !e.shiftKey))) {
        const sessions = this.sessionManager.getAllSessions();
        if (sessions.length > 1) {
          e.preventDefault();
          const active = this.sessionManager.getActiveSession();
          const currentIdx = sessions.findIndex(s => s.id === active?.id);
          const nextIdx = (currentIdx + 1) % sessions.length;
          const nextSession = this.sessionManager.switchSession(sessions[nextIdx].id);
          if (nextSession) {
            this.tabBar.update(sessions, nextSession.id);
            this.applySession(nextSession);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey))) {
        const sessions = this.sessionManager.getAllSessions();
        if (sessions.length > 1) {
          e.preventDefault();
          const active = this.sessionManager.getActiveSession();
          const currentIdx = sessions.findIndex(s => s.id === active?.id);
          const prevIdx = (currentIdx - 1 + sessions.length) % sessions.length;
          const nextSession = this.sessionManager.switchSession(sessions[prevIdx].id);
          if (nextSession) {
            this.tabBar.update(sessions, nextSession.id);
            this.applySession(nextSession);
          }
        }
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
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          this.searchPrevious();
        } else {
          this.searchNext();
        }
      } else if (e.key === 'F11') {
        e.preventDefault();
        this.togglePresentationMode();
      } else if (e.key === '=' || e.key === '+') {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
        this.setZoom(this.currentScale * 1.15);
      } else if (e.key === '-') {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
        this.setZoom(this.currentScale / 1.15);
      } else if (e.key === '0') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.setZoom(1.0);
        } else {
          this.fitToPage();
        }
      } else if (e.key === '9') {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
        this.fitToWidth();
      } else if (e.key.toLowerCase() === 'j' || e.key === 'PageDown') {
        e.preventDefault();
        this.scrollToPage(this.currentPageNumber + 1);
      } else if (e.key.toLowerCase() === 'k' || e.key === 'PageUp') {
        e.preventDefault();
        this.scrollToPage(this.currentPageNumber - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.scrollToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        this.scrollToPage(this.pageManager.getPageCount());
      } else if (e.key.toLowerCase() === 'v') {
        this.setActiveTool('select');
      } else if (e.key.toLowerCase() === 'h') {
        this.setActiveTool('hand');
      } else if (e.key.toLowerCase() === 'l') {
        if (e.shiftKey || this.activeTool === 'highlight') {
          this.setActiveTool(this.activeTool === 'freehand_highlight' ? 'highlight' : 'freehand_highlight');
        } else {
          this.setActiveTool('highlight');
        }
      } else if (e.key.toLowerCase() === 'p') {
        this.setActiveTool('freehand');
      } else if (e.key.toLowerCase() === 'e') {
        this.setActiveTool('eraser');
      } else if (e.key.toLowerCase() === 't') {
        this.setActiveTool('text');
      } else if (e.key.toLowerCase() === 'r') {
        this.setActiveTool('rectangle');
      } else if (e.key.toLowerCase() === 'o') {
        this.setActiveTool('ellipse');
      } else if (e.key.toLowerCase() === 'a') {
        this.setActiveTool('arrow');
      } else if (e.key.toLowerCase() === 'x') {
        this.setActiveTool('redaction');
      } else if (e.key.toLowerCase() === 'u') {
        this.setActiveTool('measure');
      } else if (e.key.toLowerCase() === 'z' && !e.ctrlKey && !e.metaKey) {
        this.setActiveTool('loupe');
      } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        this.setActiveTool('snapshot');
      } else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        this.setActiveTool('stamp');
      } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        this.setActiveTool('sticky_note');
      } else if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const imgInput = document.getElementById('image-insert-input') as HTMLInputElement | null;
        imgInput?.click();
      } else if (e.key === 'Escape') {
        const orgOverlay = document.querySelector('.organizer-overlay');
        if (orgOverlay) {
          const cancelBtn = orgOverlay.querySelector('#org-cancel-btn') as HTMLButtonElement | null;
          if (cancelBtn) {
            cancelBtn.click();
          } else {
            orgOverlay.remove();
          }
          return;
        }

        const modalBackdrops = document.querySelectorAll('.modal-backdrop');
        if (modalBackdrops.length > 0) {
          const lastBackdrop = modalBackdrops[modalBackdrops.length - 1];
          lastBackdrop.remove();
          return;
        }

        this.contextMenu?.hide();
        this.textSelectionMenu?.hide();
        this.annotationManager.selectAnnotation(null);
        this.setActiveTool('select');
        window.getSelection()?.removeAllRanges();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = this.annotationManager.getSelectedId();
        if (selectedId) {
          e.preventDefault();
          this.annotationManager.removeAnnotation(selectedId);
          NotificationService.show('Selected item deleted');
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.sidebar.open();
        const searchTab = document.querySelector('.sidebar-tab[data-tab="search"]') as HTMLElement;
        searchTab?.click();
        const searchInput = document.getElementById('sidebar-search-input') as HTMLInputElement;
        searchInput?.focus();
        searchInput?.select();
      } else if (e.key === 'G' && e.shiftKey) {
        e.preventDefault();
        this.scrollToPage(this.pageManager.getPageCount());
      } else if (e.key === 'g' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const now = Date.now();
        if (now - this.lastGKeyTime < 400) {
          clearTimeout(this.gKeyTimeout);
          this.scrollToPage(1);
          this.lastGKeyTime = 0;
          return;
        }
        this.lastGKeyTime = now;
        clearTimeout(this.gKeyTimeout);
        this.gKeyTimeout = setTimeout(() => {
          this.openSignatureDialog();
        }, 400);
      } else if (e.key === '?') {
        new ShortcutsDialog(() => this.showFeedbackDialog()).open();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && isSpacePressed) {
        isSpacePressed = false;
        this.setActiveTool(toolBeforeSpace);
      }
    });

    window.addEventListener('blur', () => {
      if (isSpacePressed) {
        isSpacePressed = false;
        this.setActiveTool(toolBeforeSpace);
      }
    });

    let resizeTimer: any;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth <= 768 && this.currentDoc) {
          this.fitToWidth();
        }
      }, 150);
    });
  }

  public openGoToPageDialog(): void {
    if (!this.currentDoc) return;
    const totalPages = this.pageManager.getPageCount();
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';

    modalBackdrop.innerHTML = `
      <div class="modal-card" style="max-width: 320px; text-align: center;">
        <div class="modal-header">
          <h3>Go to Page</h3>
          <button class="icon-btn close-modal-btn" aria-label="Close dialog" title="Close dialog">✕</button>
        </div>
        <div class="modal-body" style="padding: 16px;">
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">Enter page number (1 – ${totalPages})</p>
          <input type="number" id="goto-page-input" aria-label="Target page number" min="1" max="${totalPages}" value="${this.currentPageNumber}" style="width: 100%; height: 38px; text-align: center; font-size: 1.15rem; font-weight: 600; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); outline: none;" />
        </div>
        <div class="modal-footer" style="justify-content: center; gap: 8px;">
          <button class="btn cancel-btn">Cancel</button>
          <button class="btn btn-primary jump-btn">Jump</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);
    const input = modalBackdrop.querySelector('#goto-page-input') as HTMLInputElement;
    input?.focus();
    input?.select();

    const doJump = () => {
      const target = parseInt(input.value, 10);
      if (!isNaN(target) && target >= 1 && target <= totalPages) {
        this.scrollToPage(target);
      }
      modalBackdrop.remove();
    };

    modalBackdrop.querySelector('.jump-btn')?.addEventListener('click', doJump);
    modalBackdrop.querySelector('.cancel-btn')?.addEventListener('click', () => modalBackdrop.remove());
    modalBackdrop.querySelector('.close-modal-btn')?.addEventListener('click', () => modalBackdrop.remove());
    input?.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') {
        doJump();
      } else if (ke.key === 'Escape') {
        modalBackdrop.remove();
      }
    });
    modalBackdrop.addEventListener('click', (me) => {
      if (me.target === modalBackdrop) modalBackdrop.remove();
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
      if (e?.name === 'PasswordException') {
        await this.promptPassword(file);
        return;
      }
      console.error(e);
      NotificationService.show('Failed to load PDF file: ' + (e?.message || 'Invalid or corrupted file'), 4000, true);
    }
  }

  public async promptPassword(file: File, isRetry: boolean = false): Promise<void> {
    return new Promise((resolve) => {
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

      const modalBackdrop = document.createElement('div');
      modalBackdrop.className = 'modal-backdrop';

      modalBackdrop.innerHTML = `
        <div class="modal-card" style="max-width: 360px;">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <h3 style="margin: 0; font-size: 1.15rem;">Password Protected</h3>
            </div>
            <button class="icon-btn close-modal-btn" aria-label="Close dialog" title="Close dialog">✕</button>
          </div>
          <div class="modal-body" style="padding: 16px;">
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
              ${isRetry ? '<span style="color: var(--danger-color); font-weight: 600;">Incorrect password.</span> ' : ''}
              This document is encrypted. Please enter the password to open <b>${file.name}</b>:
            </p>
            <div style="position: relative; display: flex; align-items: center;">
              <input type="password" id="pdf-password-input" aria-label="Document password" placeholder="Enter password..." style="width: 100%; height: 38px; padding: 0 38px 0 12px; font-size: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); outline: none;" />
              <button type="button" class="icon-btn" id="toggle-pw-visibility" aria-label="Show password" title="Show password" style="position: absolute; right: 6px; width: 28px; height: 28px; font-size: 0.95rem; cursor: pointer; z-index: 2;">👁️</button>
            </div>
          </div>
          <div class="modal-footer" style="justify-content: flex-end; gap: 8px;">
            <button class="btn cancel-btn" aria-label="Cancel">Cancel</button>
            <button class="btn btn-primary unlock-btn" aria-label="Unlock and Open">Unlock & Open</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalBackdrop);
      const input = modalBackdrop.querySelector('#pdf-password-input') as HTMLInputElement;
      const toggleBtn = modalBackdrop.querySelector('#toggle-pw-visibility') as HTMLButtonElement;

      setTimeout(() => {
        input?.focus();
      }, 50);

      toggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        toggleBtn.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
        toggleBtn.setAttribute('title', isPw ? 'Hide password' : 'Show password');
        input.focus();
      });

      const doUnlock = async () => {
        const password = input.value;
        modalBackdrop.remove();
        try {
          NotificationService.show(`Unlocking ${file.name}...`);
          const loaded = await PdfLoader.loadFromFile(file, password);
          await this.setDocument(loaded);
          NotificationService.show(`Unlocked & loaded ${file.name}!`);
          resolve();
        } catch (err: any) {
          if (err?.name === 'PasswordException') {
            await this.promptPassword(file, true);
            resolve();
          } else {
            console.error(err);
            NotificationService.show('Failed to unlock document: ' + (err?.message || 'Decryption failed'), 4000, true);
            resolve();
          }
        }
      };

      input?.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doUnlock();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          modalBackdrop.remove();
          resolve();
        }
      });

      modalBackdrop.querySelector('.unlock-btn')?.addEventListener('click', doUnlock);
      modalBackdrop.querySelector('.cancel-btn')?.addEventListener('click', () => {
        modalBackdrop.remove();
        resolve();
      });
      modalBackdrop.querySelector('.close-modal-btn')?.addEventListener('click', () => {
        modalBackdrop.remove();
        resolve();
      });
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
          modalBackdrop.remove();
          resolve();
        }
      });
    });
  }

  public generateAnnotationReport(annotations: Annotation[], fileName: string): string {
    let md = `# ZephyrPDF Annotation Report\n\n`;
    md += `**Document:** ${fileName}\n`;
    md += `**Export Date:** ${new Date().toLocaleString()}\n`;
    md += `**Total Annotations:** ${annotations.length}\n\n`;

    // Group by page
    const byPage = new Map<number, Annotation[]>();
    for (const ann of annotations) {
      const p = ann.pageIndex + 1;
      if (!byPage.has(p)) byPage.set(p, []);
      byPage.get(p)!.push(ann);
    }

    const sortedPages = Array.from(byPage.keys()).sort((a, b) => a - b);
    for (const p of sortedPages) {
      md += `## Page ${p}\n\n`;
      for (const ann of byPage.get(p)!) {
        let desc = '';
        if (ann.type === 'text') desc = `"${ann.text}"`;
        else if (ann.type === 'measure') desc = `Distance: ${ann.formattedValue || (ann.distancePt + ' pt')}`;
        else if (ann.type === 'stamp') desc = `Stamp: ${ann.stampType}`;
        else if (ann.type === 'sticky_note') desc = `Comment: "${ann.content || ann.title || 'Note'}"`;
        else if (ann.type === 'redaction') desc = `Redaction: [${ann.overlayText || 'REDACTED'}]`;
        else if (ann.type === 'highlight') desc = `Highlight (${ann.rects?.length || 1} text areas)`;
        else if (ann.type === 'image') desc = `Image (${Math.round(ann.width)}×${Math.round(ann.height)})`;
        else if (ann.type === 'signature') desc = `Signature`;
        else if (ann.type === 'arrow') desc = `Arrow (${Math.round(ann.x1)}, ${Math.round(ann.y1)}) → (${Math.round(ann.x2)}, ${Math.round(ann.y2)})`;
        else if (ann.type === 'line') desc = `Line (${Math.round(ann.x1)}, ${Math.round(ann.y1)}) → (${Math.round(ann.x2)}, ${Math.round(ann.y2)})`;
        else if (ann.type === 'rectangle') desc = `Rectangle (${Math.round(ann.width)}×${Math.round(ann.height)})`;
        else if (ann.type === 'ellipse') desc = `Ellipse (${Math.round(ann.width)}×${Math.round(ann.height)})`;
        else if (ann.type === 'freehand') desc = `Pen Drawing (${ann.points?.length || 0} pts)`;
        else desc = `Color ${(ann as any).color || (ann as any).strokeColor || ''}`;

        md += `- **[${ann.type.toUpperCase()}]** ${desc}\n`;
      }
      md += `\n`;
    }
    return md;
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
      NotificationService.show('Failed to generate sample PDF: ' + (e?.message || 'Generation error'), 4000, true);
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
    this.mergedDocs = session.mergedDocs || new Map();
    this.loadedMergedPdfjsDocs = session.loadedMergedPdfjsDocs || new Map();
    session.mergedDocs = this.mergedDocs;
    session.loadedMergedPdfjsDocs = this.loadedMergedPdfjsDocs;

    this.tabBar?.update(this.sessionManager.getAllSessions(), session.id);
    document.title = `${session.doc.metadata.fileName} · ZephyrPDF`;

    this.contextMenu?.setAnnotationManager(this.annotationManager);
    this.textSelectionMenu?.setAnnotationManager(this.annotationManager);

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
    if (window.innerWidth <= 768) {
      this.fitToWidth();
    }
    this.updatePageHUD();
  }

  public async closeTab(sessionId: string): Promise<void> {
    const nextSession = this.sessionManager.closeSession(sessionId);
    this.tabBar.update(this.sessionManager.getAllSessions(), nextSession ? nextSession.id : null);
    if (nextSession) {
      await this.applySession(nextSession);
    } else {
      this.closeAllSessions();
    }
  }

  public closeAllSessions(): void {
    this.currentDoc = null;
    document.getElementById('empty-state')!.style.display = 'flex';
    document.getElementById('pages-wrapper')!.style.display = 'none';
    document.getElementById('floating-hud')!.style.display = 'none';
    this.sidebar.setOutline([]);
    this.sidebar.setAnnotations([]);
    this.sidebar.setThumbnails([]);
    this.searchEngine.reset();
    this.clearSearchHighlights();
    this.mergedDocs.clear();
    this.loadedMergedPdfjsDocs.clear();
    document.title = 'ZephyrPDF · The Featherlight Open-Source PDF Viewer & Editor';
  }

  private async generateThumbnails(doc: LoadedDocument): Promise<void> {
    this.pageThumbnails.clear();
    const thumbs: { pageNumber: number; dataUrl: string }[] = [];
    const pages = this.pageManager.getPages();

    for (let i = 1; i <= doc.pdfjsDoc.numPages; i++) {
      const page = await doc.pdfjsDoc.getPage(i);
      const url = await this.renderer.renderThumbnail(page, 140);
      const pageItem = pages[i - 1];
      if (pageItem) {
        this.pageThumbnails.set(pageItem.id, url);
      }
      thumbs.push({ pageNumber: i, dataUrl: url });
    }

    this.sidebar.setThumbnails(thumbs);
  }

  private updateSidebarThumbnails(): void {
    if (!this.currentDoc) return;
    const pages = this.pageManager.getPages();
    const thumbs: { pageNumber: number; dataUrl: string; rotation?: number }[] = [];

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const url = this.pageThumbnails.get(p.id) || '';
      thumbs.push({ pageNumber: p.pageNumber, dataUrl: url, rotation: p.rotation });
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

      let overlayWidth = 0;
      let overlayHeight = 0;

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
        overlayWidth = w;
        overlayHeight = h;
      } else {
        let fromDoc = this.currentDoc.pdfjsDoc;
        if (pageItem.sourceDocId && this.loadedMergedPdfjsDocs.has(pageItem.sourceDocId)) {
          fromDoc = this.loadedMergedPdfjsDocs.get(pageItem.sourceDocId)!;
        }
        const pageProxy = await fromDoc.getPage(pageItem.originalIndex + 1);
        const viewport = await this.renderer.renderPageToCanvas(pageProxy, canvas, {
          scale: this.currentScale,
          rotation: pageItem.rotation,
          theme: this.currentTheme
        });

        // Create transparent PDF.js text layer for native text selection and markup
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
        textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
        pageContainer.appendChild(textLayerDiv);
        this.renderer.renderTextLayer(pageProxy, textLayerDiv, viewport).catch(() => {});

        overlayWidth = viewport.width;
        overlayHeight = viewport.height;
      }

      const effectivePageIndex = pageItem.originalIndex >= 0 ? pageItem.originalIndex : i;

      const overlay = new PageAnnotationOverlay(pageContainer, effectivePageIndex, this.annotationManager, {
        getScale: () => this.currentScale,
        getActiveTool: () => this.activeTool,
        getActiveColor: () => this.activeColor,
        getActiveStrokeWidth: () => this.activeStrokeWidth,
        getActiveStamp: () => this.activeStamp,
        getActiveSignature: () => this.activeSignature,
        getActiveMeasureUnit: () => this.activeMeasureUnit,
        getActiveImage: () => this.activeImage,
        getActiveWatermark: () => this.watermarkOptions,
        contextMenu: this.contextMenu,
        onResetTool: () => {
          this.setActiveTool('select');
        }
      });
      overlay.updateSize(overlayWidth, overlayHeight);
      this.pageOverlays.set(effectivePageIndex, overlay);

      // Render interactive AcroForm fields if present
      const fields = this.formHandler.getFieldsForPage(effectivePageIndex);
      if (fields.length > 0) {
        const formLayer = document.createElement('div');
        formLayer.className = 'form-fields-layer';
        const docPageHeight = overlayHeight / this.currentScale;

        for (const f of fields) {
          const topPx = (docPageHeight - (f.bounds.y + f.bounds.height)) * this.currentScale;
          const leftPx = f.bounds.x * this.currentScale;
          const widthPx = f.bounds.width * this.currentScale;
          const heightPx = f.bounds.height * this.currentScale;

          if (f.type === 'checkbox') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'pdf-acro-checkbox';
            cb.setAttribute('aria-label', f.name);
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
            const isMultiline = f.bounds.height > 35;
            const input = document.createElement(isMultiline ? 'textarea' : 'input');
            if (!isMultiline) (input as HTMLInputElement).type = 'text';
            input.className = 'pdf-acro-input';
            if (isMultiline) input.classList.add('pdf-acro-textarea');
            input.setAttribute('aria-label', f.name);
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

    this.updateSidebarThumbnails();
    this.updateSinglePageVisibility();

    const searchState = this.searchEngine.getState();
    if (searchState.query) {
      this.updateSearchHighlights(searchState.query, searchState.caseSensitive, searchState.matchWholeWords, searchState.currentMatchIndex);
    }
  }

  public clearSearchHighlights(): void {
    const marks = document.querySelectorAll('.textLayer mark.search-highlight');
    marks.forEach(m => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ''), m);
        parent.normalize();
      }
    });
  }

  public updateSearchHighlights(query: string, caseSensitive: boolean, matchWholeWords: boolean, activeIndex: number): void {
    this.clearSearchHighlights();
    if (!query || query.trim() === '') return;

    let globalIndex = 0;
    const containers = document.querySelectorAll('.textLayer');
    const escaped = query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
    const pattern = matchWholeWords ? `\\b${escaped}\\b` : escaped;
    const regex = new RegExp(`(${pattern})`, caseSensitive ? 'g' : 'gi');

    containers.forEach(container => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      const textNodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      for (const textNode of textNodes) {
        const parent = textNode.parentNode as HTMLElement;
        if (parent && parent.nodeName === 'MARK') continue;
        const text = textNode.nodeValue || '';
        if (!regex.test(text)) continue;
        regex.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
          }
          const matchIdx = globalIndex++;
          const mark = document.createElement('mark');
          mark.className = matchIdx === activeIndex ? 'search-highlight active' : 'search-highlight';
          mark.setAttribute('data-match-index', matchIdx.toString());
          mark.textContent = match[0];
          frag.appendChild(mark);
          lastIdx = regex.lastIndex;
        }
        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIdx)));
        }
        parent.replaceChild(frag, textNode);
      }
    });

    const activeMark = document.querySelector('.textLayer mark.search-highlight.active') as HTMLElement;
    activeMark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  public setActiveSearchMatch(index: number): void {
    const prevActive = document.querySelector('.textLayer mark.search-highlight.active');
    prevActive?.classList.remove('active');

    const newActive = document.querySelector(`.textLayer mark.search-highlight[data-match-index="${index}"]`) as HTMLElement;
    if (newActive) {
      newActive.classList.add('active');
      newActive.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  public searchGoToMatch(index: number): void {
    const match = this.searchEngine.selectMatch(index);
    if (match) {
      const state = this.searchEngine.getState();
      this.sidebar.setSearchResults(state.matches, state.currentMatchIndex);
      if (this.currentPageNumber !== match.pageIndex + 1) {
        this.scrollToPage(match.pageIndex + 1);
      }
      this.setActiveSearchMatch(state.currentMatchIndex);
    }
  }

  public searchNext(): void {
    const match = this.searchEngine.next();
    if (match) {
      const state = this.searchEngine.getState();
      this.sidebar.setSearchResults(state.matches, state.currentMatchIndex);
      if (this.currentPageNumber !== match.pageIndex + 1) {
        this.scrollToPage(match.pageIndex + 1);
      }
      this.setActiveSearchMatch(state.currentMatchIndex);
    }
  }

  public searchPrevious(): void {
    const match = this.searchEngine.previous();
    if (match) {
      const state = this.searchEngine.getState();
      this.sidebar.setSearchResults(state.matches, state.currentMatchIndex);
      if (this.currentPageNumber !== match.pageIndex + 1) {
        this.scrollToPage(match.pageIndex + 1);
      }
      this.setActiveSearchMatch(state.currentMatchIndex);
    }
  }

  public togglePresentationMode(): void {
    const isEntering = !document.fullscreenElement && !document.body.classList.contains('presentation-mode');
    if (isEntering) {
      const select = document.getElementById('view-mode-select') as HTMLSelectElement;
      if (select && select.value !== 'presentation') {
        this.prePresentationViewMode = (select.value as ViewMode) || 'continuous';
      }
      const promise = document.documentElement.requestFullscreen?.();
      if (promise) {
        promise.catch(() => {
          this.applyPresentationMode(true);
        });
      } else {
        this.applyPresentationMode(true);
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      this.applyPresentationMode(false);
    }
  }

  public applyPresentationMode(active: boolean): void {
    document.body.classList.toggle('presentation-mode', active);
    const viewerContainer = document.getElementById('viewer-container');
    const select = document.getElementById('view-mode-select') as HTMLSelectElement;

    if (active) {
      viewerContainer?.classList.remove('mode-two-page');
      viewerContainer?.classList.add('mode-single');
      this.updateSinglePageVisibility();
      this.fitToPage();
      if (select) select.value = 'presentation';
    } else {
      viewerContainer?.classList.remove('mode-single');
      viewerContainer?.classList.remove('mode-two-page');

      if (this.prePresentationViewMode === 'two-page') {
        viewerContainer?.classList.add('mode-two-page');
      } else if (this.prePresentationViewMode === 'single') {
        viewerContainer?.classList.add('mode-single');
        this.updateSinglePageVisibility();
      }
      if (select) select.value = this.prePresentationViewMode;
      this.scrollToPage(this.currentPageNumber);
    }
  }

  public showFeedbackDialog(): void {
    const viewSelect = document.getElementById('view-mode-select') as HTMLSelectElement;
    const viewMode = viewSelect?.value || 'continuous';
    new FeedbackDialog({
      version: APP_VERSION,
      currentPage: this.currentPageNumber,
      pageCount: this.pageManager.getPageCount() || 1,
      zoom: this.currentScale,
      theme: this.currentTheme,
      viewMode: viewMode,
    }).open();
  }

  public setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
    this.toolbar.setActiveTool(tool);
    const vc = document.getElementById('viewer-container');
    if (vc) {
      vc.classList.toggle('tool-hand', tool === 'hand');
      vc.style.cursor = tool === 'hand' ? 'grab' : '';
    }
    this.loupe.setActive(tool === 'loupe');
    for (const overlay of this.pageOverlays.values()) {
      overlay.setTool(tool);
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
    const isMobile = window.innerWidth <= 768;
    const padding = isMobile ? 16 : 80;
    const availableWidth = Math.max(160, container.clientWidth - padding);
    this.setZoom(availableWidth / pageWidth);
  }

  public fitToPage(): void {
    const container = document.getElementById('viewer-container');
    if (!container || !this.currentDoc || this.currentDoc.pageDimensions.length === 0) return;
    const pageHeight = this.currentDoc.pageDimensions[0].height;
    const isMobile = window.innerWidth <= 768;
    const padding = isMobile ? 24 : 80;
    const availableHeight = Math.max(160, container.clientHeight - padding);
    this.setZoom(availableHeight / pageHeight);
  }

  public scrollToPage(pageNumber: number): void {
    const total = this.pageManager.getPageCount();
    const clamped = Math.max(1, Math.min(total, pageNumber));
    this.currentPageNumber = clamped;

    this.updateSinglePageVisibility();

    const el = document.querySelector(`.page-container[data-page="${clamped}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.updatePageHUD();
    this.sidebar.setCurrentPage(clamped);
  }

  private updateSinglePageVisibility(): void {
    const viewerContainer = document.getElementById('viewer-container');
    if (viewerContainer?.classList.contains('mode-single')) {
      const allPages = document.querySelectorAll('.page-container');
      allPages.forEach(p => {
        const pageNum = parseInt(p.getAttribute('data-page') || '0', 10);
        if (pageNum === this.currentPageNumber) {
          p.classList.add('active-single-page');
        } else {
          p.classList.remove('active-single-page');
        }
      });
    }
  }

  private updatePageHUD(): void {
    const currentInput = document.getElementById('hud-current-page') as HTMLInputElement;
    const totalLabel = document.getElementById('hud-total-pages');
    const total = this.pageManager.getPageCount();

    if (currentInput && document.activeElement !== currentInput) {
      currentInput.value = this.currentPageNumber.toString();
    }
    if (totalLabel) totalLabel.textContent = total.toString();
  }

  public setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.renderDocument();
    NotificationService.show(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
  }

  public openSignatureDialog(): void {
    new SignatureDialog((dataUrl) => {
      this.activeSignature = dataUrl;
      this.setActiveTool('signature');
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
        this.loadedMergedPdfjsDocs.set(docId, loaded.pdfjsDoc);
        this.pageManager.appendDocumentPages(
          docId,
          loaded.metadata.pageCount,
          loaded.pageDimensions
        );

        // Render thumbnails for merged pages
        const currentPages = this.pageManager.getPages();
        const mergedPages = currentPages.filter(p => p.sourceDocId === docId);
        for (let i = 0; i < mergedPages.length; i++) {
          const pageItem = mergedPages[i];
          const page = await loaded.pdfjsDoc.getPage(pageItem.originalIndex + 1);
          const url = await this.renderer.renderThumbnail(page, 140);
          this.pageThumbnails.set(pageItem.id, url);
        }

        NotificationService.show(`Merged ${file.name} successfully!`);
      },
      onExtractPages: async (indices: number[]) => {
        if (!this.currentDoc) return;
        NotificationService.show(`Extracting ${indices.length} pages...`);
        const tempManager = new PageManager(new HistoryManager());
        const activePages = this.pageManager.getPages();
        const extractedItems = indices.map(idx => activePages[idx]).filter(Boolean);

        tempManager.restorePages(extractedItems.map(p => ({ ...p })));

        const extractedBytes = await PdfExporter.exportDocument(
          this.currentDoc.data,
          tempManager,
          this.annotationManager,
          this.formHandler,
          this.mergedDocs,
          false,
          this.watermarkOptions,
          this.pageNumberOptions,
          this.currentDoc.metadata
        );

        const baseName = this.currentDoc.metadata.fileName.replace(/\.pdf$/i, '');
        PdfExporter.downloadBlob(extractedBytes, `${baseName}_extracted.pdf`);
        NotificationService.show('Extracted pages downloaded successfully!');
      }
    }).open();
  }

  public async exportPdf(flattenForm: boolean = false): Promise<void> {
    if (!this.currentDoc) {
      NotificationService.show('No document open to save.', 3000, true);
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
      NotificationService.show('Failed to export PDF: ' + (e?.message || 'Export error'), 4000, true);
    }
  }
}

declare global {
  interface Window {
    zephyrApp?: ZephyrPDFApp;
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.zephyrApp = new ZephyrPDFApp();
});
