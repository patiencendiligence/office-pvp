import { create } from 'zustand';
import type { RoomData, ChatMessage, ThrowableObject, MapInfo, CharacterInfo, GameConfig, ProjectileData } from './types';

export type Screen = 'lobby' | 'room' | 'game';

interface GameStore {
  screen: Screen;
  setScreen: (s: Screen) => void;

  playerId: string | null;
  setPlayerId: (id: string) => void;

  nickname: string;
  setNickname: (n: string) => void;

  characterId: string;
  setCharacterId: (id: string) => void;

  wins: number;
  setWins: (w: number) => void;

  rooms: RoomData[];
  setRooms: (rooms: RoomData[]) => void;

  currentRoom: RoomData | null;
  setCurrentRoom: (room: RoomData | null) => void;

  globalChat: ChatMessage[];
  addGlobalChat: (msg: ChatMessage) => void;

  roomChat: ChatMessage[];
  addRoomChat: (msg: ChatMessage) => void;
  setRoomChat: (msgs: ChatMessage[]) => void;

  maps: MapInfo[];
  setMaps: (maps: MapInfo[]) => void;

  objects: ThrowableObject[];
  setObjects: (objects: ThrowableObject[]) => void;

  characters: CharacterInfo[];
  setCharacters: (chars: CharacterInfo[]) => void;

  config: GameConfig | null;
  setConfig: (cfg: GameConfig) => void;

  selectedObject: string;
  setSelectedObject: (id: string) => void;

  projectiles: ProjectileData[];
  addProjectile: (p: ProjectileData) => void;
  clearProjectiles: () => void;

  showSettings: boolean;
  setShowSettings: (s: boolean) => void;

  winner: { winnerId: string | null; players: Record<string, any> } | null;
  setWinner: (w: { winnerId: string | null; players: Record<string, any> } | null) => void;

  isAiming: boolean;
  setIsAiming: (a: boolean) => void;
  aimStart: { x: number; y: number } | null;
  setAimStart: (p: { x: number; y: number } | null) => void;
  aimCurrent: { x: number; y: number } | null;
  setAimCurrent: (p: { x: number; y: number } | null) => void;

  chatTab: 'global' | 'room';
  setChatTab: (tab: 'global' | 'room') => void;

  /** 일시적 타격 연출 (CRITICAL / 직급 유효 타격) */
  hitVisual: null | { kind: 'critical' | 'rank' };
  setHitVisual: (v: null | { kind: 'critical' | 'rank' }) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  screen: 'lobby',
  setScreen: (s) => set({ screen: s }),

  playerId: null,
  setPlayerId: (id) => set({ playerId: id }),

  nickname: localStorage.getItem('office-pvp-nickname') || '',
  setNickname: (n) => {
    localStorage.setItem('office-pvp-nickname', n);
    set({ nickname: n });
  },

  characterId: localStorage.getItem('office-pvp-character') || 'pigeon',
  setCharacterId: (id) => {
    localStorage.setItem('office-pvp-character', id);
    set({ characterId: id });
  },

  wins: parseInt(localStorage.getItem('office-pvp-wins') || '0', 10),
  setWins: (w) => {
    localStorage.setItem('office-pvp-wins', String(w));
    set({ wins: w });
  },

  rooms: [],
  setRooms: (rooms) => set({ rooms }),

  currentRoom: null,
  setCurrentRoom: (room) => set({ currentRoom: room }),

  globalChat: [],
  addGlobalChat: (msg) => set((s) => ({ globalChat: [...s.globalChat.slice(-99), msg] })),

  roomChat: [],
  addRoomChat: (msg) => set((s) => ({ roomChat: [...s.roomChat.slice(-99), msg] })),
  setRoomChat: (msgs) => set({ roomChat: msgs }),

  maps: [],
  setMaps: (maps) => set({ maps }),

  objects: [],
  setObjects: (objects) => set({ objects }),

  characters: [],
  setCharacters: (chars) => set({ characters: chars }),

  config: null,
  setConfig: (cfg) => set({ config: cfg }),

  selectedObject: 'mug',
  setSelectedObject: (id) => set({ selectedObject: id }),

  projectiles: [],
  addProjectile: (p) => set((s) => ({ projectiles: [...s.projectiles, p] })),
  clearProjectiles: () => set({ projectiles: [] }),

  showSettings: false,
  setShowSettings: (s) => set({ showSettings: s }),

  winner: null,
  setWinner: (w) => set({ winner: w }),

  isAiming: false,
  setIsAiming: (a) => set({ isAiming: a }),
  aimStart: null,
  setAimStart: (p) => set({ aimStart: p }),
  aimCurrent: null,
  setAimCurrent: (p) => set({ aimCurrent: p }),

  chatTab: 'global',
  setChatTab: (tab) => set({ chatTab: tab }),

  hitVisual: null,
  setHitVisual: (v) => set({ hitVisual: v }),
}));
