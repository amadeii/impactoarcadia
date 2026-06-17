import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ErpProfile = "plus" | "erpnext";

interface ErpProfileContextType {
  profile: ErpProfile;
  setProfile: (profile: ErpProfile) => void;
  usePlus: boolean;
  useERPNext: boolean;
  getApiUrl: (localPath: string, plusPath: string, erpnextPath?: string) => string;
}

const ErpProfileContext = createContext<ErpProfileContextType | null>(null);

export function ErpProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ErpProfile>(() => {
    const saved = localStorage.getItem("arcadia_erp_profile");
    return (saved as ErpProfile) || "plus";
  });

  const setProfile = (newProfile: ErpProfile) => {
    setProfileState(newProfile);
    localStorage.setItem("arcadia_erp_profile", newProfile);
  };

  const usePlus = profile === "plus";
  const useERPNext = profile === "erpnext";

  const getApiUrl = (localPath: string, plusPath: string, erpnextPath?: string): string => {
    if (usePlus) {
      return `/plus/api${plusPath}`;
    }
    if (useERPNext && erpnextPath) {
      return erpnextPath;
    }
    return localPath;
  };

  return (
    <ErpProfileContext.Provider value={{ profile, setProfile, usePlus, useERPNext, getApiUrl }}>
      {children}
    </ErpProfileContext.Provider>
  );
}

export function useErpProfile() {
  const context = useContext(ErpProfileContext);
  if (!context) {
    throw new Error("useErpProfile must be used within ErpProfileProvider");
  }
  return context;
}
