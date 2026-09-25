import { FormFieldInfo } from '../../core/form-handler';

export interface FormFieldDialogProps {
  pageCount: number;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  existingFields?: FormFieldInfo[];
  onAddField: (field: FormFieldInfo) => void;
  onDeleteField?: (name: string) => void;
}

export class FormFieldDialog {
  private backdrop: HTMLElement | null = null;
  private props: FormFieldDialogProps;
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  constructor(props: FormFieldDialogProps) {
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

  private render(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '480px';

    card.innerHTML = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h3 style="margin: 0; font-size: 1.15rem;">Add Interactive Form Field</h3>
        </div>
        <button class="icon-btn" id="close-ff-btn" aria-label="Close dialog" title="Close dialog">✕</button>
      </div>

      <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Field Type:</label>
          <select id="ff-type-select" style="width: 100%; padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 0.9rem;">
            <option value="text">Single-line Text Field</option>
            <option value="textarea">Multi-line Text Field (Textarea)</option>
            <option value="checkbox">Checkbox</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Field Name (ID):</label>
          <input type="text" id="ff-name-input" placeholder="e.g. client_name" style="width: 100%; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 0.9rem;" value="field_${Math.random().toString(36).substring(2, 7)}" />
          <span style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-top: 4px;">Standard unique identifier saved into PDF AcroForm.</span>
        </div>

        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Default Value (Optional):</label>
          <input type="text" id="ff-val-input" placeholder="e.g. John Doe or leave blank" style="width: 100%; padding: 8px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 0.9rem;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Target Page:</label>
            <select id="ff-page-select" style="width: 100%; padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 0.9rem;">
              ${Array.from({ length: this.props.pageCount }, (_, i) => `<option value="${i}" ${i === this.props.currentPage - 1 ? 'selected' : ''}>Page ${i + 1}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Placement:</label>
            <select id="ff-pos-select" style="width: 100%; padding: 8px 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 0.9rem;">
              <option value="center">Center of Page</option>
              <option value="top">Top Left (Header Area)</option>
              <option value="bottom">Bottom Left (Footer Area)</option>
            </select>
          </div>
        </div>

        ${this.props.existingFields && this.props.existingFields.length > 0 ? `
          <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;">Existing Form Fields (${this.props.existingFields.length}):</label>
            <div style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
              ${this.props.existingFields.map(f => `
                <div class="existing-field-row" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--bg-secondary); border-radius: 6px; font-size: 0.85rem;">
                  <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                    <span style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${f.name}</span>
                    <span style="font-size: 0.72rem; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary); text-transform: uppercase;">${f.type}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">Page ${f.pageIndex + 1}</span>
                  </div>
                  <button class="icon-btn btn-delete-ff" data-name="${f.name}" aria-label="Delete field ${f.name}" title="Delete field" style="color: var(--danger-color); padding: 2px 6px;">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <div class="modal-footer">
        <button class="btn" id="cancel-ff-btn">Cancel</button>
        <button class="btn btn-primary" id="apply-ff-btn">Insert Field</button>
      </div>
    `;

    this.backdrop.appendChild(card);
    document.body.appendChild(this.backdrop);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }

    const closeBtn = card.querySelector('#close-ff-btn');
    const cancelBtn = card.querySelector('#cancel-ff-btn');
    const applyBtn = card.querySelector('#apply-ff-btn');
    const nameInput = card.querySelector('#ff-name-input') as HTMLInputElement;
    const valInput = card.querySelector('#ff-val-input') as HTMLInputElement;

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (applyBtn as HTMLButtonElement)?.click();
      }
    };
    nameInput?.addEventListener('keydown', handleEnter);
    valInput?.addEventListener('keydown', handleEnter);

    setTimeout(() => {
      nameInput?.focus();
      nameInput?.select();
    }, 50);

    card.querySelectorAll('.btn-delete-ff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.getAttribute('data-name');
        if (name && this.props.onDeleteField) {
          this.props.onDeleteField(name);
          btn.closest('.existing-field-row')?.remove();
        }
      });
    });

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    applyBtn?.addEventListener('click', () => {
      const typeSelect = card.querySelector('#ff-type-select') as HTMLSelectElement;
      const nameInput = card.querySelector('#ff-name-input') as HTMLInputElement;
      const valInput = card.querySelector('#ff-val-input') as HTMLInputElement;
      const pageSelect = card.querySelector('#ff-page-select') as HTMLSelectElement;
      const posSelect = card.querySelector('#ff-pos-select') as HTMLSelectElement;

      const typeVal = typeSelect?.value || 'text';
      const type = (typeVal === 'checkbox' ? 'checkbox' : 'text') as 'text' | 'checkbox';
      const isTextarea = typeVal === 'textarea';
      const name = (nameInput?.value.trim() || `field_${Date.now()}`).replace(/\s+/g, '_');
      const pageIndex = parseInt(pageSelect?.value || '0', 10);
      const pos = posSelect?.value || 'center';

      let width = type === 'checkbox' ? 20 : (isTextarea ? 220 : 180);
      let height = type === 'checkbox' ? 20 : (isTextarea ? 70 : 26);

      const pw = this.props.pageWidth || 595;
      const ph = this.props.pageHeight || 842;

      let x = 60;
      let y = 150;
      if (pos === 'center') {
        x = Math.round(pw / 2 - width / 2);
        y = Math.round(ph / 2 - height / 2);
      } else if (pos === 'top') {
        x = 50;
        y = ph - 120;
      } else if (pos === 'bottom') {
        x = 50;
        y = 80;
      }

      const value = type === 'checkbox' ? (valInput?.value.toLowerCase() === 'true' || valInput?.value === '1') : (valInput?.value || '');

      this.props.onAddField({
        name,
        type,
        value,
        pageIndex,
        bounds: { x, y, width, height }
      });

      this.close();
    });
  }
}
