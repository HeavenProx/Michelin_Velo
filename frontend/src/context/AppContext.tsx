import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LiveData, WearAlert } from "@/types";

/**
 * État d'authentification réhydraté au démarrage depuis la session backend.
 * - "checking" : bootstrap en cours, on ne sait pas encore (ne pas afficher la landing).
 * - "authed"   : session Strava valide côté backend.
 * - "guest"    : pas de session (ou expirée).
 */
type AuthStatus = "checking" | "authed" | "guest";

interface AppContextValue {
  liveData: LiveData | undefined;
  loading: boolean;
  authStatus: AuthStatus;
  loadLiveData: (refresh?: boolean) => Promise<void>;
  loadDemoData: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  connectStrava: () => void;
  wearAlerts: WearAlert[];
  alertCount: number;
  triggerWearAlert: (tire: string, wear: number) => void;
  dismissWearAlert: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function todayLabel(): string {
  return new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [liveData, setLiveData]     = useState<LiveData | undefined>(undefined);
  const [loading, setLoading]       = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [wearAlerts, setWearAlerts] = useState<WearAlert[]>(() => {
    try {
      const stored = localStorage.getItem("michelin_wear_alerts");
      return stored ? (JSON.parse(stored) as WearAlert[]) : [];
    } catch {
      return [];
    }
  });

  // Ref pour éviter les doubles envois d'email (React strict-mode / re-renders)
  const emailedTires = useRef<Set<string>>(new Set());

  // Persiste les alertes (actives + dismissées) pour survivre aux rechargements
  useEffect(() => {
    localStorage.setItem("michelin_wear_alerts", JSON.stringify(wearAlerts));
  }, [wearAlerts]);

  const alertCount = wearAlerts.filter((a) => !a.dismissed).length;

  /** Charge les données depuis l'API. Renvoie `true` si la session a répondu `success`. */
  async function fetchFromApi(path: string, isDemo: boolean): Promise<boolean> {
    setLoading(true);
    try {
      const r = await fetch(path, { credentials: "include" });
      const data = await r.json();
      if (data.success) {
        setLiveData({
          athlete: data.athlete,
          profile: data.profile,
          reco: {
            explanation: data.explanation,
            recommended: data.recommended,
            alternatives: data.alternatives,
          },
          isDemo,
        });
        return true;
      }
      return false;
    } catch {
      // silently fall back to demo data
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Réhydratation de session au démarrage : on demande au backend si une session
  // Strava valide existe encore (le cookie reste valable 24 h) avant d'afficher la
  // landing. Sans ça, chaque reload repartait à "déconnecté" car l'état vit en mémoire.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await fetchFromApi("/api/recommend", false);
      if (!cancelled) setAuthStatus(ok ? "authed" : "guest");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // `refresh=true` force le backend à contourner le cache 12 h (re-pull Strava
  // + recalcul météo) — utilisé par le bouton « rafraîchir » du dashboard.
  async function loadLiveData(refresh = false) {
    const path = refresh ? "/api/recommend?refresh=true" : "/api/recommend";
    const ok = await fetchFromApi(path, false);
    setAuthStatus(ok ? "authed" : "guest");
  }

  async function loadDemoData() {
    await fetchFromApi("/api/demo", true);
  }

  async function logout() {
    try {
      await fetch("/auth/logout", { credentials: "include" });
    } catch {}
    setLiveData(undefined);
    setAuthStatus("guest");
    setWearAlerts([]);
    emailedTires.current.clear();
    localStorage.removeItem("michelin_wear_alerts");
  }

  /**
   * Supprime définitivement le compte côté backend (profil + vélos + pneus en
   * cascade) puis réinitialise l'état local. Renvoie `true` en cas de succès.
   */
  async function deleteAccount(): Promise<boolean> {
    try {
      const r = await fetch("/auth/account", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await r.json().catch(() => ({ success: r.ok }));
      if (!data.success) return false;
    } catch {
      return false;
    }
    setLiveData(undefined);
    setAuthStatus("guest");
    setWearAlerts([]);
    emailedTires.current.clear();
    localStorage.removeItem("michelin_wear_alerts");
    return true;
  }

  function connectStrava() {
    window.location.href = "/auth/strava";
  }

  function triggerWearAlert(tire: string, wear: number) {
    setWearAlerts((prev) => {
      // Ne pas recréer si une alerte (active ou acquittée) existe déjà pour ce pneu
      if (prev.some((a) => a.tire === tire)) return prev;
      return [
        ...prev,
        { id: `${tire}-${Date.now()}`, tire, wear, date: todayLabel(), dismissed: false },
      ];
    });

    if (!emailedTires.current.has(tire)) {
      emailedTires.current.add(tire);
      fetch("/api/notify-wear", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tire, wear }),
      }).catch(() => {});
    }
  }

  function dismissWearAlert(id: string) {
    setWearAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    );
  }

  return (
    <AppContext.Provider
      value={{
        liveData, loading, authStatus, loadLiveData, loadDemoData, logout, deleteAccount, connectStrava,
        wearAlerts, alertCount, triggerWearAlert, dismissWearAlert,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
