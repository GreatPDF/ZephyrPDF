import { NotificationService } from '../notification';

export interface FeedbackContext {
  version?: string;
  currentPage?: number;
  pageCount?: number;
  zoom?: number;
  theme?: string;
  viewMode?: string;
}

export class FeedbackDialog {
  private backdrop: HTMLElement | null = null;
  private context: FeedbackContext;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  constructor(context: FeedbackContext = {}) {
    this.context = {
      version: '2.9.0',
      currentPage: 1,
      pageCount: 1,
      zoom: 1,
      theme: 'dark',
      viewMode: 'continuous',
      ...context,
    };
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

  public getDiagnosticsText(): string {
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '1440x900';
    const screenRes = typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : '1440x900';
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'ZephyrPDF Environment';
    const href = typeof window !== 'undefined' && window.location ? window.location.href : 'https://greatpdf.github.io/ZephyrPDF/';

    return [
      '--- System & Environment Diagnostics ---',
      `App: ZephyrPDF v${this.context.version}`,
      `URL: ${href}`,
      `User Agent: ${ua}`,
      `Screen: ${screenRes} (DPR: ${dpr})`,
      `Viewport: ${viewport}`,
      `Document State: Page ${this.context.currentPage} / ${this.context.pageCount}, Zoom: ${Math.round((this.context.zoom || 1) * 100)}%`,
      `Theme: ${this.context.theme}, View Mode: ${this.context.viewMode}`,
      '----------------------------------------',
    ].join('\n');
  }

  public formatReport(type: string, subject: string, description: string, includeDiag: boolean): { subject: string; body: string } {
    const cleanSubject = `[ZephyrPDF ${type}] ${subject.trim() || 'User Feedback'}`;
    const diagSection = includeDiag ? `\n\n${this.getDiagnosticsText()}` : '';
    const body = `Type: ${type}\nSubject: ${subject.trim() || 'N/A'}\n\nDescription:\n${description.trim() || '(No details provided)'}${diagSection}`;
    return { subject: cleanSubject, body };
  }

  private render(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '560px';

    const diagText = this.getDiagnosticsText();

    card.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="9" y1="10" x2="9.01" y2="10" stroke-width="3"></line><line x1="12" y1="10" x2="12.01" y2="10" stroke-width="3"></line><line x1="15" y1="10" x2="15.01" y2="10" stroke-width="3"></line></svg>
          <h3 style="margin: 0; font-size: 1.15rem;">Feedback & Bug Report</h3>
        </div>
        <button class="icon-btn" id="close-feedback-btn" title="Close (Esc)">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
        <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.4;">
          Help us improve ZephyrPDF! You can report bugs, request features, or send feedback directly—no GitHub account required.
        </p>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 140px;">
            <label for="feedback-type" style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Type</label>
            <select id="feedback-type" style="width: 100%; height: 32px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 4px 8px; font-size: 0.85rem;">
              <option value="Bug Report">Bug Report</option>
              <option value="Feature Request">Feature Request</option>
              <option value="General Feedback">General Feedback</option>
            </select>
          </div>
          <div style="flex: 2; min-width: 200px;">
            <label for="feedback-subject" style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Subject / Title</label>
            <input type="text" id="feedback-subject" placeholder="Brief summary of the issue or idea..." style="width: 100%; height: 32px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 4px 8px; font-size: 0.85rem; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label for="feedback-desc" style="display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Details / Description</label>
          <textarea id="feedback-desc" rows="5" placeholder="What happened? What did you expect to happen? Steps to reproduce..." style="width: 100%; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; padding: 8px; font-size: 0.85rem; resize: vertical; box-sizing: border-box; font-family: inherit;"></textarea>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="feedback-include-diag" checked style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-color);" />
          <label for="feedback-include-diag" style="font-size: 0.8rem; color: var(--text-secondary); cursor: pointer; user-select: none;">
            Include environment diagnostics (browser, OS, viewport, app state)
          </label>
        </div>

        <details style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-secondary); border-radius: 4px; padding: 6px 10px; border: 1px solid var(--border-color);">
          <summary style="cursor: pointer; font-weight: 500;">Preview system diagnostics</summary>
          <pre id="feedback-diag-preview" style="margin: 8px 0 0; white-space: pre-wrap; font-family: monospace; font-size: 0.72rem; max-height: 120px; overflow-y: auto; color: var(--text-secondary);">${diagText}</pre>
        </details>

        <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
          <span>Prefer GitHub? <a href="https://github.com/GreatPDF/ZephyrPDF/issues/new" target="_blank" rel="noopener" style="color: var(--accent-color); text-decoration: underline;">Open an Issue on GitHub</a></span>
          <span>Maintainer: <a href="mailto:greatpdf@ik.me" style="color: var(--accent-color);">greatpdf@ik.me</a></span>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn" id="feedback-cancel-btn">Cancel</button>
        <button class="btn" id="feedback-copy-btn" title="Copy report to clipboard to paste into any email or chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copy Report
        </button>
        <button class="btn btn-primary" id="feedback-send-btn" title="Open your default email client with pre-filled report">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>Send Email
        </button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }

    const closeBtn = card.querySelector('#close-feedback-btn');
    const cancelBtn = card.querySelector('#feedback-cancel-btn');
    const copyBtn = card.querySelector('#feedback-copy-btn');
    const sendBtn = card.querySelector('#feedback-send-btn');
    const typeSelect = card.querySelector('#feedback-type') as HTMLSelectElement;
    const subjectInput = card.querySelector('#feedback-subject') as HTMLInputElement;
    const descInput = card.querySelector('#feedback-desc') as HTMLTextAreaElement;
    const includeDiagCheckbox = card.querySelector('#feedback-include-diag') as HTMLInputElement;

    const doClose = () => this.close();
    closeBtn?.addEventListener('click', doClose);
    cancelBtn?.addEventListener('click', doClose);
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) doClose();
    });

    copyBtn?.addEventListener('click', async () => {
      const type = typeSelect?.value || 'Feedback';
      const subject = subjectInput?.value || '';
      const desc = descInput?.value || '';
      const includeDiag = includeDiagCheckbox?.checked ?? true;

      const report = this.formatReport(type, subject, desc, includeDiag);
      const fullText = `${report.subject}\n\n${report.body}`;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullText);
        } else {
          const ta = document.createElement('textarea');
          ta.value = fullText;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        NotificationService.show('Report copied to clipboard! Paste into your email to greatpdf@ik.me');
      } catch {
        NotificationService.show('Failed to copy to clipboard', 3000, true);
      }
    });

    sendBtn?.addEventListener('click', () => {
      const type = typeSelect?.value || 'Feedback';
      const subject = subjectInput?.value || '';
      const desc = descInput?.value || '';
      const includeDiag = includeDiagCheckbox?.checked ?? true;

      const report = this.formatReport(type, subject, desc, includeDiag);
      const mailtoUrl = `mailto:greatpdf@ik.me?subject=${encodeURIComponent(report.subject)}&body=${encodeURIComponent(report.body)}`;

      window.location.href = mailtoUrl;
      NotificationService.show('Opening email client...');
      this.close();
    });

    // Focus subject input
    setTimeout(() => subjectInput?.focus(), 50);
  }
}
