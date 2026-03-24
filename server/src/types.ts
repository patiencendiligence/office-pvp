export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  nickname: string;
  characterId: string;
  hp: number;
  maxHp: number;
  position: Vec3;
  score: number;
  isAlive: boolean;
}

export interface ProjectileData {
  playerId: string;
  objectType: string;
  position: Vec3;
  velocity: Vec3;
  mass: number;
  damage: number;
}

export interface RoomState {
  id: string;
  name: string;
  mapId: string;
  players: Map<string, PlayerState>;
  turnOrder: string[];
  currentTurnIndex: number;
  phase: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  winnerId: string | null;
  projectiles: ProjectileData[];
  turnTimeLeft: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: number;
  type: 'global' | 'room';
  roomId?: string;
}

export type ThrowableObject = {
  id: string;
  name: string;
  mass: number;
  damageMultiplier: number;
  modelType: string;
};

export type MapConfig = {
  id: string;
  name: string;
  spawnPoints: Vec3[];
  platforms: { position: Vec3; size: Vec3; moving?: boolean }[];
  hasInteractive: boolean;
  hasFallDamage: boolean;
};

export const THROWABLE_OBJECTS: ThrowableObject[] = [
  { id: 'mug', name: 'Coffee Mug', mass: 0.5, damageMultiplier: 1.0, modelType: 'mug' },
  { id: 'keyboard', name: 'Keyboard', mass: 1.2, damageMultiplier: 1.5, modelType: 'keyboard' },
  { id: 'chair', name: 'Office Chair', mass: 8, damageMultiplier: 3.0, modelType: 'chair' },
  { id: 'monitor', name: 'Monitor', mass: 5, damageMultiplier: 2.5, modelType: 'monitor' },
  { id: 'stapler', name: 'Stapler', mass: 0.3, damageMultiplier: 0.8, modelType: 'stapler' },
  { id: 'phone', name: 'Desk Phone', mass: 0.8, damageMultiplier: 1.2, modelType: 'phone' },
];

export const MAP_CONFIGS: MapConfig[] = [
  {
    id: 'office',
    name: 'Office',
    spawnPoints: [
      { x: -6, y: 2, z: 0 },
      { x: 6, y: 2, z: 0 },
      { x: -3, y: 2, z: 4 },
      { x: 3, y: 2, z: -4 },
    ],
    platforms: [
      { position: { x: 0, y: 0, z: 0 }, size: { x: 20, y: 0.5, z: 12 } },
      { position: { x: -4, y: 2, z: 0 }, size: { x: 3, y: 0.3, z: 3 } },
      { position: { x: 4, y: 2, z: 0 }, size: { x: 3, y: 0.3, z: 3 } },
    ],
    hasInteractive: false,
    hasFallDamage: false,
  },
  {
    id: 'pantry',
    name: 'Pantry',
    spawnPoints: [
      { x: -5, y: 2, z: 0 },
      { x: 5, y: 2, z: 0 },
      { x: 0, y: 4, z: 3 },
      { x: 0, y: 4, z: -3 },
    ],
    platforms: [
      { position: { x: 0, y: 0, z: 0 }, size: { x: 16, y: 0.5, z: 10 } },
      { position: { x: 0, y: 3, z: 0 }, size: { x: 6, y: 0.3, z: 4 } },
      { position: { x: -6, y: 1.5, z: 3 }, size: { x: 2, y: 0.3, z: 2 } },
    ],
    hasInteractive: false,
    hasFallDamage: false,
  },
  {
    id: 'bus',
    name: 'Bus',
    spawnPoints: [
      { x: -4, y: 2, z: 0 },
      { x: 4, y: 2, z: 0 },
      { x: 0, y: 2, z: 2 },
      { x: 0, y: 2, z: -2 },
    ],
    platforms: [
      { position: { x: 0, y: 0, z: 0 }, size: { x: 14, y: 0.5, z: 6 } },
      { position: { x: -2, y: 1.5, z: 0 }, size: { x: 2, y: 0.3, z: 2 }, moving: true },
      { position: { x: 2, y: 2.5, z: 0 }, size: { x: 2, y: 0.3, z: 2 }, moving: true },
    ],
    hasInteractive: false,
    hasFallDamage: false,
  },
  {
    id: 'subway',
    name: 'Subway',
    spawnPoints: [
      { x: -5, y: 2, z: 0 },
      { x: 5, y: 2, z: 0 },
      { x: -2, y: 2, z: 3 },
      { x: 2, y: 2, z: -3 },
    ],
    platforms: [
      { position: { x: 0, y: 0, z: 0 }, size: { x: 18, y: 0.5, z: 10 } },
      { position: { x: -6, y: 0, z: 4 }, size: { x: 2, y: 3, z: 0.3 } },
      { position: { x: 6, y: 0, z: 4 }, size: { x: 2, y: 3, z: 0.3 } },
    ],
    hasInteractive: true,
    hasFallDamage: false,
  },
  {
    id: 'rooftop',
    name: 'Rooftop',
    spawnPoints: [
      { x: -4, y: 2, z: 0 },
      { x: 4, y: 2, z: 0 },
      { x: 0, y: 4, z: 3 },
      { x: 0, y: 2, z: -3 },
    ],
    platforms: [
      { position: { x: 0, y: 0, z: 0 }, size: { x: 14, y: 0.5, z: 10 } },
      { position: { x: -3, y: 3, z: 0 }, size: { x: 4, y: 0.3, z: 3 } },
      { position: { x: 4, y: 5, z: 2 }, size: { x: 3, y: 0.3, z: 2 } },
    ],
    hasInteractive: false,
    hasFallDamage: true,
  },
];

