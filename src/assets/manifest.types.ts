export type OutputType = 'audio' | 'image' | 'spritesheet' | 'sequence' | 'unknown' | 'dry-run';

export type ClassGuess = 'audio' | 'cutscene' | 'background' | 'sprite';

export interface ManifestEntry {
  source: string;
  classGuess: ClassGuess;
  outputs: string[];
  outputType: OutputType;
  embedName?: string;
}

export interface AssetManifest {
  generatedAt: string;
  sourceRoot: string;
  outputRoot: string;
  jpexsPath: string | null;
  entries: ManifestEntry[];
}
