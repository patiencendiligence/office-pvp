import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom';
import { ChatMessage, Vec3, MAP_CONFIGS, THROWABLE_OBJECTS, CHARACTERS, GAME_CONFIG } from './types';
import { computeBaseProjectileDamage } from './combat';

const app = express();
app.use(cors());
const server = http.createServer(app);

// Render health checks need 2xx before static files exist; keep independent of client/dist.
app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = new Map<string, GameRoom>();
const playerRooms = new Map<string, string>();
const playerNicknames = new Map<string, string>();
const playerCharacters = new Map<string, string>();
const globalChatHistory: ChatMessage[] = [];
const roomChatHistories = new Map<string, ChatMessage[]>();

const MAX_CHAT_HISTORY = 100;
let msgId = 0;

function broadcastRoomList() {
  const list = Array.from(rooms.values()).map(r => r.serialize());
  io.emit('room:list', list);
}

function createRoom(name: string, mapId: string): GameRoom {
  const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const room = new GameRoom(id, name, mapId, {
    onStateChange: (r) => {
      io.to(r.state.id).emit('room:state', r.serialize());
      broadcastRoomList();
    },
    onTurnEnd: (r) => {
      io.to(r.state.id).emit('game:turnChanged', {
        currentTurnPlayer: r.getCurrentTurnPlayer(),
        turnTimeLeft: r.state.turnTimeLeft,
      });
    },
    onGameEnd: (r) => {
      io.to(r.state.id).emit('game:ended', {
        winnerId: r.state.winnerId,
        players: Object.fromEntries(r.state.players),
      });
    },
    onHit: (r, targetId, damage, knockback, fx) => {
      io.to(r.state.id).emit('game:hit', { targetId, damage, knockback, ...fx });
    },
    onBotThrow: (r, projectile) => {
      io.to(r.state.id).emit('game:projectile', projectile);
    },
  });

  rooms.set(id, room);
  roomChatHistories.set(id, []);
  broadcastRoomList();
  return room;
}

['Office Arena', 'Pantry Brawl'].forEach((name, i) => {
  createRoom(name, MAP_CONFIGS[i].id);
});

