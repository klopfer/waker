import { Assets, Texture } from 'pixi.js';
import { Howl } from 'howler';
import manifestData from '../assets/manifest.json';
import type { CuratedAsset, CuratedManifest } from '../assets/manifest.types.js';

const MANIFEST = manifestData as CuratedManifest;

const ASSET_URLS = import.meta.glob<string>('../assets/**/*.{mp3,wav,ogg,png,jpg,jpeg,mp4,webm,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function resolveUrl(relativeUrl: string): string {
  const key = `../assets/${relativeUrl}`;
  const url = ASSET_URLS[key];
  if (!url) throw new Error(`asset URL not resolvable by Vite: ${relativeUrl} (key=${key})`);
  return url;
}

export class AssetLoader {
  private readonly textureCache = new Map<string, Promise<Texture>>();
  private readonly howlCache = new Map<string, Howl>();

  entry(embedName: string): CuratedAsset {
    const e = MANIFEST.byEmbedName[embedName];
    if (!e) throw new Error(`unknown asset embed: ${embedName}`);
    return e;
  }

  url(embedName: string): string {
    return resolveUrl(this.entry(embedName).url);
  }

  async image(embedName: string): Promise<Texture> {
    const e = this.entry(embedName);
    if (e.type !== 'image') throw new Error(`${embedName} is ${e.type}, not image`);
    let p = this.textureCache.get(embedName);
    if (!p) {
      p = Assets.load<Texture>(this.url(embedName));
      this.textureCache.set(embedName, p);
    }
    return p;
  }

  audio(embedName: string, opts: { loop?: boolean; volume?: number } = {}): Howl {
    const e = this.entry(embedName);
    if (e.type !== 'audio') throw new Error(`${embedName} is ${e.type}, not audio`);
    let h = this.howlCache.get(embedName);
    if (!h) {
      h = new Howl({
        src: [this.url(embedName)],
        loop: opts.loop ?? false,
        volume: opts.volume ?? 1,
      });
      this.howlCache.set(embedName, h);
    }
    return h;
  }

  videoUrl(embedName: string): string {
    const e = this.entry(embedName);
    if (e.type !== 'video') throw new Error(`${embedName} is ${e.type}, not video`);
    return this.url(embedName);
  }

  preloadImages(embedNames: readonly string[]): Promise<Texture[]> {
    return Promise.all(embedNames.map((n) => this.image(n)));
  }

  dispose(): void {
    for (const h of this.howlCache.values()) h.unload();
    this.howlCache.clear();
    this.textureCache.clear();
  }
}
