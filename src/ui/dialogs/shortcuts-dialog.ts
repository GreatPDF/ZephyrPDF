export class ShortcutsDialog {
  private backdrop: HTMLElement | null = null;
  private onFeedback?: () => void;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  constructor(onFeedback?: () => void) {
    this.onFeedback = onFeedback;
  }

  public open(): void {
    this.render();
  }

  private close(): void {
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
    card.style.maxWidth = '600px';

    card.innerHTML = `
      <div class="modal-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="icon-btn" id="close-shortcuts-btn" aria-label="Close dialog" title="Close dialog">✕</button>
      </div>
      <div class="modal-body">
        <h4 style="margin: 8px 0 12px; color: var(--accent-color); font-size: 0.95rem;">Navigation & View</h4>
        <div class="shortcut-row"><span>Go to Page</span><span class="shortcut-kbd">Ctrl + G</span></div>
        <div class="shortcut-row"><span>Toggle Sidebar</span><span class="shortcut-kbd">Ctrl + B</span></div>
        <div class="shortcut-row"><span>Next / Previous Tab</span><div><span class="shortcut-kbd">Ctrl + Tab</span> or <span class="shortcut-kbd">Ctrl + PgDn / PgUp</span></div></div>
        <div class="shortcut-row"><span>Close Document Tab</span><div><span class="shortcut-kbd">Ctrl + W</span> / <span class="shortcut-kbd">Alt + W</span></div></div>
        <div class="shortcut-row"><span>Toggle Presentation / Fullscreen</span><span class="shortcut-kbd">F11</span></div>
        <div class="shortcut-row"><span>Next / Previous Page</span><div><span class="shortcut-kbd">←</span> / <span class="shortcut-kbd">→</span> or <span class="shortcut-kbd">j</span> / <span class="shortcut-kbd">k</span> or <span class="shortcut-kbd">PgDn</span> / <span class="shortcut-kbd">PgUp</span></div></div>
        <div class="shortcut-row"><span>First / Last Page</span><div><span class="shortcut-kbd">gg</span> / <span class="shortcut-kbd">G</span> or <span class="shortcut-kbd">Home</span> / <span class="shortcut-kbd">End</span></div></div>
        <div class="shortcut-row"><span>Rotate Page CCW / CW</span><div><span class="shortcut-kbd">Ctrl + [</span> / <span class="shortcut-kbd">Ctrl + ]</span></div></div>
        <div class="shortcut-row"><span>Zoom In / Out</span><div><span class="shortcut-kbd">+</span> / <span class="shortcut-kbd">-</span> or <span class="shortcut-kbd">Ctrl + Wheel</span></div></div>
        <div class="shortcut-row"><span>Reset Zoom (100%)</span><span class="shortcut-kbd">Ctrl + 0</span></div>
        <div class="shortcut-row"><span>Fit to Page / Width</span><div><span class="shortcut-kbd">0</span> / <span class="shortcut-kbd">9</span> (or <span class="shortcut-kbd">Ctrl + 9</span>)</div></div>
        <div class="shortcut-row"><span>Quick Search / Find</span><span class="shortcut-kbd">/</span> or <span class="shortcut-kbd">Ctrl + F</span></div>
        <div class="shortcut-row"><span>Find Next / Prev Match</span><div><span class="shortcut-kbd">F3</span> / <span class="shortcut-kbd">Shift + F3</span> or <span class="shortcut-kbd">Enter</span></div></div>
        <div class="shortcut-row"><span>Temporary Hand Pan</span><span class="shortcut-kbd">Space (Hold)</span></div>
        <div class="shortcut-row"><span>Reset Tool / Deselect</span><span class="shortcut-kbd">Esc</span></div>

        <h4 style="margin: 20px 0 12px; color: var(--accent-color); font-size: 0.95rem;">Editing & Tools</h4>
        <div class="shortcut-row"><span>Select Mode</span><span class="shortcut-kbd">v</span></div>
        <div class="shortcut-row"><span>Hand / Pan Tool</span><span class="shortcut-kbd">h</span></div>
        <div class="shortcut-row"><span>Delete Selected Item</span><div><span class="shortcut-kbd">Delete</span> / <span class="shortcut-kbd">Backspace</span></div></div>
        <div class="shortcut-row"><span>Pixel Nudge Selected Item</span><div><span class="shortcut-kbd">Arrow Keys</span> (Shift: 10px)</div></div>
        <div class="shortcut-row"><span>Constrain Proportions / Ratio</span><div><span class="shortcut-kbd">Shift + Drag Handle</span></div></div>
        <div class="shortcut-row"><span>Insert Image / Logo</span><span class="shortcut-kbd">i</span></div>
        <div class="shortcut-row"><span>Paste Image from Clipboard</span><span class="shortcut-kbd">Ctrl + V</span></div>
        <div class="shortcut-row"><span>Text Highlighter</span><span class="shortcut-kbd">l</span></div>
        <div class="shortcut-row"><span>Freehand Pen</span><span class="shortcut-kbd">p</span></div>
        <div class="shortcut-row"><span>Eraser</span><span class="shortcut-kbd">e</span></div>
        <div class="shortcut-row"><span>Add Text Box</span><span class="shortcut-kbd">t</span></div>
        <div class="shortcut-row"><span>Add Sticky Note / Comment</span><span class="shortcut-kbd">n</span></div>
        <div class="shortcut-row"><span>Rectangle Shape</span><span class="shortcut-kbd">r</span></div>
        <div class="shortcut-row"><span>Ellipse Shape</span><span class="shortcut-kbd">o</span></div>
        <div class="shortcut-row"><span>Arrow / Line</span><span class="shortcut-kbd">a</span></div>
        <div class="shortcut-row"><span>Permanent Redaction</span><span class="shortcut-kbd">x</span></div>
        <div class="shortcut-row"><span>Ruler / Measure</span><span class="shortcut-kbd">u</span></div>
        <div class="shortcut-row"><span>Place Stamp</span><span class="shortcut-kbd">m</span></div>
        <div class="shortcut-row"><span>Place Signature</span><span class="shortcut-kbd">g</span></div>
        <div class="shortcut-row"><span>Magnifier Lens</span><span class="shortcut-kbd">z</span></div>
        <div class="shortcut-row"><span>Marquee Snapshot</span><span class="shortcut-kbd">c</span></div>

        <h4 style="margin: 20px 0 12px; color: var(--accent-color); font-size: 0.95rem;">Document Actions</h4>
        <div class="shortcut-row"><span>Undo / Redo</span><div><span class="shortcut-kbd">Ctrl + Z</span> / <span class="shortcut-kbd">Ctrl + Y</span></div></div>
        <div class="shortcut-row"><span>Find / Search in Text</span><span class="shortcut-kbd">Ctrl + F</span></div>
        <div class="shortcut-row"><span>Save & Export PDF</span><span class="shortcut-kbd">Ctrl + S</span></div>
        <div class="shortcut-row"><span>Open New PDF</span><span class="shortcut-kbd">Ctrl + O</span></div>
        <div class="shortcut-row"><span>Print Document</span><span class="shortcut-kbd">Ctrl + P</span></div>
        <div class="shortcut-row"><span>Show Shortcuts</span><span class="shortcut-kbd">?</span></div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button class="btn" id="shortcuts-feedback-btn" style="font-size: 0.8rem;">💬 Feedback / Report Issue</button>
        <button class="btn btn-primary" id="ok-shortcuts-btn">Got it</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }

    const closeBtn = card.querySelector('#close-shortcuts-btn');
    const okBtn = card.querySelector('#ok-shortcuts-btn');
    const feedbackBtn = card.querySelector('#shortcuts-feedback-btn');

    closeBtn?.addEventListener('click', () => this.close());
    okBtn?.addEventListener('click', () => this.close());
    feedbackBtn?.addEventListener('click', () => {
      this.close();
      if (this.onFeedback) this.onFeedback();
    });
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }
}
