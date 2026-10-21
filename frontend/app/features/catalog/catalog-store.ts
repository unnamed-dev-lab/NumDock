import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect, useState } from "react";

export type NumbersTab = "numbers" | "catalog";

export interface CatalogState {
  activeTab: NumbersTab;
  setActiveTab: (tab: NumbersTab) => void;

  globalFilter: string;
  setGlobalFilter: (filter: string) => void;

  countryFilter: string;
  setCountryFilter: (country: string) => void;

  typeFilter: string;
  setTypeFilter: (type: string) => void;

  capabilityFilter: string;
  setCapabilityFilter: (capability: string) => void;

  pageIndex: number;
  pageSize: number;
  setPagination: (pageIndex: number, pageSize: number) => void;

  resetFilters: () => void;
}

const initialFilters = {
  globalFilter: "",
  countryFilter: "all",
  typeFilter: "all",
  capabilityFilter: "all",
  pageIndex: 0,
  pageSize: 10,
};

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set) => ({
      activeTab: "numbers",
      ...initialFilters,
      setActiveTab: (tab) => set({ activeTab: tab }),
      setGlobalFilter: (filter) => set({ globalFilter: filter, pageIndex: 0 }),
      setCountryFilter: (country) => set({ countryFilter: country, pageIndex: 0 }),
      setTypeFilter: (type) => set({ typeFilter: type, pageIndex: 0 }),
      setCapabilityFilter: (capability) =>
        set({ capabilityFilter: capability, pageIndex: 0 }),
      setPagination: (pageIndex, pageSize) => set({ pageIndex, pageSize }),
      resetFilters: () => set(initialFilters),
    }),
    {
      name: "numdock.workspace.catalog",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        activeTab: state.activeTab,
        globalFilter: state.globalFilter,
        countryFilter: state.countryFilter,
        typeFilter: state.typeFilter,
        capabilityFilter: state.capabilityFilter,
        pageSize: state.pageSize,
        pageIndex: state.pageIndex,
      }),
    },
  ),
);

/**
 * Rehydrates client-persisted preferences on mount without blocking SSR.
 */
export function useHydratedCatalogStore() {
  const store = useCatalogStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve(useCatalogStore.persist.rehydrate())
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { ...store, isReady: ready };
}