export interface CharacterDef {
  id: string;
  name: string;
  nameKo: string;
  color: string;
  winsRequired: number;
  hp: number;
  power: number;
  spriteCol: number; // column in the sprite sheet (0=left, 1=right)
  spriteRow: number; // row in the sprite sheet (0-2)
}

export const CHARACTERS: CharacterDef[] = [
  { id: 'pigeon',  name: 'Pigeon Newbie',     nameKo: '비둘기 신입',   color: '#8e9aaf', winsRequired: 0,  hp: 80,  power: 1.0, spriteCol: 0, spriteRow: 0 },
  { id: 'duck',    name: 'Duck Deputy',       nameKo: '오리 대리',     color: '#4a7c3f', winsRequired: 1,  hp: 90,  power: 1.5, spriteCol: 0, spriteRow: 1 },
  { id: 'owl',     name: 'Owl Team Leader',   nameKo: '부엉이 팀장',   color: '#8B6914', winsRequired: 3,  hp: 100, power: 1.5, spriteCol: 0, spriteRow: 2 },
  { id: 'chicken', name: 'Chicken Manager',   nameKo: '닭 부장',       color: '#cc3333', winsRequired: 9,  hp: 110, power: 1.2, spriteCol: 1, spriteRow: 0 },
  { id: 'parrot',  name: 'Parrot Director',   nameKo: '앵무새 차장',   color: '#e07020', winsRequired: 18, hp: 120, power: 1.1, spriteCol: 1, spriteRow: 1 },
  { id: 'seagull', name: 'Seagull Director',  nameKo: '갈매기 이사',   color: '#f0f0f0', winsRequired: 36, hp: 140, power: 1.3, spriteCol: 1, spriteRow: 2 },
];

export function getCharacterDef(id: string): CharacterDef {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

export const GAME_CONFIG = {
  MAX_HP: 100, // base, overridden by character HP
  TURN_DURATION: 15,
  MAX_THROW_POWER: 30,
  KNOCKBACK_MULTIPLIER: 2.0,
  FALL_DAMAGE_THRESHOLD: -5,
  FALL_DAMAGE_PER_UNIT: 10,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
};
