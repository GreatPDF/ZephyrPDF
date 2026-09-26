import { MeasureUnit, ToolType } from '../types/annotations';
import { ThemeMode, ViewMode } from '../types/document';
import { PRESET_COLORS } from '../utils/color';

export interface ToolbarEvents {
  onOpenFile: () => void;
  onOpenSample: () => void;
  onSaveExport: () => void;
  onSaveFlatten?: () => void;
  onPrint: () => void;
  onToggleOrganizer: () => void;
  onToggleSidebar?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFitWidth: () => void;
  onZoomFitPage: () => void;
  onToolSelect: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onStampChange: (stamp: string) => void;
  onSignatureClick: () => void;
  onThemeToggle: (theme: ThemeMode) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onShowShortcuts: () => void;
  onShowMetadata: () => void;
  onShowFeedback?: () => void;
  onMeasureUnitChange?: (unit: MeasureUnit) => void;
  onCompareFile?: (file: File) => Promise<void>;
  onInsertImage?: (file: File) => void;
  onWatermarkClick?: () => void;
  onOptimizeClick?: () => void;
  onExtractText?: () => void;
  onAddFieldClick?: () => void;
  onResetZoom?: () => void;
}

export class AppToolbar {
  private container: HTMLElement;
  private events: ToolbarEvents;
  private activeTool: ToolType = 'select';
  private activeColor: string = PRESET_COLORS.highlighterYellow;
  private activeStrokeWidth: number = 2;
  private activeStamp: string = 'APPROVED';
  private activeMeasureUnit: MeasureUnit = 'mm';
  private activeTheme: ThemeMode = 'dark';
  private activeZoom: number = 1.0;

  constructor(container: HTMLElement, events: ToolbarEvents) {
    this.container = container;
    this.events = events;
    this.render();
  }

  public getActiveTool(): ToolType { return this.activeTool; }
  public getActiveColor(): string { return this.activeColor; }
  public getActiveStrokeWidth(): number { return this.activeStrokeWidth; }
  public getActiveStamp(): string { return this.activeStamp; }
  public getActiveMeasureUnit(): MeasureUnit { return this.activeMeasureUnit; }
  public getActiveTheme(): ThemeMode { return this.activeTheme; }
  public getActiveZoom(): number { return this.activeZoom; }

  public setActiveTool(tool: ToolType): void {
    this.activeTool = tool;
    this.container.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
  }

