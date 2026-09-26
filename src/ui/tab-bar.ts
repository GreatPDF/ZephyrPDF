import { DocumentSession } from '../core/document-session';

export interface TabBarEvents {
  onSelectTab: (sessionId: string) => void;
  onCloseTab: (sessionId: string) => void;
  onNewTab: () => void;
}

export class DocumentTabBar {
  private container: HTMLElement;
  private events: TabBarEvents;
  private activeSessionId: string | null = null;
  private sessions: DocumentSession[] = [];

  constructor(container: HTMLElement, events: TabBarEvents) {
    this.container = container;
    this.events = events;
  }

  public update(sessions: DocumentSession[], activeId: string | null): void {
    this.sessions = sessions;
    this.activeSessionId = activeId;
    this.render();
  }

  private render(): void {
    if (this.sessions.length === 0) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'flex';
    this.container.innerHTML = '';

    const tabStrip = document.createElement('div');
    tabStrip.className = 'doc-tab-strip';
    tabStrip.setAttribute('role', 'tablist');

    for (const session of this.sessions) {
      const isActive = session.id === this.activeSessionId;
      const tab = document.createElement('div');
      tab.className = `doc-tab ${isActive ? 'active' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isActive.toString());
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
      tab.setAttribute('aria-label', `Document tab: ${session.doc.metadata.fileName}${isActive ? ', active' : ''}`);
      tab.setAttribute('data-id', session.id);
      tab.title = session.doc.metadata.fileName;

      tab.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.7; flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <span class="doc-tab-title">${session.doc.metadata.fileName}</span>
        <button class="doc-tab-close" title="Close document" aria-label="Close document ${session.doc.metadata.fileName}">✕</button>
      `;

      tab.addEventListener('click', () => {
        if (session.id !== this.activeSessionId) {
          this.events.onSelectTab(session.id);
        }
      });

      tab.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextTab = tab.nextElementSibling as HTMLElement;
          if (nextTab && nextTab.classList.contains('doc-tab')) {
            nextTab.focus();
            nextTab.click();
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevTab = tab.previousElementSibling as HTMLElement;
          if (prevTab && prevTab.classList.contains('doc-tab')) {
            prevTab.focus();
            prevTab.click();
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tab.click();
        } else if (e.key === 'Delete') {
          e.preventDefault();
          this.events.onCloseTab(session.id);
        }
      });

      const closeBtn = tab.querySelector('.doc-tab-close');
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.events.onCloseTab(session.id);
      });

      tabStrip.appendChild(tab);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'doc-tab-add';
    addBtn.title = 'Open PDF in new tab';
    addBtn.setAttribute('aria-label', 'Open PDF in new tab');
    addBtn.innerHTML = '+';
    addBtn.addEventListener('click', () => {
      this.events.onNewTab();
    });

    tabStrip.appendChild(addBtn);
    this.container.appendChild(tabStrip);
  }
}
