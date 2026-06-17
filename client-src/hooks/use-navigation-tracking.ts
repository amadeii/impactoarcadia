import { useCallback, useRef } from "react";
import { useAuth } from "./use-auth";

interface TrackingData {
  module: string;
  action: string;
  metadata?: Record<string, any>;
}

const DEBOUNCE_MS = 2000;

export function useNavigationTracking() {
  const { user } = useAuth();
  const lastTrack = useRef<string>("");
  const lastTime = useRef<number>(0);

  const track = useCallback(async (data: TrackingData) => {
    if (!user) return;

    const key = `${data.module}:${data.action}:${JSON.stringify(data.metadata || {})}`;
    const now = Date.now();

    if (key === lastTrack.current && now - lastTime.current < DEBOUNCE_MS) {
      return;
    }

    lastTrack.current = key;
    lastTime.current = now;

    try {
      await fetch("/api/learning/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
    } catch (error) {
      console.debug("[Tracking] Navigation track failed:", error);
    }
  }, [user]);

  const trackPageView = useCallback((pageName: string, route?: string) => {
    track({
      module: pageName,
      action: "page_view",
      metadata: { route, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackAppOpen = useCallback((appName: string, appUrl?: string, category?: string) => {
    track({
      module: "applications",
      action: "app_open",
      metadata: { appName, appUrl, category, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackSiteNavigation = useCallback((siteName: string, url: string, domain?: string) => {
    const extractedDomain = domain || new URL(url).hostname;
    track({
      module: "browser",
      action: "site_navigation",
      metadata: { 
        siteName, 
        url, 
        domain: extractedDomain,
        timestamp: new Date().toISOString() 
      },
    });
  }, [track]);

  const trackFeatureUse = useCallback((feature: string, details?: Record<string, any>) => {
    track({
      module: feature,
      action: "feature_use",
      metadata: { ...details, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackSearch = useCallback((query: string, module: string, resultsCount?: number) => {
    track({
      module,
      action: "search",
      metadata: { query, resultsCount, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackDocumentView = useCallback((docName: string, docType: string, source?: string) => {
    track({
      module: "documents",
      action: "document_view",
      metadata: { docName, docType, source, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackDigitalBook = useCallback((bookTitle: string, author?: string, chapter?: string) => {
    track({
      module: "digital_library",
      action: "book_read",
      metadata: { bookTitle, author, chapter, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackExternalConsult = useCallback((appName: string, consultType: string, query?: string) => {
    track({
      module: "external_consult",
      action: "consult",
      metadata: { appName, consultType, query, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackIframeInteraction = useCallback((appName: string, url: string, interactionType: string) => {
    track({
      module: "iframe_browser",
      action: interactionType,
      metadata: { appName, url, timestamp: new Date().toISOString() },
    });
  }, [track]);

  const trackContentConsumption = useCallback((contentType: string, contentTitle: string, source: string, duration?: number) => {
    track({
      module: "content_consumption",
      action: "consume",
      metadata: { contentType, contentTitle, source, duration, timestamp: new Date().toISOString() },
    });
  }, [track]);

  return {
    track,
    trackPageView,
    trackAppOpen,
    trackSiteNavigation,
    trackFeatureUse,
    trackSearch,
    trackDocumentView,
    trackDigitalBook,
    trackExternalConsult,
    trackIframeInteraction,
    trackContentConsumption,
  };
}