  public setActiveColor(color: string): void {
    this.activeColor = color;
    this.container.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch.getAttribute('data-color') === color);
    });
  }

  public setActiveStrokeWidth(width: number): void {
    this.activeStrokeWidth = width;
    const strokeSelect = this.container.querySelector('#stroke-width-select') as HTMLSelectElement | null;
    if (strokeSelect) {
      strokeSelect.value = width.toString();
    }
  }

  public setZoom(zoom: number): void {
    this.activeZoom = zoom;
    const zoomText = this.container.querySelector('#zoom-label');
    if (zoomText) {
      const pct = Math.round(zoom * 100);
      zoomText.textContent = `${pct}%`;
      zoomText.setAttribute('aria-label', `Zoom level ${pct}%. Click to reset to 100%`);
      zoomText.setAttribute('title', `Current zoom: ${pct}%. Click to reset to 100%`);
    }
  }

  public setHistoryState(canUndo: boolean, canRedo: boolean): void {
    const undoBtn = this.container.querySelector('#undo-btn') as HTMLButtonElement;
    const redoBtn = this.container.querySelector('#redo-btn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  }

  private render(): void {
    const existing = this.container.querySelector('.toolbars-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'toolbars-wrapper';
    wrapper.innerHTML = `
      <div class="primary-toolbar">
        <div class="toolbar-group">
          <button class="icon-btn" id="sidebar-toggle-btn" title="Toggle Sidebar (Ctrl+B)" aria-label="Toggle Sidebar (Ctrl+B)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>

          <div class="brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>ZephyrPDF</span>
            <span class="brand-badge">PRO OSS</span>
          </div>

          <div class="toolbar-divider"></div>

          <button class="btn" id="open-file-btn" title="Open PDF File (Ctrl+O)" aria-label="Open PDF File (Ctrl+O)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>Open</span>
          </button>

          <button class="btn" id="sample-file-btn" title="Load Showcase Document" aria-label="Load Showcase Document">
            <span>Sample Doc</span>
          </button>

          <button class="btn btn-primary" id="save-file-btn" title="Export & Save Standard PDF (Ctrl+S)" aria-label="Export & Save Standard PDF (Ctrl+S)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>Save PDF</span>
          </button>

          <button class="btn" id="save-flatten-btn" title="Flatten & Lock Form Fields upon Save" aria-label="Flatten & Lock Form Fields upon Save">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <span>Flatten</span>
          </button>

          <button class="icon-btn" id="print-btn" title="Print (Ctrl+P)" aria-label="Print Document (Ctrl+P)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>

          <div class="toolbar-divider"></div>

          <button class="btn" id="organizer-btn" title="Manage & Reorder Pages" aria-label="Manage & Reorder Pages">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Organize Pages</span>
          </button>

          <button class="btn" id="compare-btn" title="Compare against another PDF" aria-label="Compare against another PDF">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"></path><path d="M8 21H3v-5"></path><path d="M21 3 14 10"></path><path d="M3 21l7-7"></path></svg>
            <span>Compare</span>
          </button>
          <input type="file" id="compare-file-input" accept="application/pdf" style="display: none;" />

          <button class="btn" id="watermark-btn" title="Watermark & Page Numbering" aria-label="Watermark & Page Numbering">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
            <span>Watermark</span>
          </button>

          <button class="btn" id="add-field-btn" title="Add Fillable Form Field (Text or Checkbox)" aria-label="Add Fillable Form Field (Text or Checkbox)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span>+ Field</span>
          </button>

          <button class="btn" id="optimize-btn" title="Compress & Optimize PDF File Size" aria-label="Compress & Optimize PDF File Size">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg>
            <span>Compress</span>
          </button>

          <button class="btn" id="export-text-btn" title="Extract Full Document Text / Markdown" aria-label="Extract Full Document Text / Markdown">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span>Extract Text</span>
          </button>
        </div>

        <!-- Center Undo/Redo & Zoom Controls -->
        <div class="toolbar-group">
          <button class="icon-btn" id="undo-btn" title="Undo (Ctrl+Z)" aria-label="Undo (Ctrl+Z)" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
          </button>
          <button class="icon-btn" id="redo-btn" title="Redo (Ctrl+Y)" aria-label="Redo (Ctrl+Y)" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
          </button>

          <div class="toolbar-divider"></div>

          <button class="icon-btn" id="zoom-out-btn" title="Zoom Out (-)" aria-label="Zoom Out (-)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <span id="zoom-label" role="button" tabindex="0" title="Click to Reset Zoom (100%)" aria-label="Reset zoom to 100%" style="font-size: 0.85rem; font-weight: 600; min-width: 48px; text-align: center; cursor: pointer; user-select: none;">100%</span>
          <button class="icon-btn" id="zoom-in-btn" title="Zoom In (+)" aria-label="Zoom In (+)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button class="icon-btn" id="zoom-fit-width-btn" title="Fit to Width (9)" aria-label="Fit to Width (9)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 9 4 4 9 4"></polyline><polyline points="20 9 20 4 15 4"></polyline><polyline points="4 15 4 20 9 20"></polyline><polyline points="20 15 20 20 15 20"></polyline></svg>
          </button>
          <button class="icon-btn" id="zoom-fit-page-btn" title="Fit to Page (0)" aria-label="Fit to Page (0)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
          </button>

          <div class="toolbar-divider"></div>

          <select id="view-mode-select" title="Document View Mode" aria-label="Document View Mode" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 2px 6px; font-size: 0.8rem;">
            <option value="continuous" selected>Continuous</option>
            <option value="single">Single Page</option>
            <option value="two-page">Two-Page</option>
            <option value="presentation">Presentation</option>
          </select>
        </div>

        <!-- Right Side Settings & Dialogs -->
        <div class="toolbar-group">
          <button class="icon-btn" id="theme-toggle-btn" title="Toggle Reading Theme (Dark/Light/Sepia)" aria-label="Toggle Reading Theme (Dark/Light/Sepia)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>

          <button class="icon-btn" id="feedback-btn" title="Feedback & Bug Report (No account needed)" aria-label="Feedback and Bug Report">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="9" y1="10" x2="9.01" y2="10" stroke-width="3"></line><line x1="12" y1="10" x2="12.01" y2="10" stroke-width="3"></line><line x1="15" y1="10" x2="15.01" y2="10" stroke-width="3"></line></svg>
          </button>

          <button class="icon-btn" id="meta-btn" title="Document Properties" aria-label="Document Properties and Metadata">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </button>

          <button class="icon-btn" id="shortcuts-btn" title="Keyboard Shortcuts (?)" aria-label="Keyboard Shortcuts">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </button>
        </div>
      </div>

      <!-- Secondary Toolbar for Editing & Markup Tools -->
      <div class="annotation-toolbar">
        <div class="toolbar-group">
          <button class="icon-btn tool-btn active" data-tool="select" title="Select / Move (v)" aria-label="Select Tool (v)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 7 18 3-7 7-3L3 3z"></path></svg>
          </button>
          <button class="icon-btn tool-btn" data-tool="hand" title="Hand / Pan (h)" aria-label="Hand Pan Tool (h)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v5"></path><path d="M14 10V4a2 2 0 0 0-4 0v6"></path><path d="M10 10.5V6a2 2 0 0 0-4 0v8"></path><path d="M18 8a2 2 0 0 1 4 4v4a8 8 0 0 1-16 0v-2"></path></svg>
          </button>
          <button class="icon-btn tool-btn" data-tool="loupe" title="Magnifier / Loupe Lens (z)" aria-label="Magnifier Loupe Lens (z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button class="icon-btn tool-btn" data-tool="snapshot" title="Marquee Snapshot Copy Tool (c)" aria-label="Marquee Snapshot Tool (c)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </button>

          <div class="toolbar-divider"></div>

          <button class="icon-btn tool-btn" data-tool="highlight" title="Text Highlighter (l)" aria-label="Text Highlighter (l)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"></path><path d="m22 2-2.7 2.7a2.5 2.5 0 0 0 0 3.5l1.5 1.5a2.5 2.5 0 0 0 3.5 0L27 7"></path><path d="m14 4 6 6"></path></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="freehand_highlight" title="Chisel Freehand Highlighter" aria-label="Chisel Freehand Highlighter">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"></path><path d="m5 18 3-3"></path><path d="m15 7 2-2a2.83 2.83 0 0 1 4 4l-2 2"></path></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="freehand" title="Pen / Freehand Draw (p)" aria-label="Pen Freehand Draw (p)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="eraser" title="Eraser (e)" aria-label="Eraser Tool (e)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="text" title="Add Text Box (t)" aria-label="Add Text Box (t)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="rectangle" title="Rectangle (r)" aria-label="Rectangle Shape (r)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="ellipse" title="Ellipse (o)" aria-label="Ellipse Shape (o)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="arrow" title="Arrow / Line (a)" aria-label="Arrow Line (a)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="redaction" title="Permanent Redaction / Blackout (x)" aria-label="Permanent Redaction Blackout (x)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"></rect><line x1="3" y1="3" x2="21" y2="21" stroke="#ef4444" stroke-width="2"></line></svg>
          </button>

          <button class="icon-btn tool-btn" data-tool="measure" title="Calibrated Ruler / Measure (u)" aria-label="Calibrated Ruler Measure (u)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4L13.9 1.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1 0 1.4Z"></path><path d="m14.5 4.5 2 2"></path><path d="m11.5 7.5 2 2"></path><path d="m8.5 10.5 2 2"></path><path d="m5.5 13.5 2 2"></path></svg>
          </button>

          <div class="toolbar-divider"></div>

          <button class="icon-btn tool-btn" data-tool="stamp" title="Place Stamp (m)" aria-label="Place Stamp (m)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"></rect><path d="M7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"></path></svg>
          </button>

          <select id="stamp-select" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 4px 6px; font-size: 0.8rem;">
            <option value="APPROVED">APPROVED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            <option value="FINAL">FINAL</option>
            <option value="REJECTED">REJECTED</option>
          </select>

          <button class="btn" id="sig-btn" title="Create or Place Signature (g)" aria-label="Create or Place Signature (g)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 2s-6 7-6 10 3 4 5 4 4-2 4-5-3-9-3-9z"></path></svg>
            <span>Signature</span>
          </button>

          <button class="btn" id="image-insert-btn" title="Insert Image / Logo (i)" aria-label="Insert Image / Logo (i)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <span>Image</span>
          </button>
          <input type="file" id="image-insert-input" accept="image/png, image/jpeg" style="display: none;" />

          <button class="icon-btn tool-btn" data-tool="sticky_note" title="Add Sticky Comment (n)" aria-label="Add Sticky Comment (n)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"></path><path d="M15 3v6h6"></path></svg>
          </button>
        </div>

        <!-- Color & Stroke Selector -->
        <div class="tool-options">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Color:</span>
          <button type="button" class="color-swatch active" data-color="#ffeb3b" style="background-color: #ffeb3b;" title="Highlighter Yellow" aria-label="Highlighter Yellow"></button>
          <button type="button" class="color-swatch" data-color="#69f0ae" style="background-color: #69f0ae;" title="Neon Green" aria-label="Neon Green"></button>
          <button type="button" class="color-swatch" data-color="#40c4ff" style="background-color: #40c4ff;" title="Electric Blue" aria-label="Electric Blue"></button>
          <button type="button" class="color-swatch" data-color="#ff80ab" style="background-color: #ff80ab;" title="Pink" aria-label="Pink"></button>
          <button type="button" class="color-swatch" data-color="#d32f2f" style="background-color: #d32f2f;" title="Crimson Red" aria-label="Crimson Red"></button>
          <button type="button" class="color-swatch" data-color="#212121" style="background-color: #212121;" title="Solid Black" aria-label="Solid Black"></button>

          <div class="toolbar-divider"></div>

          <span style="font-size: 0.75rem; color: var(--text-secondary);">Stroke:</span>
          <select id="stroke-width-select" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 2px 6px; font-size: 0.8rem;">
            <option value="1">1 px</option>
            <option value="2" selected>2 px</option>
            <option value="4">4 px</option>
            <option value="8">8 px</option>
          </select>

          <div class="toolbar-divider"></div>

          <span style="font-size: 0.75rem; color: var(--text-secondary);">Unit:</span>
          <select id="measure-unit-select" aria-label="Measurement calibration unit" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 2px 6px; font-size: 0.8rem;">
            <option value="mm" selected>mm</option>
            <option value="cm">cm</option>
            <option value="in">in</option>
            <option value="pt">pt</option>
          </select>
        </div>
      </div>
    `;

    this.container.appendChild(wrapper);

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const byId = (id: string) => this.container.querySelector('#' + id);

    byId('sidebar-toggle-btn')?.addEventListener('click', () => {
      this.events.onToggleSidebar?.();
    });
    byId('open-file-btn')?.addEventListener('click', () => this.events.onOpenFile());
    byId('sample-file-btn')?.addEventListener('click', () => this.events.onOpenSample());
    byId('save-file-btn')?.addEventListener('click', () => this.events.onSaveExport());
    byId('save-flatten-btn')?.addEventListener('click', () => {
      if (this.events.onSaveFlatten) this.events.onSaveFlatten();
    });
    byId('print-btn')?.addEventListener('click', () => this.events.onPrint());
    byId('organizer-btn')?.addEventListener('click', () => this.events.onToggleOrganizer());
    
    const compareBtn = byId('compare-btn');
    const compareInput = byId('compare-file-input') as HTMLInputElement;
    compareBtn?.addEventListener('click', () => compareInput?.click());
    compareInput?.addEventListener('change', () => {
      const file = compareInput.files?.[0];
      if (file && this.events.onCompareFile) {
        this.events.onCompareFile(file);
      }
      compareInput.value = '';
    });

    const watermarkBtn = byId('watermark-btn');
    watermarkBtn?.addEventListener('click', () => {
      if (this.events.onWatermarkClick) {
        this.events.onWatermarkClick();
      }
    });

    const optimizeBtn = byId('optimize-btn');
    optimizeBtn?.addEventListener('click', () => {
      if (this.events.onOptimizeClick) {
        this.events.onOptimizeClick();
      }
    });

    const exportTextBtn = byId('export-text-btn');
    exportTextBtn?.addEventListener('click', () => {
      if (this.events.onExtractText) {
        this.events.onExtractText();
      }
    });

    byId('add-field-btn')?.addEventListener('click', () => {
      if (this.events.onAddFieldClick) {
        this.events.onAddFieldClick();
      }
    });

    byId('undo-btn')?.addEventListener('click', () => this.events.onUndo());
    byId('redo-btn')?.addEventListener('click', () => this.events.onRedo());

    byId('zoom-in-btn')?.addEventListener('click', () => this.events.onZoomIn());
    byId('zoom-out-btn')?.addEventListener('click', () => this.events.onZoomOut());
    const zoomLabel = byId('zoom-label');
    zoomLabel?.addEventListener('click', () => this.events.onResetZoom?.());
    zoomLabel?.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        this.events.onResetZoom?.();
      }
    });
    byId('zoom-fit-width-btn')?.addEventListener('click', () => this.events.onZoomFitWidth());
    byId('zoom-fit-page-btn')?.addEventListener('click', () => this.events.onZoomFitPage());

    const viewModeSelect = byId('view-mode-select') as HTMLSelectElement;
    viewModeSelect?.addEventListener('change', () => {
      this.events.onViewModeChange(viewModeSelect.value as ViewMode);
    });

    byId('theme-toggle-btn')?.addEventListener('click', () => {
      const themes: ThemeMode[] = ['dark', 'light', 'sepia', 'oled', 'high-contrast'];
      const currentIdx = themes.indexOf(this.activeTheme);
      const nextTheme = themes[(currentIdx + 1) % themes.length];
      this.activeTheme = nextTheme;
      this.events.onThemeToggle(nextTheme);
    });

    byId('meta-btn')?.addEventListener('click', () => this.events.onShowMetadata());
    byId('feedback-btn')?.addEventListener('click', () => {
      if (this.events.onShowFeedback) this.events.onShowFeedback();
    });
    byId('shortcuts-btn')?.addEventListener('click', () => this.events.onShowShortcuts());
    byId('sig-btn')?.addEventListener('click', () => this.events.onSignatureClick());

    const imgBtn = byId('image-insert-btn');
    const imgInput = byId('image-insert-input') as HTMLInputElement;
    imgBtn?.addEventListener('click', () => imgInput?.click());
    imgInput?.addEventListener('change', () => {
      const file = imgInput.files?.[0];
      if (file && this.events.onInsertImage) {
        this.events.onInsertImage(file);
      }
      imgInput.value = '';
    });

    // Tools
    this.container.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as ToolType;
        if (tool) {
          this.setActiveTool(tool);
          this.events.onToolSelect(tool);
        }
      });
    });

    // Colors
    this.container.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const color = swatch.getAttribute('data-color');
        if (color) {
          this.setActiveColor(color);
          this.events.onColorChange(color);
        }
      });
    });

    // Stroke width
    const strokeSelect = byId('stroke-width-select') as HTMLSelectElement;
    strokeSelect?.addEventListener('change', () => {
      const width = parseInt(strokeSelect.value, 10);
      this.activeStrokeWidth = width;
      this.events.onStrokeWidthChange(width);
    });

    // Stamp select
    const stampSelect = byId('stamp-select') as HTMLSelectElement;
    stampSelect?.addEventListener('change', () => {
      this.activeStamp = stampSelect.value;
      this.events.onStampChange(stampSelect.value);
    });

    // Measure unit select
    const unitSelect = byId('measure-unit-select') as HTMLSelectElement;
    unitSelect?.addEventListener('change', () => {
      this.activeMeasureUnit = unitSelect.value as MeasureUnit;
      if (this.events.onMeasureUnitChange) {
        this.events.onMeasureUnitChange(this.activeMeasureUnit);
      }
    });
  }
}
