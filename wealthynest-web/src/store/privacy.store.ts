import {create} from "zustand";
import {persist} from "zustand/middleware";

interface PrivacyState {
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      hideAmounts:       false,
      toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
    }),
    { name: "wn-privacy" }
  )
);
