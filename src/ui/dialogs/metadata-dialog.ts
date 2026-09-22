import { DocumentMetadata } from '../../types/document';

export class MetadataDialog {
  private backdrop: HTMLElement | null = null;
  private metadata: DocumentMetadata;

  constructor(metadata: DocumentMetadata) {
    this.metadata = metadata;
  }

  public open(): void {
    this.render();
  }

  private close(): void {
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
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

    const m = this.metadata;

    card.innerHTML = `
      <div class="modal-header">
        <h3>Document Properties</h3>
        <button class="icon-btn" id="close-meta-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="shortcut-row"><span>File Name</span><strong>${m.fileName || 'Untitled'}</strong></div>
        <div class="shortcut-row"><span>File Size</span><span>${this.formatBytes(m.fileSize)}</span></div>
        <div class="shortcut-row"><span>Page Count</span><span>${m.pageCount} pages</span></div>
        <div class="shortcut-row"><span>Title</span><span>${m.title || '—'}</span></div>
        <div class="shortcut-row"><span>Author</span><span>${m.author || '—'}</span></div>
        <div class="shortcut-row"><span>Subject</span><span>${m.subject || '—'}</span></div>
        <div class="shortcut-row"><span>Creator</span><span>${m.creator || '—'}</span></div>
        <div class="shortcut-row"><span>Producer</span><span>${m.producer || '—'}</span></div>
        <div class="shortcut-row"><span>Created</span><span>${m.creationDate ? m.creationDate.toLocaleString() : '—'}</span></div>
        <div class="shortcut-row"><span>Modified</span><span>${m.modificationDate ? m.modificationDate.toLocaleString() : '—'}</span></div>
        <div class="shortcut-row"><span>PDF Format</span><span>${m.pdfVersion || 'PDF 1.7'}</span></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="ok-meta-btn">Close</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);

    const closeBtn = card.querySelector('#close-meta-btn');
    const okBtn = card.querySelector('#ok-meta-btn');

    closeBtn?.addEventListener('click', () => this.close());
    okBtn?.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }
}
