export type CuratedAssetType = 'audio' | 'image' | 'video' | 'unknown';

export interface CuratedAsset {
  url: string;
  type: CuratedAssetType;
  source: string;
  symbol: string | null;
}

export interface SkippedEntry {
  embedName: string;
  source: string;
  reason: string;
}

export interface CuratedManifest {
  generatedAt: string;
  counts: Partial<Record<CuratedAssetType, number>>;
  skipped: number;
  skippedDetails: SkippedEntry[];
  byEmbedName: Record<string, CuratedAsset>;
}
