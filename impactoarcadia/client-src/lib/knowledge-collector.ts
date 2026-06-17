type EventType = 
  | 'page_view'
  | 'page_dwell'
  | 'app_open'
  | 'site_navigation'
  | 'search'
  | 'form_submit'
  | 'button_click'
  | 'file_open'
  | 'document_view'
  | 'feature_use'
  | 'content_capture'
  | 'iframe_interaction';

interface CollectorEvent {
  type: EventType;
  module: string;
  data: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

interface DwellTracker {
  url: string;
  startTime: number;
  module: string;
}

class KnowledgeCollector {
  private queue: CollectorEvent[] = [];
  private flushInterval = 5000;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private dwellTracker: DwellTracker | null = null;
  private dwellThreshold = 30000;
  private isInitialized = false;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);

    this.setupDwellTracking();
    this.setupUnloadHandler();
    this.setupVisibilityHandler();

    console.debug('[KnowledgeCollector] Initialized with session:', this.sessionId);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private setupDwellTracking() {
    this.startDwellTracking(window.location.pathname, this.getModuleFromPath(window.location.pathname));

    window.addEventListener('popstate', () => {
      this.checkAndEmitDwell();
      this.startDwellTracking(window.location.pathname, this.getModuleFromPath(window.location.pathname));
    });
  }

  private setupUnloadHandler() {
    window.addEventListener('beforeunload', () => {
      this.checkAndEmitDwell();
      this.flushSync();
    });
  }

  private setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.checkAndEmitDwell();
      } else {
        this.startDwellTracking(window.location.pathname, this.getModuleFromPath(window.location.pathname));
      }
    });
  }

  private getModuleFromPath(path: string): string {
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'home';
    const moduleMap: Record<string, string> = {
      'agent': 'agent',
      'compass': 'compass',
      'insights': 'insights',
      'admin': 'admin',
      'app': 'applications',
      'scientist': 'scientist',
      'crm': 'crm',
      'valuation': 'valuation',
      'comunicacao': 'communication',
      'ide': 'ide',
    };
    return moduleMap[segments[0]] || segments[0];
  }

  startDwellTracking(url: string, module: string) {
    this.dwellTracker = {
      url,
      startTime: Date.now(),
      module,
    };
  }

  private checkAndEmitDwell() {
    if (!this.dwellTracker) return;

    const timeSpent = Date.now() - this.dwellTracker.startTime;
    
    if (timeSpent >= this.dwellThreshold) {
      this.track('page_dwell', this.dwellTracker.module, {
        url: this.dwellTracker.url,
        timeSpent,
        timeSpentSeconds: Math.round(timeSpent / 1000),
      });
    }

    this.dwellTracker = null;
  }

  track(type: EventType, module: string, data: Record<string, any> = {}) {
    const event: CollectorEvent = {
      type,
      module,
      data: {
        ...data,
        path: window.location.pathname,
        href: window.location.href,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.queue.push(event);
    console.debug('[KnowledgeCollector] Event tracked:', type, module);

    if (this.queue.length >= 20) {
      this.flush();
    }
  }

  trackPageView(pageName: string, route?: string) {
    this.checkAndEmitDwell();
    this.startDwellTracking(route || window.location.pathname, pageName);
    
    this.track('page_view', pageName, { route });
  }

  trackAppOpen(appName: string, appUrl?: string, category?: string) {
    this.track('app_open', 'applications', { appName, appUrl, category });
  }

  trackSiteNavigation(siteName: string, url: string) {
    try {
      const domain = new URL(url).hostname;
      this.track('site_navigation', 'browser', { siteName, url, domain });
    } catch {
      this.track('site_navigation', 'browser', { siteName, url });
    }
  }

  trackSearch(query: string, module: string, resultsCount?: number) {
    this.track('search', module, { query, resultsCount });
  }

  trackFormSubmit(formName: string, module: string, fields?: string[]) {
    this.track('form_submit', module, { formName, fields });
  }

  trackButtonClick(buttonName: string, module: string, context?: Record<string, any>) {
    this.track('button_click', module, { buttonName, ...context });
  }

  trackFileOpen(fileName: string, fileType: string, source?: string) {
    this.track('file_open', 'files', { fileName, fileType, source });
  }

  trackDocumentView(docName: string, docType: string, source?: string) {
    this.track('document_view', 'documents', { docName, docType, source });
  }

  trackFeatureUse(feature: string, module: string, details?: Record<string, any>) {
    this.track('feature_use', module, { feature, ...details });
  }

  trackContentCapture(url: string, title: string, wordCount: number) {
    this.track('content_capture', 'knowledge', { url, title, wordCount });
  }

  trackIframeInteraction(appName: string, url: string, interactionType: string) {
    this.track('iframe_interaction', 'iframe_browser', { appName, url, interactionType });
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    try {
      const response = await fetch('/api/collector/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        console.warn('[KnowledgeCollector] Flush failed, re-queueing events');
        this.queue = [...events, ...this.queue];
      } else {
        console.debug('[KnowledgeCollector] Flushed', events.length, 'events');
      }
    } catch (error) {
      console.warn('[KnowledgeCollector] Flush error:', error);
      this.queue = [...events, ...this.queue];
    }
  }

  private flushSync() {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    const payload = JSON.stringify({ events });

    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const success = navigator.sendBeacon('/api/collector/events', blob);
      
      if (!success) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/collector/events', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
      }
    } catch {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/collector/events', false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushSync();
    this.isInitialized = false;
  }
}

export const knowledgeCollector = new KnowledgeCollector();

export function initKnowledgeCollector() {
  knowledgeCollector.init();
}
