export const Color = {
  BLACK: 0x000000,
  WHITE: 0xffffff,
  RED: 0xff0000,
  PURPLE: 0xc04ce6,
  DARK_GREEN: 0x009804,
} as const;

export type Difficulty = 1 | 2 | 3;

export const Settings = {
  LEVEL_DIFFICULTY: 2 as Difficulty,
  LEVEL_DIFFICULTY_PREVIOUS: 2 as Difficulty,
  inGame: false,
  abstractMode: false,
  graphCountDown: false,
  isItACutScene: true,
  gameEnds: false,
  bgmVolumeDefault: 0.5,
  sfxVolumeDefault: 0.5,
  escPressed: false,
  playerVisible: false,
};

export type GraphType = 'displacement' | 'velocity';

export class PairObject<TTrigger = unknown, TTarget = unknown> {
  triggered = false;
  constructor(
    public trigger: TTrigger,
    public target: TTarget,
    public type: string = '',
  ) {}
}

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function aabbIntersection(a: AABB, b: AABB): AABB {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}
