import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthDraftField = "name" | "email";

type AuthDraftState = {
  name: string;
  email: string;
  setField: (field: AuthDraftField, value: string) => void;
  clear: () => void;
};

const initial = {
  name: "",
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
      partialize: ({ name, email }) => ({
        name,
        email,
      }),
    },
  ),
);
