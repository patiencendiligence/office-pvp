import { io, Socket } from 'socket.io-client';
import { useGameStore } from './store';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    setupListeners(socket);
  }
  return socket;
}

function setupListeners(sock: Socket) {
  const store = useGameStore.getState;
  const set = useGameStore.setState;

  sock.on('welcome', (data) => {
    set({
      playerId: data.playerId,
      rooms: data.rooms,
      maps: data.maps,
      objects: data.objects,
      characters: data.characters,
      config: data.config,
    });

    if (data.globalChat) {
      set({ globalChat: data.globalChat });
    }

    const savedNick = store().nickname;
    if (savedNick) {
      sock.emit('player:setNickname', savedNick);
    } else {
      set({ nickname: data.nickname });
    }

    const savedChar = store().characterId;
    if (savedChar !== 'pigeon') {
      sock.emit('player:setCharacter', savedChar);
    }
  });

  sock.on('room:list', (rooms) => set({ rooms }));

  sock.on('player:nicknameSet', (nickname) => set({ nickname }));
  sock.on('player:characterSet', (charId) => set({ characterId: charId }));

  sock.on('room:joined', (data) => {
    set({
      currentRoom: data.room,
      roomChat: data.roomChat || [],
      screen: 'room',
    });
  });

  sock.on('room:state', (room) => {
    const curr = store().currentRoom;
    if (curr && curr.id === room.id) {
      set({ currentRoom: room });
    }
    const existing = store().rooms;
    set({ rooms: existing.map(r => r.id === room.id ? room : r) });
  });

  sock.on('room:left', () => {
    set({ currentRoom: null, roomChat: [], screen: 'lobby' });
  });

  sock.on('game:started', (room) => {
    set({ currentRoom: room, screen: 'game', winner: null, projectiles: [] });
  });

  sock.on('game:turnChanged', (data) => {
    const curr = store().currentRoom;
    if (curr) {
      set({
        currentRoom: {
          ...curr,
          currentTurnPlayer: data.currentTurnPlayer,
          turnTimeLeft: data.turnTimeLeft,
        },
      });
    }
  });

  sock.on('game:projectile', (proj) => {
    useGameStore.getState().addProjectile(proj);
  });

  sock.on('game:hit', (data) => {
    // handled by the 3D scene directly via subscription
  });

  sock.on('game:ended', (data) => {
    set({ winner: data });
    const pid = store().playerId;
    if (data.winnerId === pid) {
      const w = store().wins + 1;
      set({ wins: w });
      localStorage.setItem('office-pvp-wins', String(w));
    }
  });

  sock.on('game:restarted', (room) => {
    set({ currentRoom: room, screen: 'game', winner: null, projectiles: [] });
  });

  sock.on('chat:global', (msg) => {
    useGameStore.getState().addGlobalChat(msg);
  });

  sock.on('chat:room', (msg) => {
    useGameStore.getState().addRoomChat(msg);
  });

  sock.on('error', (msg) => {
    console.warn('Server error:', msg);
  });
}
