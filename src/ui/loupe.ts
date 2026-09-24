export class DocumentLoupe {
  private loupeEl: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private isActive: boolean = false;
  private zoomFactor: number = 2.5;
  private size: number = 180;

  constructor() {
    this.loupeEl = document.createElement('div');
    this.loupeEl.className = 'document-loupe-lens';
    this.loupeEl.style.position = 'fixed';
    this.loupeEl.style.width = `${this.size}px`;
    this.loupeEl.style.height = `${this.size}px`;
    this.loupeEl.style.borderRadius = '50%';
    this.loupeEl.style.border = '3px solid #38bdf8';
    this.loupeEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.2)';
    this.loupeEl.style.overflow = 'hidden';
    this.loupeEl.style.pointerEvents = 'none';
    this.loupeEl.style.zIndex = '999';
    this.loupeEl.style.display = 'none';
    this.loupeEl.style.backgroundColor = '#ffffff';

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');

    this.loupeEl.appendChild(this.canvas);
    document.body.appendChild(this.loupeEl);

    this.attachEvents();
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    if (!active) {
      this.loupeEl.style.display = 'none';
    }
  }

  private attachEvents(): void {
    window.addEventListener('mouseleave', () => {
      if (this.isActive) {
        this.loupeEl.style.display = 'none';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;

      this.loupeEl.style.left = `${e.clientX - this.size / 2}px`;
      this.loupeEl.style.top = `${e.clientY - this.size / 2}px`;
      this.loupeEl.style.display = 'block';

      // Find the page canvas directly underneath cursor
      const underEl = document.elementFromPoint(e.clientX, e.clientY);
      if (!underEl) return;

      const pageContainer = underEl.closest('.page-container');
      const pageCanvas = pageContainer?.querySelector('.page-canvas') as HTMLCanvasElement | null;

      if (!pageCanvas || !this.ctx) {
        this.ctx?.clearRect(0, 0, this.size, this.size);
        return;
      }

      const rect = pageCanvas.getBoundingClientRect();
      const relX = (e.clientX - rect.left) * (pageCanvas.width / rect.width);
      const relY = (e.clientY - rect.top) * (pageCanvas.height / rect.height);

      const srcSize = this.size / this.zoomFactor;
      const srcX = relX - srcSize / 2;
      const srcY = relY - srcSize / 2;

      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.size, this.size);

      try {
        this.ctx.drawImage(
          pageCanvas,
          srcX,
          srcY,
          srcSize,
          srcSize,
          0,
          0,
          this.size,
          this.size
        );

        // Draw crosshair indicator in center of loupe
        this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.size / 2 - 10, this.size / 2);
        this.ctx.lineTo(this.size / 2 + 10, this.size / 2);
        this.ctx.moveTo(this.size / 2, this.size / 2 - 10);
        this.ctx.lineTo(this.size / 2, this.size / 2 + 10);
        this.ctx.stroke();
      } catch {
        // Ignored
      }
    });
  }
}
