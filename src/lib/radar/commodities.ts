// Metadata for the 6 scored commodities: display names + keywords used to
// match free-text news/calendar items to a commodity.

import type { CommodityTicker } from "@/lib/fetchers/yahoo";

export interface CommodityMeta {
  name: string;
  /** Lower-case keywords for matching news headlines / event names. */
  keywords: string[];
  /** Whether this is an industrial/growth-sensitive commodity (vs a haven). */
  industrial: boolean;
}

export const COMMODITY_META: Record<CommodityTicker, CommodityMeta> = {
  XAU: { name: "Gold", keywords: ["gold", "xau", "bullion"], industrial: false },
  XAG: { name: "Silver", keywords: ["silver", "xag"], industrial: false },
  XPT: { name: "Platinum", keywords: ["platinum", "xpt"], industrial: true },
  CL: {
    name: "WTI Crude",
    keywords: ["crude", "wti", "oil", "petroleum", "brent"],
    industrial: true,
  },
  NG: {
    name: "Natural Gas",
    keywords: ["natural gas", "natgas", "lng", "gas"],
    industrial: true,
  },
  HG: { name: "Copper", keywords: ["copper", "hg"], industrial: true },
};
