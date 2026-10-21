import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthDraftField = "name" | "organization_name" | "email";

type AuthDraftState = {
  name: string;
  organization_name: string;
  email: string;
  setField: (field: AuthDraftField, value: string) => void;
  clear: () => void;
};

const initial = {
  name: "",
  organization_name: "",
  email: "",
};

export const useAuthDraftStore = create<AuthDraftState>()(
  persist(
    (set) => ({
      ...initial,
      setField: (field, value) => set({ [field]: value }),
      clear: () => set(initial),
    }),
    {
      name: "numdock.auth.draft",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ name, organization_name, email }) => ({
        name,
        organization_name,
        email,
      }),
    },
  ),
);
