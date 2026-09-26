import * as pdfjsLib from 'pdfjs-dist';
import { PdfOptimizer, CompressionLevel, OptimizationResult } from '../../core/optimizer';
import { PdfExporter } from '../../export/pdf-exporter';
import { NotificationService } from '../notification';

export interface OptimizerDialogProps {
  pdfjsDoc: pdfjsLib.PDFDocumentProxy;
  fileName: string;
  originalSizeBytes: number;
}

export class OptimizerDialog {
  private backdrop: HTMLElement | null = null;
  private props: OptimizerDialogProps;
  private selectedLevel: CompressionLevel = 'medium';
  private lastResult: OptimizationResult | null = null;
  private isProcessing: boolean = false;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.isProcessing) {
      this.close();
    }
  };

  constructor(props: OptimizerDialogProps) {
    this.props = props;
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

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  private render(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '550px';

    card.innerHTML = `
      <div class="modal-header">
        <h3>PDF Optimizer & Compressor</h3>
        <button class="icon-btn" id="close-opt-btn" aria-label="Close dialog" title="Close dialog">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: var(--bg-primary); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem; color: var(--text-secondary);">Original File Size:</span>
          <strong style="font-size: 1rem; color: var(--text-primary);">${this.formatBytes(this.props.originalSizeBytes)}</strong>
        </div>

        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;">Select Compression Level:</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: var(--bg-primary);">
              <input type="radio" name="opt-level" value="high" style="margin-top: 3px;" />
              <div>
                <strong style="font-size: 0.9rem; display: block;">High Quality (Light Compression)</strong>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Minimal quality reduction. Best for documents intended for high-DPI printing.</span>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border: 1px solid var(--accent-color); border-radius: 6px; cursor: pointer; background: var(--accent-light);">
              <input type="radio" name="opt-level" value="medium" checked style="margin-top: 3px;" />
              <div>
                <strong style="font-size: 0.9rem; display: block; color: var(--accent-color);">Balanced (Recommended)</strong>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Optimal balance between crisp clarity and file size reduction (~50-70% savings).</span>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; background: var(--bg-primary);">
              <input type="radio" name="opt-level" value="low" style="margin-top: 3px;" />
              <div>
                <strong style="font-size: 0.9rem; display: block;">Maximum Compression</strong>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">Aggressive size reduction. Best for meeting strict 2MB email or portal attachments.</span>
              </div>
            </label>
          </div>
        </div>

        <div id="opt-progress-box" style="display: none; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
            <span id="opt-progress-text">Compressing pages...</span>
            <span id="opt-progress-pct">0%</span>
          </div>
          <div style="width: 100%; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
            <div id="opt-progress-bar" style="width: 0%; height: 100%; background: var(--accent-color); transition: width 0.15s ease;"></div>
          </div>
        </div>

        <div id="opt-result-box" style="display: none; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 14px; text-align: center;">
          <span style="font-size: 0.9rem; color: #10b981; font-weight: 600; display: block; margin-bottom: 4px;">Optimization Complete!</span>
          <span style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);" id="opt-new-size-label"></span>
          <span style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;" id="opt-savings-label"></span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn" id="cancel-opt-btn" aria-label="Cancel">Cancel</button>
        <button class="btn btn-primary" id="run-opt-btn" aria-label="Start Optimization">Start Optimization</button>
        <button class="btn btn-primary" id="download-opt-btn" aria-label="Download Optimized PDF" style="display: none;">Download Optimized PDF</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop && !this.isProcessing) {
        this.close();
      }
    });

    this.setupListeners(card);

    setTimeout(() => {
      const runBtn = card.querySelector('#run-opt-btn') as HTMLButtonElement | null;
      runBtn?.focus();
    }, 50);
  }

  private setupListeners(card: HTMLElement): void {
    const closeBtn = card.querySelector('#close-opt-btn');
    const cancelBtn = card.querySelector('#cancel-opt-btn');
    const runBtn = card.querySelector('#run-opt-btn') as HTMLButtonElement;
    const downloadBtn = card.querySelector('#download-opt-btn') as HTMLButtonElement;
    const progressBox = card.querySelector('#opt-progress-box') as HTMLElement;
    const progressText = card.querySelector('#opt-progress-text') as HTMLElement;
    const progressPct = card.querySelector('#opt-progress-pct') as HTMLElement;
    const progressBar = card.querySelector('#opt-progress-bar') as HTMLElement;
    const resultBox = card.querySelector('#opt-result-box') as HTMLElement;
    const newSizeLabel = card.querySelector('#opt-new-size-label') as HTMLElement;
    const savingsLabel = card.querySelector('#opt-savings-label') as HTMLElement;

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    card.querySelectorAll('input[name="opt-level"]').forEach((radio: any) => {
      radio.addEventListener('change', () => {
        this.selectedLevel = radio.value as CompressionLevel;
        card.querySelectorAll('input[name="opt-level"]').forEach((r: any) => {
          const lbl = r.closest('label');
          if (lbl) {
            const isChecked = r.checked;
            lbl.style.borderColor = isChecked ? 'var(--accent-color)' : 'var(--border-color)';
            lbl.style.backgroundColor = isChecked ? 'var(--accent-light)' : 'var(--bg-primary)';
            const titleEl = lbl.querySelector('strong');
            if (titleEl) titleEl.style.color = isChecked ? 'var(--accent-color)' : 'var(--text-primary)';
          }
        });
      });
    });

    runBtn?.addEventListener('click', async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;
      runBtn.disabled = true;
      progressBox.style.display = 'flex';
      resultBox.style.display = 'none';

      try {
        const result = await PdfOptimizer.optimizeDocument(
          this.props.pdfjsDoc,
          this.props.originalSizeBytes,
          this.selectedLevel,
          (cur, total) => {
            const pct = Math.round((cur / total) * 100);
            progressText.textContent = `Optimizing page ${cur} of ${total}...`;
            progressPct.textContent = `${pct}%`;
            progressBar.style.width = `${pct}%`;
          }
        );

        this.lastResult = result;
        progressBox.style.display = 'none';
        resultBox.style.display = 'block';

        newSizeLabel.textContent = `${this.formatBytes(result.originalSize)} ➔ ${this.formatBytes(result.optimizedSize)}`;
        if (result.optimizedSize < result.originalSize) {
          savingsLabel.textContent = `Reduced by ${result.percentSaved}% (${this.formatBytes(result.originalSize - result.optimizedSize)} saved)`;
        } else {
          savingsLabel.textContent = `Document is already compact. Rasterizing pages increases size (${this.formatBytes(result.optimizedSize)}).`;
        }

        runBtn.style.display = 'none';
        downloadBtn.style.display = 'inline-flex';
        downloadBtn.focus();
      } catch (err: any) {
        NotificationService.show('Optimization error: ' + (err?.message || 'Compression failed'), 4000, true);
        runBtn.disabled = false;
      } finally {
        this.isProcessing = false;
      }
    });

    downloadBtn?.addEventListener('click', () => {
      if (this.lastResult) {
        const base = this.props.fileName.replace(/\.pdf$/i, '');
        PdfExporter.downloadBlob(this.lastResult.bytes, `${base}_optimized.pdf`);
        this.close();
      }
    });
  }
}
