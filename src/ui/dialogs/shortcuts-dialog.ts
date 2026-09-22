export class ShortcutsDialog {
  private backdrop: HTMLElement | null = null;

  public open(): void {
    this.render();
  }

  private close(): void {
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
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
        <button class="icon-btn" id="close-shortcuts-btn">✕</button>
      </div>
      <div class="modal-body">
        <h4 style="margin: 8px 0 12px; color: var(--accent-color); font-size: 0.95rem;">Navigation & View</h4>
        <div class="shortcut-row"><span>Next / Previous Page</span><div><span class="shortcut-kbd">j</span> / <span class="shortcut-kbd">k</span> or <span class="shortcut-kbd">PgDn</span> / <span class="shortcut-kbd">PgUp</span></div></div>
        <div class="shortcut-row"><span>First / Last Page</span><div><span class="shortcut-kbd">Home</span> / <span class="shortcut-kbd">End</span></div></div>
        <div class="shortcut-row"><span>Zoom In / Out</span><div><span class="shortcut-kbd">+</span> / <span class="shortcut-kbd">-</span> or <span class="shortcut-kbd">Ctrl + Wheel</span></div></div>
        <div class="shortcut-row"><span>Fit to Page / Width</span><div><span class="shortcut-kbd">0</span> / <span class="shortcut-kbd">9</span></div></div>
        <div class="shortcut-row"><span>Toggle Sidebar</span><div><span class="shortcut-kbd">b</span></div></div>

        <h4 style="margin: 20px 0 12px; color: var(--accent-color); font-size: 0.95rem;">Editing & Tools</h4>
        <div class="shortcut-row"><span>Select Mode</span><span class="shortcut-kbd">v</span></div>
        <div class="shortcut-row"><span>Hand / Pan Tool</span><span class="shortcut-kbd">h</span></div>
        <div class="shortcut-row"><span>Text Highlighter</span><span class="shortcut-kbd">l</span></div>
        <div class="shortcut-row"><span>Freehand Pen</span><span class="shortcut-kbd">p</span></div>
        <div class="shortcut-row"><span>Eraser</span><span class="shortcut-kbd">e</span></div>
        <div class="shortcut-row"><span>Add Text Box</span><span class="shortcut-kbd">t</span></div>
        <div class="shortcut-row"><span>Rectangle Shape</span><span class="shortcut-kbd">r</span></div>
        <div class="shortcut-row"><span>Ellipse Shape</span><span class="shortcut-kbd">o</span></div>
        <div class="shortcut-row"><span>Arrow / Line</span><span class="shortcut-kbd">a</span></div>
        <div class="shortcut-row"><span>Place Signature</span><span class="shortcut-kbd">g</span></div>

        <h4 style="margin: 20px 0 12px; color: var(--accent-color); font-size: 0.95rem;">Document Actions</h4>
        <div class="shortcut-row"><span>Undo / Redo</span><div><span class="shortcut-kbd">Ctrl + Z</span> / <span class="shortcut-kbd">Ctrl + Y</span></div></div>
        <div class="shortcut-row"><span>Find / Search in Text</span><span class="shortcut-kbd">Ctrl + F</span></div>
        <div class="shortcut-row"><span>Save & Export PDF</span><span class="shortcut-kbd">Ctrl + S</span></div>
        <div class="shortcut-row"><span>Open New PDF</span><span class="shortcut-kbd">Ctrl + O</span></div>
        <div class="shortcut-row"><span>Print Document</span><span class="shortcut-kbd">Ctrl + P</span></div>
        <div class="shortcut-row"><span>Show Shortcuts</span><span class="shortcut-kbd">?</span></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="ok-shortcuts-btn">Got it</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);

    const closeBtn = card.querySelector('#close-shortcuts-btn');
    const okBtn = card.querySelector('#ok-shortcuts-btn');

    closeBtn?.addEventListener('click', () => this.close());
    okBtn?.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }
}
