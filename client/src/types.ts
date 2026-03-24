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
  isBot: boolean;
}

export interface RoomData {
  id: string;
  name: string;
  mapId: string;
  players: Record<string, PlayerState>;
  turnOrder: string[];
  currentTurnIndex: number;
  currentTurnPlayer: string | null;
  phase: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  playerCount: number;
  winnerId: string | null;
  turnTimeLeft: number;
}

export interface ProjectileData {
  playerId: string;
  objectType: string;
  position: Vec3;
  velocity: Vec3;
  mass: number;
  damage: number;
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

export interface ThrowableObject {
  id: string;
  name: string;
  mass: number;
  damageMultiplier: number;
  modelType: string;
}

export interface MapInfo {
  id: string;
  name: string;
}

export interface CharacterInfo {
  id: string;
  name: string;
  nameKo: string;
  color: string;
  winsRequired: number;
  hp: number;
  power: number;
  spriteRow: number;
}

export interface GameConfig {
  MAX_HP: number;
  TURN_DURATION: number;
  MAX_THROW_POWER: number;
  KNOCKBACK_MULTIPLIER: number;
  FALL_DAMAGE_THRESHOLD: number;
  FALL_DAMAGE_PER_UNIT: number;
  MIN_PLAYERS: number;
  MAX_PLAYERS: number;
}
