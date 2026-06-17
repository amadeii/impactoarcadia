import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type SoeMotor = "plus" | "erpnext";

interface SoeMotorContextType {
  motor: SoeMotor;
  setMotor: (motor: SoeMotor) => void;
  usePlus: boolean;
  useERPNext: boolean;
  getApiUrl: (localPath: string, plusPath: string, erpnextPath?: string) => string;
  profile: SoeMotor;
  setProfile: (motor: SoeMotor) => void;
}

const SoeMotorCtx = createContext<SoeMotorContextType | null>(null);

export function SoeMotorProvider({ children }: { children: ReactNode }) {
  const [motor, setMotorState] = useState<SoeMotor>(() => {
    const saved = localStorage.getItem("arcadia_soe_motor") || localStorage.getItem("arcadia_erp_profile");
    return (saved as SoeMotor) || "plus";
  });

  const setMotor = (newMotor: SoeMotor) => {
    setMotorState(newMotor);
    localStorage.setItem("arcadia_soe_motor", newMotor);
    localStorage.setItem("arcadia_erp_profile", newMotor);
  };

  const usePlus = motor === "plus";
  const useERPNext = motor === "erpnext";

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
    <SoeMotorCtx.Provider value={{ motor, setMotor, usePlus, useERPNext, getApiUrl, profile: motor, setProfile: setMotor }}>
      {children}
    </SoeMotorCtx.Provider>
  );
}

export function useSoeMotor() {
  const context = useContext(SoeMotorCtx);
  if (!context) {
    throw new Error("useSoeMotor must be used within SoeMotorProvider");
  }
  return context;
}

export function useErpProfile() {
  const ctx = useSoeMotor();
  return ctx;
}

export type ErpProfile = SoeMotor;
export const ErpProfileProvider = SoeMotorProvider;
