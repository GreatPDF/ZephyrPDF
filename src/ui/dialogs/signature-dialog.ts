export class SignatureDialog {
  private backdrop: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing: boolean = false;
  private strokeColor: string = '#1565c0';
  private strokeWidth: number = 2.5;
  private activeTab: 'draw' | 'type' | 'upload' = 'draw';
  private onSaveCallback: (dataUrl: string) => void;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  constructor(onSave: (dataUrl: string) => void) {
    this.onSaveCallback = onSave;
  }

  public open(): void {
    this.render();
  }

  public close(): void {
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
    card.style.maxWidth = '550px';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'sig-dialog-title');

    card.innerHTML = `
      <div class="modal-header">
        <h3 id="sig-dialog-title" style="margin: 0; font-size: 1.15rem;">Create Signature</h3>
        <button class="icon-btn" id="close-sig-btn" aria-label="Close dialog" title="Close dialog">✕</button>
      </div>
      <div class="modal-body">
        <div role="tablist" aria-label="Signature Creation Methods" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <button class="btn ${this.activeTab === 'draw' ? 'btn-primary' : ''}" role="tab" id="tab-draw-btn" aria-selected="${this.activeTab === 'draw'}" aria-controls="sig-panel-draw">Draw</button>
          <button class="btn ${this.activeTab === 'type' ? 'btn-primary' : ''}" role="tab" id="tab-type-btn" aria-selected="${this.activeTab === 'type'}" aria-controls="sig-panel-type">Type</button>
          <button class="btn ${this.activeTab === 'upload' ? 'btn-primary' : ''}" role="tab" id="tab-upload-btn" aria-selected="${this.activeTab === 'upload'}" aria-controls="sig-panel-upload">Upload Image</button>
        </div>

        <div id="sig-panel-draw" role="tabpanel" aria-labelledby="tab-draw-btn" style="display: ${this.activeTab === 'draw' ? 'block' : 'none'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.85rem; color: var(--text-secondary);">Draw your signature below using mouse or pen</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn" id="clear-sig-btn" style="height: 28px; font-size: 0.75rem;">Clear</button>
            </div>
          </div>
          <div class="signature-canvas-wrapper">
            <canvas id="sig-canvas" width="480" height="180" style="background: white; border-radius: 6px; cursor: crosshair; touch-action: none;"></canvas>
          </div>
        </div>

        <div id="sig-panel-type" role="tabpanel" aria-labelledby="tab-type-btn" style="display: ${this.activeTab === 'type' ? 'block' : 'none'};">
          <label for="type-name-input" style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">Your Name:</label>
          <input type="text" id="type-name-input" placeholder="e.g. Jane Doe" style="width: 100%; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 1rem; margin-bottom: 16px;" value="Alex Mercer" />
          <div style="background: white; padding: 24px; border-radius: 6px; text-align: center; border: 1px solid var(--border-color);">
            <span id="cursive-preview" style="font-family: 'Brush Script MT', 'Dancing Script', cursive, sans-serif; font-size: 2.2rem; color: #1565c0;">Alex Mercer</span>
          </div>
        </div>

        <div id="sig-panel-upload" role="tabpanel" aria-labelledby="tab-upload-btn" style="display: ${this.activeTab === 'upload' ? 'block' : 'none'};">
          <label for="upload-sig-input" style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">Upload PNG or JPG image of signature:</label>
          <input type="file" id="upload-sig-input" accept="image/png, image/jpeg" style="margin-bottom: 12px;" />
          <div id="upload-preview-wrapper" style="text-align: center; background: white; padding: 16px; border-radius: 6px; display: none;">
            <img id="upload-preview-img" style="max-height: 120px; max-width: 100%;" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="cancel-sig-btn">Cancel</button>
        <button class="btn btn-primary" id="save-sig-btn">Apply Signature</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.setupListeners(card);
  }

  private setupListeners(card: HTMLElement): void {
    const closeBtn = card.querySelector('#close-sig-btn');
    const cancelBtn = card.querySelector('#cancel-sig-btn');
    const saveBtn = card.querySelector('#save-sig-btn');
    const clearBtn = card.querySelector('#clear-sig-btn');
    const tabDraw = card.querySelector('#tab-draw-btn');
    const tabType = card.querySelector('#tab-type-btn');
    const tabUpload = card.querySelector('#tab-upload-btn');
    const panelDraw = card.querySelector('#sig-panel-draw') as HTMLElement;
    const panelType = card.querySelector('#sig-panel-type') as HTMLElement;
    const panelUpload = card.querySelector('#sig-panel-upload') as HTMLElement;
    const typeInput = card.querySelector('#type-name-input') as HTMLInputElement;
    const cursivePreview = card.querySelector('#cursive-preview') as HTMLElement;
    const uploadInput = card.querySelector('#upload-sig-input') as HTMLInputElement;
    const uploadWrapper = card.querySelector('#upload-preview-wrapper') as HTMLElement;
    const uploadImg = card.querySelector('#upload-preview-img') as HTMLImageElement;

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    // Tabs
    tabDraw?.addEventListener('click', () => {
      this.activeTab = 'draw';
      tabDraw.classList.add('btn-primary');
      tabType?.classList.remove('btn-primary');
      tabUpload?.classList.remove('btn-primary');
      tabDraw.setAttribute('aria-selected', 'true');
      tabType?.setAttribute('aria-selected', 'false');
      tabUpload?.setAttribute('aria-selected', 'false');
      panelDraw.style.display = 'block';
      panelType.style.display = 'none';
      panelUpload.style.display = 'none';
    });

    tabType?.addEventListener('click', () => {
      this.activeTab = 'type';
      tabType.classList.add('btn-primary');
      tabDraw?.classList.remove('btn-primary');
      tabUpload?.classList.remove('btn-primary');
      tabType.setAttribute('aria-selected', 'true');
      tabDraw?.setAttribute('aria-selected', 'false');
      tabUpload?.setAttribute('aria-selected', 'false');
      panelDraw.style.display = 'none';
      panelType.style.display = 'block';
      panelUpload.style.display = 'none';
      setTimeout(() => {
        typeInput?.focus();
        typeInput?.select();
      }, 50);
    });

    tabUpload?.addEventListener('click', () => {
      this.activeTab = 'upload';
      tabUpload.classList.add('btn-primary');
      tabDraw?.classList.remove('btn-primary');
      tabType?.classList.remove('btn-primary');
      tabUpload.setAttribute('aria-selected', 'true');
      tabDraw?.setAttribute('aria-selected', 'false');
      tabType?.setAttribute('aria-selected', 'false');
      panelDraw.style.display = 'none';
      panelType.style.display = 'none';
      panelUpload.style.display = 'block';
    });

    typeInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (saveBtn as HTMLButtonElement)?.click();
      }
    });

    // Drawing Canvas
    this.canvas = card.querySelector('#sig-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      if (this.ctx) {
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
      }

      this.canvas.addEventListener('pointerdown', (e) => {
        this.isDrawing = true;
        const rect = this.canvas!.getBoundingClientRect();
        this.ctx?.beginPath();
        this.ctx?.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.isDrawing || !this.ctx || !this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        this.ctx.stroke();
      });

      window.addEventListener('pointerup', () => {
        this.isDrawing = false;
      });
    }

    clearBtn?.addEventListener('click', () => {
      if (this.canvas && this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    });

    typeInput?.addEventListener('input', () => {
      if (cursivePreview) {
        cursivePreview.textContent = typeInput.value || 'Signature';
      }
    });

    uploadInput?.addEventListener('change', () => {
      const file = uploadInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (uploadImg && uploadWrapper && e.target?.result) {
            uploadImg.src = e.target.result as string;
            uploadWrapper.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);
      }
    });

    saveBtn?.addEventListener('click', () => {
      let resultDataUrl = '';

      if (this.activeTab === 'draw' && this.canvas) {
        // Create transparent PNG of signature
        resultDataUrl = this.canvas.toDataURL('image/png');
      } else if (this.activeTab === 'type') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 480;
        tempCanvas.height = 160;
        const tCtx = tempCanvas.getContext('2d');
        if (tCtx) {
          tCtx.font = "italic 44px 'Brush Script MT', cursive, sans-serif";
          tCtx.fillStyle = '#1565c0';
          tCtx.textAlign = 'center';
          tCtx.textBaseline = 'middle';
          tCtx.fillText(typeInput.value || 'Signature', 240, 80);
          resultDataUrl = tempCanvas.toDataURL('image/png');
        }
      } else if (this.activeTab === 'upload') {
        resultDataUrl = uploadImg.src;
      }

      if (resultDataUrl) {
        this.onSaveCallback(resultDataUrl);
      }
      this.close();
    });
  }
}
