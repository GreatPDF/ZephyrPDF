import { DocumentMetadata } from '../../types/document';

export interface MetadataDialogEvents {
  onSave?: (updated: DocumentMetadata) => void;
}

export class MetadataDialog {
  private backdrop: HTMLElement | null = null;
  private metadata: DocumentMetadata;
  private events?: MetadataDialogEvents;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  constructor(metadata: DocumentMetadata, events?: MetadataDialogEvents) {
    this.metadata = { ...metadata };
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
    card.style.maxWidth = '580px';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'meta-dialog-title');

    const m = this.metadata;

    card.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h3 id="meta-dialog-title" style="margin: 0; font-size: 1.15rem;">Document Properties & Metadata</h3>
        </div>
        <button class="icon-btn" id="close-meta-btn" aria-label="Close dialog" title="Close dialog">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
        <!-- File Specs -->
        <div style="background: var(--bg-primary); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem;">
          <div><span style="color: var(--text-secondary);">File Name:</span> <strong>${m.fileName || 'Untitled'}</strong></div>
          <div><span style="color: var(--text-secondary);">File Size:</span> <span>${this.formatBytes(m.fileSize)}</span></div>
          <div><span style="color: var(--text-secondary);">Page Count:</span> <span>${m.pageCount} pages</span></div>
          <div><span style="color: var(--text-secondary);">PDF Version:</span> <span>${m.pdfVersion || 'PDF 1.7'}</span></div>
        </div>

        <!-- Editable Metadata -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div>
            <label for="meta-title-input" style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px;">Document Title:</label>
            <input type="text" id="meta-title-input" value="${m.title || ''}" placeholder="Document title" style="width: 100%; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label for="meta-author-input" style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px;">Author:</label>
              <input type="text" id="meta-author-input" value="${m.author || ''}" placeholder="Author name" style="width: 100%; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;" />
            </div>
            <div>
              <label for="meta-subject-input" style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px;">Subject:</label>
              <input type="text" id="meta-subject-input" value="${m.subject || ''}" placeholder="Subject or category" style="width: 100%; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;" />
            </div>
          </div>

          <div>
            <label for="meta-keywords-input" style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px;">Keywords:</label>
            <input type="text" id="meta-keywords-input" value="${m.keywords || ''}" placeholder="Comma separated keywords" style="width: 100%; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;" />
          </div>

          <div>
            <label for="meta-creator-input" style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 2px;">Creator Application:</label>
            <input type="text" id="meta-creator-input" value="${m.creator || ''}" placeholder="Creator" style="width: 100%; padding: 6px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); font-size: 0.85rem;" />
          </div>
        </div>

        <button class="btn" id="sanitize-meta-btn" aria-label="Sanitize metadata and remove personal traces" style="border: 1px dashed var(--danger-color); color: var(--danger-color); font-size: 0.8rem; height: 32px; justify-content: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <span id="sanitize-label">Sanitize Metadata (Remove Personal & Author Traces)</span>
        </button>
      </div>

      <div class="modal-footer">
        <button class="btn" id="cancel-meta-btn">Cancel</button>
        <button class="btn btn-primary" id="save-meta-btn">Save Changes</button>
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
    const closeBtn = card.querySelector('#close-meta-btn');
    const cancelBtn = card.querySelector('#cancel-meta-btn');
    const saveBtn = card.querySelector('#save-meta-btn');
    const sanitizeBtn = card.querySelector('#sanitize-meta-btn');

    const titleInput = card.querySelector('#meta-title-input') as HTMLInputElement;
    const authorInput = card.querySelector('#meta-author-input') as HTMLInputElement;
    const subjectInput = card.querySelector('#meta-subject-input') as HTMLInputElement;
    const keywordsInput = card.querySelector('#meta-keywords-input') as HTMLInputElement;
    const creatorInput = card.querySelector('#meta-creator-input') as HTMLInputElement;

    titleInput?.focus();
    titleInput?.select();

    const textInputs = card.querySelectorAll<HTMLInputElement>('input[type="text"]');
    textInputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveBtn?.dispatchEvent(new MouseEvent('click'));
        }
      });
    });

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    sanitizeBtn?.addEventListener('click', () => {
      if (authorInput) authorInput.value = '';
      if (creatorInput) creatorInput.value = 'ZephyrPDF';
      if (keywordsInput) keywordsInput.value = '';
      if (subjectInput) subjectInput.value = '';
      const label = card.querySelector('#sanitize-label');
      if (label) {
        label.textContent = 'Metadata sanitized! Click "Save Changes" to apply.';
      }
    });

    saveBtn?.addEventListener('click', () => {
      this.metadata.title = titleInput?.value.trim() || undefined;
      this.metadata.author = authorInput?.value.trim() || undefined;
      this.metadata.subject = subjectInput?.value.trim() || undefined;
      this.metadata.keywords = keywordsInput?.value.trim() || undefined;
      this.metadata.creator = creatorInput?.value.trim() || undefined;
      this.metadata.modificationDate = new Date();

      if (this.events?.onSave) {
        this.events.onSave(this.metadata);
      }
      this.close();
    });
  }
}