io.on('connection', (socket: Socket) => {
  const nickname = `Player_${socket.id.slice(0, 4)}`;
  playerNicknames.set(socket.id, nickname);
  playerCharacters.set(socket.id, 'pigeon');

  socket.emit('welcome', {
    playerId: socket.id,
    nickname,
    rooms: Array.from(rooms.values()).map(r => r.serialize()),
    maps: MAP_CONFIGS.map(m => ({ id: m.id, name: m.name })),
    objects: THROWABLE_OBJECTS,
    characters: CHARACTERS,
    globalChat: globalChatHistory.slice(-50),
    config: GAME_CONFIG,
  });

  broadcastRoomList();

  // ─── Nickname ────────────────────────────────────
  socket.on('player:setNickname', (name: string) => {
    const clean = name.trim().slice(0, 16) || nickname;
    playerNicknames.set(socket.id, clean);
    socket.emit('player:nicknameSet', clean);

    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      const player = room?.state.players.get(socket.id);
      if (player) {
        player.nickname = clean;
        io.to(roomId).emit('room:state', room!.serialize());
      }
    }
  });

  socket.on('player:setCharacter', (charId: string) => {
    const valid = CHARACTERS.find(c => c.id === charId);
    if (!valid) return;
    playerCharacters.set(socket.id, charId);
    socket.emit('player:characterSet', charId);

    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      rooms.get(roomId)?.setPlayerCharacter(socket.id, charId);
    }
  });

  // ─── Room ────────────────────────────────────────
  socket.on('room:create', (data: { name: string; mapId: string }) => {
    const mapExists = MAP_CONFIGS.find(m => m.id === data.mapId);
    if (!mapExists) return;
    const room = createRoom(data.name || 'New Room', data.mapId);
    socket.emit('room:created', room.serialize());
  });

  socket.on(
    'room:join',
    (payload: string | { roomId: string; characterId?: string }, legacyCharId?: string) => {
      let roomId: string;
      let clientCharId: string | undefined;

      if (typeof payload === 'string' && payload.length > 0) {
        roomId = payload;
        clientCharId = typeof legacyCharId === 'string' ? legacyCharId : undefined;
      } else if (payload && typeof payload === 'object' && typeof payload.roomId === 'string') {
        roomId = payload.roomId;
        clientCharId = payload.characterId;
      } else {
        return socket.emit('error', 'Invalid room join');
      }

      const room = rooms.get(roomId);
      if (!room) return socket.emit('error', 'Room not found');

      const existingRoom = playerRooms.get(socket.id);
      if (existingRoom) {
        const oldRoom = rooms.get(existingRoom);
        if (oldRoom) {
          socket.leave(existingRoom);
          oldRoom.removePlayer(socket.id);
        }
      }

      const nick = playerNicknames.get(socket.id) || nickname;
      let charId = playerCharacters.get(socket.id) || 'pigeon';
      if (typeof clientCharId === 'string') {
        const fromClient = CHARACTERS.find((c) => c.id === clientCharId);
        if (fromClient) {
          charId = fromClient.id;
          playerCharacters.set(socket.id, charId);
        }
      }
      const player = room.addPlayer(socket.id, nick, charId);

      if (!player) return socket.emit('error', 'Room is full or game in progress');

      playerRooms.set(socket.id, roomId);
      socket.join(roomId);

      const roomChat = roomChatHistories.get(roomId) || [];
      socket.emit('room:joined', {
        room: room.serialize(),
        roomChat: roomChat.slice(-50),
      });

      io.to(roomId).emit('room:state', room.serialize());
      broadcastRoomList();
    }
  );

  socket.on('room:leave', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room) {
      socket.leave(roomId);
      room.removePlayer(socket.id);
      room.removeBots();

      const humanCount = Array.from(room.state.players.values()).filter(p => !p.isBot).length;
      if (humanCount === 0) {
        room.cleanup();
        rooms.delete(roomId);
        roomChatHistories.delete(roomId);
      }
    }

    playerRooms.delete(socket.id);
    socket.emit('room:left');
    broadcastRoomList();
  });

  // ─── Game ────────────────────────────────────────
  socket.on('game:addBot', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const bot = room.addBot();
    if (bot) {
      io.to(roomId).emit('room:state', room.serialize());
      broadcastRoomList();
    } else {
      socket.emit('error', 'Cannot add bot (room full or game in progress)');
    }
  });

  socket.on('game:start', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.startGame()) {
      io.to(roomId).emit('game:started', room.serialize());
    } else {
      socket.emit('error', `Need at least ${GAME_CONFIG.MIN_PLAYERS} players`);
    }
  });

  socket.on('game:throw', (data: { objectType: string; velocity: Vec3 }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const projectile = room.handleThrow(socket.id, data.objectType, data.velocity);
    if (projectile) {
      io.to(roomId).emit('game:projectile', projectile);
    }
  });

  socket.on('game:hit', (data: { targetId: string; objectType: string; velocity: Vec3 }) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const attacker = room.state.players.get(socket.id);
    if (!attacker) return;

    const obj = THROWABLE_OBJECTS.find(o => o.id === data.objectType) || THROWABLE_OBJECTS[0];
    const baseDamage = computeBaseProjectileDamage(attacker.characterId, data.objectType, data.velocity);
    room.handleHit(data.targetId, {
      playerId: socket.id,
      objectType: data.objectType,
      position: { x: 0, y: 0, z: 0 },
      velocity: data.velocity,
      mass: obj.mass,
      damage: baseDamage,
    });
  });

  socket.on('game:playerPosition', (pos: Vec3) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.updatePlayerPosition(socket.id, pos);
    socket.to(roomId).emit('game:playerMoved', { playerId: socket.id, position: pos });
  });

  socket.on('game:restart', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.reset();
    io.to(roomId).emit('game:restarted', room.serialize());
  });

  // ─── Chat ────────────────────────────────────────
  socket.on('chat:global', (content: string) => {
    const msg: ChatMessage = {
      id: `msg_${++msgId}`,
      senderId: socket.id,
      senderNickname: playerNicknames.get(socket.id) || 'Anonymous',
      content: content.trim().slice(0, 200),
      timestamp: Date.now(),
      type: 'global',
    };
    globalChatHistory.push(msg);
    if (globalChatHistory.length > MAX_CHAT_HISTORY) globalChatHistory.shift();
    io.emit('chat:global', msg);
  });

  socket.on('chat:room', (content: string) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const msg: ChatMessage = {
      id: `msg_${++msgId}`,
      senderId: socket.id,
      senderNickname: playerNicknames.get(socket.id) || 'Anonymous',
      content: content.trim().slice(0, 200),
      timestamp: Date.now(),
      type: 'room',
      roomId,
    };

    const history = roomChatHistories.get(roomId);
    if (history) {
      history.push(msg);
      if (history.length > MAX_CHAT_HISTORY) history.shift();
    }
    io.to(roomId).emit('chat:room', msg);
  });

  // ─── Disconnect ──────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.removePlayer(socket.id);
        room.removeBots();

        const humanCount = Array.from(room.state.players.values()).filter(p => !p.isBot).length;
        if (humanCount === 0) {
          room.cleanup();
          rooms.delete(roomId);
          roomChatHistories.delete(roomId);
        }
      }
    }

    playerRooms.delete(socket.id);
    playerNicknames.delete(socket.id);
    playerCharacters.delete(socket.id);
    broadcastRoomList();
  });
});

// Production: same host serves Vite build + Socket.IO (Render / single URL).
const clientDist = path.join(__dirname, '../../client/dist');
if (!fs.existsSync(clientDist)) {
  console.warn(`[office-pvp] client dist not found at ${clientDist} — run client build before server.`);
}
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    // Avoid sending index.html for missing chunks (browser expects JS, gets HTML → MIME error).
    if (/\.(js|mjs|css|map|png|jpe?g|webp|svg|ico|woff2?)$/i.test(req.path)) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;
// Render and most PaaS require listening on all interfaces, not only localhost.
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Office PvP server listening on 0.0.0.0:${PORT}`);
});
