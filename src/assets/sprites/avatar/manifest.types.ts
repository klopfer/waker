export type AvatarStateName =
  | 'idle-left'
  | 'idle-right'
  | 'walk-left'
  | 'walk-right'
  | 'run-left'
  | 'run-right'
  | 'jumpup-left'
  | 'jumpup-right'
  | 'jumpdown-left'
  | 'jumpdown-right';

export interface AvatarState {
  sheet: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
  flipHorizontal?: true;
}

export interface AvatarManifest {
  generatedAt: string;
  states: Record<AvatarStateName, AvatarState>;
}
