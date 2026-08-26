import { useCallback, useEffect } from "react";
import {
  formatMessage,
  messages,
  type MessageKey,
} from "@/lib/i18n/messages";
import { useLocaleStore } from "@/stores/locale";

/**
 * Returns the active locale and a `t()` translator for UI copy.
 */
export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = messages[locale]["brand.name"] ?? messages.en["brand.name"];
  }, [locale]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      const template = messages[locale][key] ?? messages.en[key] ?? key;
      return formatMessage(template, vars);
    },
    [locale],
  );

  return { locale, setLocale, toggleLocale, t };
}
