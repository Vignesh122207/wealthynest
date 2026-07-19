"use client";

import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {getAssetTypeMeta, typeLabel} from "@/lib/netWorthTypeMeta";
import {ASSET_TYPES} from "@/lib/constants";
import {formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {Asset} from "../types/asset.types";

export function AssetRow({ asset, onEdit }: {
  asset:  Asset;
  onEdit: () => void;
}) {
  const { fmt } = useAmountFormatter();
  const meta = getAssetTypeMeta(asset.assetType);
  return (
    <button type="button" onClick={onEdit} aria-label={`Edit ${asset.name} asset`}
      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left">
      <PremiumIcon icon={meta.icon} hex={meta.hex} size="sm" className="w-10 h-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: meta.hex + "18", color: meta.hex }}>
            {typeLabel(ASSET_TYPES, asset.assetType)}
          </span>
          {asset.institution && <span className="text-xs text-muted-foreground/60">· {asset.institution}</span>}
          <span className="text-xs text-muted-foreground/60">· as of {formatDate(asset.asOfDate)}</span>
        </div>
        {asset.notes && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{asset.notes}</p>}
      </div>
      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0 min-w-[7rem] text-right">{fmt(asset.currentValue)}</p>
    </button>
  );
}
