"use client";

import {useEffect, useState} from "react";
import {usePathname, useRouter, useSearchParams} from "next/navigation";

/**
 * Keeps a TabBar's active tab in sync with a "?tab=" URL param — reads it directly on the first
 * render (a lazy useState initializer) rather than defaulting to defaultTab and correcting via a
 * mount effect. The effect-driven version is a real, animated state change once React commits it,
 * so TabBar's sliding indicator visibly swept from the default tab across to the persisted one on
 * every load; reading it up front means the indicator is already in the right place on the first
 * paint. See wealthynest-web's Transactions page history for the bug this was pulled out of.
 *
 * The URL write-back itself must happen in a useEffect keyed on `tab`, NOT synchronously inside
 * setTab — an earlier version called router.replace directly from setTab, and after a hard
 * reload every replace after the first was silently swallowed (the tab's own React state still
 * updated fine — TabBar visibly switched — but the URL never moved again for the rest of the
 * session). Transactions' own hand-rolled tab-sync effect never had this problem, precisely
 * because it already used this effect-based shape rather than calling replace from the handler.
 */
export function useTabParam<T extends string>(validTabs: readonly T[], defaultTab: T, paramName = "tab") {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = useState<T>(() => {
    const param = searchParams.get(paramName);
    return (validTabs as readonly string[]).includes(param ?? "") ? (param as T) : defaultTab;
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // Deliberately just [tab] — searchParams/router/pathname aren't included so this only re-runs
    // when the tab itself changes, not as a side effect of the replace call it just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, paramName]);

  return [tab, setTab] as const;
}
