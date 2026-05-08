import { Assets, Sprite, Texture } from 'pixi.js';
import { MovieClipShim, spriteFromSheet } from '../engine/MovieClipShim.js';
import avatarManifestData from '../assets/sprites/avatar/manifest.json';
import type {
  AvatarManifest,
  AvatarState,
  AvatarStateName,
} from '../assets/sprites/avatar/manifest.types.js';

const MANIFEST = avatarManifestData as AvatarManifest;

const SHEET_URLS = import.meta.glob<string>('../assets/sprites/avatar/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function resolveSheetUrl(rel: string): string {
  const key = `../assets/sprites/avatar/${rel}`;
  const url = SHEET_URLS[key];
  if (!url) throw new Error(`avatar sheet URL not resolvable: ${rel}`);
  return url;
}

const sheetCache = new Map<string, Promise<Texture>>();

function loadSheetTexture(sheetName: string): Promise<Texture> {
  let p = sheetCache.get(sheetName);
  if (!p) {
    p = (async () => {
      const tex = await Assets.load<Texture>(resolveSheetUrl(sheetName));
      // Disable bilinear filtering on the sheet's source. Without this, the
      // GPU samples the edges of adjacent frames when rendering a sub-texture,
      // bleeding ~1 px of the neighbor pose into the current frame — which
      // shows up as an occasional thin dark line at a frame's edge ("above
      // the tail" on the right-facing avatar, etc). Nearest-neighbor sampling
      // is also a better match for the original Flash bitmap-display look.
      tex.source.scaleMode = 'nearest';
      return tex;
    })();
    sheetCache.set(sheetName, p);
  }
  return p;
}

export interface LoadedAvatarState {
  state: AvatarStateName;
  sprite: Sprite;
  clip: MovieClipShim;
  meta: AvatarState;
}

export async function loadAvatarState(state: AvatarStateName): Promise<LoadedAvatarState> {
  const meta = MANIFEST.states[state];
  if (!meta) throw new Error(`unknown avatar state: ${state}`);
  const sheet = await loadSheetTexture(meta.sheet);
  const { sprite, clip } = spriteFromSheet(sheet, {
    cols: meta.cols,
    rows: meta.rows,
    frameWidth: meta.frameWidth,
    frameHeight: meta.frameHeight,
    frameCount: meta.frameCount,
  });
  return { state, sprite, clip, meta };
}

export async function preloadAvatarStates(
  states: readonly AvatarStateName[],
): Promise<Map<AvatarStateName, LoadedAvatarState>> {
  const out = new Map<AvatarStateName, LoadedAvatarState>();
  await Promise.all(
    states.map(async (s) => {
      out.set(s, await loadAvatarState(s));
    }),
  );
  return out;
}

export function listAvatarStates(): readonly AvatarStateName[] {
  return Object.keys(MANIFEST.states) as AvatarStateName[];
}
