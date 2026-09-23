export interface PageVisibilityChangeCallback {
  (pageIndex: number, isVisible: boolean): void;
}

export class ViewportVirtualizer {
  private observer: IntersectionObserver | null = null;
  private container: HTMLElement;
  private onVisibilityChange: PageVisibilityChangeCallback;
  private observedElements: Map<number, HTMLElement> = new Map();

  constructor(
    container: HTMLElement,
    onVisibilityChange: PageVisibilityChangeCallback,
    rootMargin: string = '400px 0px 400px 0px'
  ) {
    this.container = container;
    this.onVisibilityChange = onVisibilityChange;

    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const pageIndexStr = entry.target.getAttribute('data-page-index');
            if (pageIndexStr !== null) {
              const pageIndex = parseInt(pageIndexStr, 10);
              this.onVisibilityChange(pageIndex, entry.isIntersecting);
            }
          });
        },
        {
          root: this.container,
          rootMargin,
          threshold: 0.01
        }
      );
    }
  }

  public observe(pageIndex: number, element: HTMLElement): void {
    element.setAttribute('data-page-index', pageIndex.toString());
    this.observedElements.set(pageIndex, element);
    this.observer?.observe(element);
  }

  public unobserve(pageIndex: number): void {
    const el = this.observedElements.get(pageIndex);
    if (el) {
      this.observer?.unobserve(el);
      this.observedElements.delete(pageIndex);
    }
  }

  public clear(): void {
    if (this.observer) {
      for (const el of this.observedElements.values()) {
        this.observer.unobserve(el);
      }
    }
    this.observedElements.clear();
  }

  public destroy(): void {
    this.clear();
    this.observer?.disconnect();
    this.observer = null;
  }
}
