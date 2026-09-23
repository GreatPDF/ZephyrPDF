import { WatermarkOptions, PageNumberOptions } from '../../types/document';

export interface WatermarkDialogEvents {
  onSave: (watermark: WatermarkOptions, pageNumbers: PageNumberOptions) => void;
}

export class WatermarkDialog {
  private backdrop: HTMLElement | null = null;
  private watermark: WatermarkOptions;
  private pageNumbers: PageNumberOptions;
  private events: WatermarkDialogEvents;

  constructor(
    initialWatermark: WatermarkOptions,
    initialPageNumbers: PageNumberOptions,
    events: WatermarkDialogEvents
  ) {
    this.watermark = { ...initialWatermark };
    this.pageNumbers = { ...initialPageNumbers };
    this.events = events;
  }

  public open(): void {
    this.render();
  }

  public close(): void {
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
    card.style.maxWidth = '550px';

    card.innerHTML = `
      <div class="modal-header">
        <h3>Watermark & Page Numbers</h3>
        <button class="icon-btn" id="close-wm-btn">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Watermark Section -->
        <div style="background: var(--bg-primary); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 0.95rem;">Document Watermark</strong>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
              <input type="checkbox" id="wm-enable-check" ${this.watermark.enabled ? 'checked' : ''} />
              Enable Watermark
            </label>
          </div>

          <div id="wm-options-container" style="display: ${this.watermark.enabled ? 'flex' : 'none'}; flex-direction: column; gap: 10px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Watermark Text:</label>
              <input type="text" id="wm-text-input" value="${this.watermark.text}" style="width: 100%; padding: 6px 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.9rem;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">
                  Opacity: <span id="wm-opacity-label">${Math.round(this.watermark.opacity * 100)}%</span>
                </label>
                <input type="range" id="wm-opacity-range" min="5" max="60" value="${Math.round(this.watermark.opacity * 100)}" style="width: 100%;" />
              </div>

              <div>
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Rotation:</label>
                <select id="wm-rotation-select" style="width: 100%; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                  <option value="-45" ${this.watermark.rotationDegrees === -45 ? 'selected' : ''}>-45° (Diagonal Up)</option>
                  <option value="0" ${this.watermark.rotationDegrees === 0 ? 'selected' : ''}>0° (Horizontal)</option>
                  <option value="45" ${this.watermark.rotationDegrees === 45 ? 'selected' : ''}>45° (Diagonal Down)</option>
                </select>
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Color:</label>
              <select id="wm-color-select" style="width: 100%; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                <option value="#94a3b8" ${this.watermark.color === '#94a3b8' ? 'selected' : ''}>Muted Slate Gray</option>
                <option value="#ef4444" ${this.watermark.color === '#ef4444' ? 'selected' : ''}>Warning Red</option>
                <option value="#0284c7" ${this.watermark.color === '#0284c7' ? 'selected' : ''}>Official Blue</option>
                <option value="#f59e0b" ${this.watermark.color === '#f59e0b' ? 'selected' : ''}>Amber</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Page Numbers Section -->
        <div style="background: var(--bg-primary); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <strong style="font-size: 0.95rem;">Header & Footer Page Numbering</strong>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
              <input type="checkbox" id="pn-enable-check" ${this.pageNumbers.enabled ? 'checked' : ''} />
              Enable Page Numbers
            </label>
          </div>

          <div id="pn-options-container" style="display: ${this.pageNumbers.enabled ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Format:</label>
              <select id="pn-format-select" style="width: 100%; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                <option value="Page X of Y" ${this.pageNumbers.format === 'Page X of Y' ? 'selected' : ''}>Page X of Y</option>
                <option value="X of Y" ${this.pageNumbers.format === 'X of Y' ? 'selected' : ''}>X of Y</option>
                <option value="X" ${this.pageNumbers.format === 'X' ? 'selected' : ''}>X (Number only)</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Position:</label>
              <select id="pn-position-select" style="width: 100%; padding: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
                <option value="bottom-center" ${this.pageNumbers.position === 'bottom-center' ? 'selected' : ''}>Bottom Center</option>
                <option value="bottom-right" ${this.pageNumbers.position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                <option value="top-right" ${this.pageNumbers.position === 'top-right' ? 'selected' : ''}>Top Right</option>
                <option value="top-center" ${this.pageNumbers.position === 'top-center' ? 'selected' : ''}>Top Center</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn" id="cancel-wm-btn">Cancel</button>
        <button class="btn btn-primary" id="save-wm-btn">Apply Settings</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);

    this.setupListeners(card);
  }

  private setupListeners(card: HTMLElement): void {
    const closeBtn = card.querySelector('#close-wm-btn');
    const cancelBtn = card.querySelector('#cancel-wm-btn');
    const saveBtn = card.querySelector('#save-wm-btn');

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    const wmCheck = card.querySelector('#wm-enable-check') as HTMLInputElement;
    const wmContainer = card.querySelector('#wm-options-container') as HTMLElement;
    wmCheck?.addEventListener('change', () => {
      this.watermark.enabled = wmCheck.checked;
      wmContainer.style.display = wmCheck.checked ? 'flex' : 'none';
    });

    const pnCheck = card.querySelector('#pn-enable-check') as HTMLInputElement;
    const pnContainer = card.querySelector('#pn-options-container') as HTMLElement;
    pnCheck?.addEventListener('change', () => {
      this.pageNumbers.enabled = pnCheck.checked;
      pnContainer.style.display = pnCheck.checked ? 'grid' : 'none';
    });

    const textInput = card.querySelector('#wm-text-input') as HTMLInputElement;
    const opacityRange = card.querySelector('#wm-opacity-range') as HTMLInputElement;
    const opacityLabel = card.querySelector('#wm-opacity-label');
    const rotSelect = card.querySelector('#wm-rotation-select') as HTMLSelectElement;
    const colorSelect = card.querySelector('#wm-color-select') as HTMLSelectElement;
    const formatSelect = card.querySelector('#pn-format-select') as HTMLSelectElement;
    const posSelect = card.querySelector('#pn-position-select') as HTMLSelectElement;

    opacityRange?.addEventListener('input', () => {
      if (opacityLabel) opacityLabel.textContent = `${opacityRange.value}%`;
      this.watermark.opacity = parseInt(opacityRange.value, 10) / 100;
    });

    saveBtn?.addEventListener('click', () => {
      if (textInput) this.watermark.text = textInput.value || 'CONFIDENTIAL';
      if (rotSelect) this.watermark.rotationDegrees = parseInt(rotSelect.value, 10);
      if (colorSelect) this.watermark.color = colorSelect.value;
      if (formatSelect) this.pageNumbers.format = formatSelect.value as any;
      if (posSelect) this.pageNumbers.position = posSelect.value as any;

      this.events.onSave(this.watermark, this.pageNumbers);
      this.close();
    });
  }
}
