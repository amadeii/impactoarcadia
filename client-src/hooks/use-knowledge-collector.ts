import { useEffect } from "react";
import { useAuth } from "./use-auth";
import { knowledgeCollector, initKnowledgeCollector } from "@/lib/knowledge-collector";

export function useKnowledgeCollector() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      initKnowledgeCollector();
    }
  }, [user]);

  return {
    trackPageView: (pageName: string, route?: string) => {
      if (user) knowledgeCollector.trackPageView(pageName, route);
    },
    trackAppOpen: (appName: string, appUrl?: string, category?: string) => {
      if (user) knowledgeCollector.trackAppOpen(appName, appUrl, category);
    },
    trackSiteNavigation: (siteName: string, url: string) => {
      if (user) knowledgeCollector.trackSiteNavigation(siteName, url);
    },
    trackSearch: (query: string, module: string, resultsCount?: number) => {
      if (user) knowledgeCollector.trackSearch(query, module, resultsCount);
    },
    trackFormSubmit: (formName: string, module: string, fields?: string[]) => {
      if (user) knowledgeCollector.trackFormSubmit(formName, module, fields);
    },
    trackButtonClick: (buttonName: string, module: string, context?: Record<string, any>) => {
      if (user) knowledgeCollector.trackButtonClick(buttonName, module, context);
    },
    trackFileOpen: (fileName: string, fileType: string, source?: string) => {
      if (user) knowledgeCollector.trackFileOpen(fileName, fileType, source);
    },
    trackDocumentView: (docName: string, docType: string, source?: string) => {
      if (user) knowledgeCollector.trackDocumentView(docName, docType, source);
    },
    trackFeatureUse: (feature: string, module: string, details?: Record<string, any>) => {
      if (user) knowledgeCollector.trackFeatureUse(feature, module, details);
    },
    trackContentCapture: (url: string, title: string, wordCount: number) => {
      if (user) knowledgeCollector.trackContentCapture(url, title, wordCount);
    },
    trackIframeInteraction: (appName: string, url: string, interactionType: string) => {
      if (user) knowledgeCollector.trackIframeInteraction(appName, url, interactionType);
    },
    getSessionId: () => knowledgeCollector.getSessionId(),
    getQueueSize: () => knowledgeCollector.getQueueSize(),
  };
}
