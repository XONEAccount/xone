import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n/messages";

type LocaleState = {
  locale: Locale;
  /**
   * Sets the active UI locale.
   * @param locale - `en` or `zh`
   */
  setLocale: (locale: Locale) => void;
  /**
   * Toggles between English and Chinese.
   */
  toggleLocale: () => void;
};

/**
 * Persisted UI locale. Defaults to English.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
      toggleLocale: () =>
        set({ locale: get().locale === "en" ? "zh" : "en" }),
    }),
    { name: "xone-locale" },
  ),
);
