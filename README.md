# ZephyrPDF

> **The Featherlight, Full-Featured Open-Source PDF Viewer & Editor.**  
> Built for uncompromising speed, flawless user experience, and 100% privacy.

👉 **[Launch Live Web App on GitHub Pages](https://greatpdf.github.io/ZephyrPDF/)** (Zero Install, 100% Client-Side)

---

## Highlights

- **🚀 Blazing Fast & Lightweight**: Instant startup, smooth multi-page continuous scrolling, high-DPI Retina rendering, and minimal memory usage.
- **🔒 100% Private & Client-Side**: All document rendering, markup, and page operations happen entirely on your machine. Zero cloud uploads, zero tracking, zero telemetry.
- **🎨 Complete Annotation Suite**:
  - **Highlighter**: Multi-color text and region highlighting with standard PDF blend modes.
  - **Freehand Pen & Ink**: Natural bezier curve smoothing, pressure simulation, adjustable stroke widths, and precision eraser.
  - **Shapes**: Rectangles, circles/ellipses, lines, and directional arrows.
  - **Rich Text Boxes**: Click-to-place typography with custom fonts, colors, and sizing.
  - **Pre-set & Custom Stamps**: `APPROVED`, `CONFIDENTIAL`, `DRAFT`, `FINAL`, `REJECTED`, or customized text.
  - **Digital Signatures**: Draw, type cursive, or upload transparent PNG signatures with instant one-click placement.
  - **Sticky Notes**: Threaded comments and annotations.
- **🎯 Live Image Placement Preview & Context Menu**: Real-time cursor ghost preview before placing images, plus a right-click context menu on any annotation for instant scaling (+25%/-25%), color adjustments, duplication, and deletion.
- **🛡️ Metadata Editor & Privacy Sanitizer**: Edit title, author, subject, and keywords with 1-click metadata sanitization to scrub personal traces before sharing.
- **💾 Annotation Backup & Restore**: Export and import full annotation collections as portable JSON files to transfer markup across revisions.
- **🗂️ Multi-Document Tab Bar**: Work with multiple opened PDFs simultaneously in a browser-style tab bar with instant session switching and isolation.
- **🔎 Advanced Search Filtering**: Instant full-text search with dedicated Match Case (`Aa`) and Whole Words (`\b`) filters.
- **🔄 Quick Page Rotation Shortcuts**: Rotate current page on the fly with `Ctrl+[` (CCW) and `Ctrl+]` (CW).
- **📸 Marquee Snapshot Tool**: Capture and copy any arbitrary rectangular region of a PDF directly to your clipboard as high-res PNG (`c`).
- **📄 Full Document Text & Markdown Extractor**: Export all text into structured Markdown or plain text with word and character metrics.
- **📉 In-Browser PDF Compressor & Optimizer**: Compress bulky documents client-side with High, Balanced, and Maximum compression presets (saving up to 80% file size) without cloud uploads.
- **📑 Annotation Summary Report**: Export all comments, highlights, stamps, and measurements grouped by page into Markdown reports.
- **🏗️ Interactive Form Builder**: Convert any document into a fillable PDF form by adding custom interactive text fields and checkboxes.
- **🔍 Magnifier / Loupe Lens**: Inspect intricate vector blueprints, CAD drawings, and fine print with a 2.5x cursor lens (`z`).
- **🖍️ Freehand Chisel Highlighter**: Smooth broad-tip marker highlighting for scanned books, contracts, and handwritten documents without OCR text layers.
- **💧 Document Watermarking**: Add customizable rotated watermark text across all pages (`CONFIDENTIAL`, `DRAFT`, `COPY`) with opacity and angle controls.
- **🔢 Header & Footer Page Numbering**: Insert dynamic page numbers (`Page X of Y`, `X of Y`, `X`) at customizable header/footer positions.
- **⚡ Quick Text Selection Menu**: Effortless floating action menu on text selection for instant 1-click highlighting, underlining, strikethrough, and copying.
- **🖼️ Image & Logo Insertion**: Insert PNG/JPEG images or logos onto any page with interactive drag and scale handles.
- **📖 Two-Page Book & Presentation Modes**: Dual-page spread viewing and distraction-free fullscreen presentation mode.
- **📋 Search Citation Export**: Export full-text search occurrences and snippet context into clean Markdown reports.
- **📑 Visual Page Organizer**:
  - Interactive grid view with live page previews.
  - Multi-document merge: Combine pages from multiple PDFs into a single unified file.
  - Page range extraction & split: Flexible range exporter (e.g. `1-3, 5, 8`) to extract specific pages into a standalone PDF.
  - Drag-and-drop page reordering.
  - 90° Clockwise and Counter-Clockwise page rotations.
  - Page deletion and blank page insertion.
- **🔍 Document Comparison & Visual Diffing**: Compare revisions of documents with automated pixel-by-pixel change highlighting (Red: removed, Green: added) and change navigation.
- **📏 Calibrated Measurement Tool**: Real-world distance measurement with dimension lines, tick marks, and customizable units (`mm`, `cm`, `in`, `pt`), ideal for architectural plans and blueprints.
- **🛡️ Permanent Redaction**: Irreversibly black out confidential data, numbers, or text before distribution.
- **📝 Interactive Form Filling & Flattening**: In-browser AcroForm support—fill text inputs, check boxes, select dropdowns, and optionally flatten forms upon export to permanently lock submissions.
- **🔍 Full-Text Search**: Instantaneous search across all pages with matching text bounds and rapid previous/next keyboard navigation.
- **🌓 Reading Themes**: Dark Mode, Clean Light Mode, Sepia paper mode, OLED Pure Black (`#000000`), and High-Contrast mode for superior accessibility.
- **⚡ Virtualized Viewport Rendering**: Unmatched performance on 100+ page documents using smart intersection observers that render active viewports on demand.
- **📱 Offline PWA Ready**: Install as a standalone native app on desktop or mobile with 100% offline functionality.
- **💾 Standard Compliant PDF Export**: Edits, annotations, and page reorganizations are baked directly into valid ISO 32000-1 standard PDF objects, fully compatible with Adobe Acrobat, Apple Preview, Chrome, Firefox, SumatraPDF, and Okular.
- **⌨️ Keyboard Productivity**: Comprehensive Vim and accessibility hotkeys (`j`/`k`, `gg`/`G`, `v`, `p`, `l`, `u`, `z`, `c`, `/` search focus, `Esc` reset, `Ctrl+[`/`Ctrl+]` rotate).

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/GreatPDF/GreatPDF.git
cd GreatPDF

# Install dependencies
npm install

# Start local development server with Hot Module Reloading
npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build
```bash
# Typecheck and build optimized static assets
npm run build

# Preview production build locally
npm run preview
```

### Running Tests
```bash
# Run unit and integration tests via Vitest
npm test
```

---

## Architecture

ZephyrPDF is built with a decoupled, high-performance architecture:
- **Rendering Pipeline**: Powered by `pdfjs-dist` with Web Workers for non-blocking canvas rendering.
- **Document Manipulation**: `pdf-lib` for lossless page tree modifications, copying, rotation, and vector baking.
- **Overlay System**: Scalable SVG/Canvas hybrid layer for 60fps interactive drawing and drag manipulation.
- **History Engine**: Command-pattern undo/redo stack managing both page structures and annotations.

---

## License

MIT © ZephyrPDF Team
