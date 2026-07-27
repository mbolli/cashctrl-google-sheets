import { CashCtrl, localize, type Tax } from "@zweiundeins/cashctrl-ts-sdk";
import type { CashCtrlLang } from "@zweiundeins/cashctrl-ts-sdk";
import { Config } from "./config.ts";

let client: CashCtrl | null = null;

/**
 * The shared CashCtrl client.
 *
 * Built lazily because `Config.initialize()` may still be prompting for the
 * API key when this module is first imported.
 */
export function cc(): CashCtrl {
  if (!client) {
    client = new CashCtrl({
      organisation: Config.get("CASHCTRL_DOMAINID"),
      apiKey: Config.get("CASHCTRL_APIKEY"),
      lang: Config.get("LANGUAGE") as CashCtrlLang,
    });
  }
  return client;
}

/** Resolves a possibly-localized API field using the configured language. */
export function t(value: string | null | undefined): string {
  return localize(value, Config.get("LANGUAGE") as CashCtrlLang);
}

/**
 * The tax percentage in effect today.
 *
 * Prefers the API's own `currentPercentage`, falling back to walking `rates`
 * for the most recent one whose `dateValid` has passed.
 */
export function currentTaxPercentage(tax: Tax): number {
  if (typeof tax.currentPercentage === "number") return tax.currentPercentage;
  if (!tax.rates?.length) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const applicable = tax.rates
    .filter((r) => !r.dateValid || r.dateValid <= today)
    .sort((a, b) => (b.dateValid ?? "").localeCompare(a.dateValid ?? ""));
  return (applicable[0] ?? tax.rates[0]).percentage ?? 0;
}

/**
 * Whether CashCtrl treats this tax's `unitPrice` as gross or net.
 *
 * `calcType` lives on the tax's components, not on the tax itself; there is no
 * top-level `isGrossCalcType` field, despite an earlier version of this code
 * reading one. A tax with no components is treated as NET, which is what
 * CashCtrl defaults to.
 */
export function effectiveTaxCalcType(tax: Tax): "NET" | "GROSS" {
  return tax.components?.some((c) => c.calcType === "GROSS") ? "GROSS" : "NET";
}
