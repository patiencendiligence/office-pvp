import { RoomState, PlayerState, ProjectileData, Vec3, GAME_CONFIG, MAP_CONFIGS, THROWABLE_OBJECTS, CHARACTERS, getCharacterDef } from './types';
import {
  computeBaseProjectileDamage,
  computeFinalDamage,
  getHitFxFlags,
  type HitFxFlags,
} from './combat';

let botIdCounter = 0;

const BOT_NAMES = ['Bot Karen', 'Bot Steve', 'Bot Linda'];
const BOT_CHARACTERS = ['pigeon', 'duck', 'owl', 'chicken', 'parrot', 'seagull'];

export class GameRoom {
  state: RoomState;
  private turnTimer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private onStateChange: (room: GameRoom) => void;
  private onTurnEnd: (room: GameRoom) => void;
  private onGameEnd: (room: GameRoom) => void;
  private onHit: (room: GameRoom, targetId: string, damage: number, knockback: Vec3, fx: HitFxFlags) => void;
  private onBotThrow: (room: GameRoom, projectile: ProjectileData) => void;

  constructor(
    id: string,
    name: string,
    mapId: string,
    callbacks: {
      onStateChange: (room: GameRoom) => void;
      onTurnEnd: (room: GameRoom) => void;
      onGameEnd: (room: GameRoom) => void;
      onHit: (room: GameRoom, targetId: string, damage: number, knockback: Vec3, fx: HitFxFlags) => void;
      onBotThrow: (room: GameRoom, projectile: ProjectileData) => void;
    }
  ) {
    this.state = {
      id,
      name,
      mapId,
      players: new Map(),
      turnOrder: [],
      currentTurnIndex: 0,
      phase: 'waiting',
      maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      winnerId: null,
      projectiles: [],
      turnTimeLeft: GAME_CONFIG.TURN_DURATION,
    };
    this.onStateChange = callbacks.onStateChange;
    this.onTurnEnd = callbacks.onTurnEnd;
    this.onGameEnd = callbacks.onGameEnd;
    this.onHit = callbacks.onHit;
    this.onBotThrow = callbacks.onBotThrow;
  }

  addPlayer(id: string, nickname: string, characterId: string): PlayerState | null {
    if (this.state.players.size >= this.state.maxPlayers) return null;
    if (this.state.phase === 'playing') return null;

    const mapConfig = MAP_CONFIGS.find(m => m.id === this.state.mapId) || MAP_CONFIGS[0];
    const spawnIndex = this.state.players.size % mapConfig.spawnPoints.length;

    const charDef = getCharacterDef(characterId);
    const player: PlayerState = {
      id,
      nickname,
      characterId,
      hp: charDef.hp,
      maxHp: charDef.hp,
      position: { ...mapConfig.spawnPoints[spawnIndex] },
      score: 0,
      isAlive: true,
      isBot: false,
    };

    this.state.players.set(id, player);
    this.state.turnOrder.push(id);
    this.onStateChange(this);
    return player;
  }

  /** Waiting-room only: sync character when player changes selection in settings after joining. */
  setPlayerCharacter(playerId: string, characterId: string): boolean {
    if (this.state.phase !== 'waiting') return false;
    const p = this.state.players.get(playerId);
    if (!p || p.isBot) return false;
    const charDef = getCharacterDef(characterId);
    p.characterId = characterId;
    p.hp = charDef.hp;
    p.maxHp = charDef.hp;
    this.onStateChange(this);
    return true;
  }

  addBot(): PlayerState | null {
    if (this.state.players.size >= this.state.maxPlayers) return null;
    if (this.state.phase === 'playing') return null;

    const botId = `bot_${++botIdCounter}_${Date.now()}`;
    const botIndex = botIdCounter % BOT_NAMES.length;
    const charId = BOT_CHARACTERS[Math.floor(Math.random() * BOT_CHARACTERS.length)];

    const mapConfig = MAP_CONFIGS.find(m => m.id === this.state.mapId) || MAP_CONFIGS[0];
    const spawnIndex = this.state.players.size % mapConfig.spawnPoints.length;

    const charDef = getCharacterDef(charId);
    const player: PlayerState = {
      id: botId,
      nickname: BOT_NAMES[botIndex],
      characterId: charId,
      hp: charDef.hp,
      maxHp: charDef.hp,
      position: { ...mapConfig.spawnPoints[spawnIndex] },
      score: 0,
      isAlive: true,
      isBot: true,
    };

    this.state.players.set(botId, player);
    this.state.turnOrder.push(botId);
    this.onStateChange(this);
    return player;
  }

  removePlayer(id: string): boolean {
    if (!this.state.players.has(id)) return false;

    const oldCi = this.state.currentTurnIndex;
    const removeIdx = this.state.turnOrder.indexOf(id);
    const wasLeavingCurrentTurn = removeIdx !== -1 && removeIdx === oldCi;

    this.state.players.delete(id);
    this.state.turnOrder = this.state.turnOrder.filter((pid) => pid !== id);

    let newCi = oldCi;
    if (removeIdx !== -1) {
      if (removeIdx < oldCi) {
        newCi = oldCi - 1;
      } else if (removeIdx === oldCi) {
        if (oldCi >= this.state.turnOrder.length) {
          newCi = 0;
        } else {
          newCi = oldCi;
        }
      }
    }
    if (this.state.turnOrder.length > 0 && newCi >= this.state.turnOrder.length) {
      newCi = 0;
    }
    this.state.currentTurnIndex = newCi;

    let gameEnded = false;
    if (this.state.phase === 'playing') {
      const alive = this.getAlivePlayers();
      if (alive.length <= 1) {
        this.endGame(alive[0]?.id || null);
        gameEnded = true;
      } else if (wasLeavingCurrentTurn) {
        this.startTurnTimer();
        this.onTurnEnd(this);
      }
    }

    if (this.state.players.size === 0) {
      this.cleanup();
    }

    this.onStateChange(this);
    return true;
  }

  removeBots(): void {
    const botIds = Array.from(this.state.players.keys()).filter(id => id.startsWith('bot_'));
    for (const id of botIds) {
      this.state.players.delete(id);
      this.state.turnOrder = this.state.turnOrder.filter(pid => pid !== id);
    }
    this.onStateChange(this);
  }

  startGame(): boolean {
    if (this.state.players.size < GAME_CONFIG.MIN_PLAYERS) return false;
    if (this.state.phase !== 'waiting') return false;

    this.state.phase = 'playing';
    this.state.currentTurnIndex = 0;

    const shuffled = [...this.state.turnOrder].sort(() => Math.random() - 0.5);
    this.state.turnOrder = shuffled;

    this.startTurnTimer();
    this.onStateChange(this);

    this.checkBotTurn();
    return true;
  }

  getCurrentTurnPlayer(): string | null {
    if (this.state.phase !== 'playing') return null;
    return this.state.turnOrder[this.state.currentTurnIndex] || null;
  }

  isCurrentTurnBot(): boolean {
    const pid = this.getCurrentTurnPlayer();
    if (!pid) return false;
    const player = this.state.players.get(pid);
    return !!player?.isBot;
  }

  handleThrow(playerId: string, objectType: string, velocity: Vec3): ProjectileData | null {
    if (this.getCurrentTurnPlayer() !== playerId) return null;

    const player = this.state.players.get(playerId);
    if (!player || !player.isAlive) return null;

    const obj = THROWABLE_OBJECTS.find(o => o.id === objectType) || THROWABLE_OBJECTS[0];

    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    const clampedSpeed = Math.min(speed, GAME_CONFIG.MAX_THROW_POWER);
    const scale = speed > 0 ? clampedSpeed / speed : 0;

    const projectile: ProjectileData = {
      playerId,
      objectType: obj.id,
      position: { ...player.position, y: player.position.y + 1.5 },
      velocity: {
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale,
      },
      mass: obj.mass,
      damage: computeBaseProjectileDamage(player.characterId, obj.id, {
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale,
      }),
    };

    this.state.projectiles.push(projectile);
    this.advanceTurn();
    return projectile;
  }

  handleHit(targetId: string, projectile: ProjectileData): void {
    const target = this.state.players.get(targetId);
    if (!target || !target.isAlive) return;

    const attacker = this.state.players.get(projectile.playerId);
    if (!attacker) return;

    const baseDamage = projectile.damage;
    const damage = computeFinalDamage(
      baseDamage,
      attacker.characterId,
      target.characterId,
      projectile.objectType
    );
    const fx = getHitFxFlags(attacker.characterId, target.characterId, projectile.objectType);

    target.hp = Math.max(0, target.hp - damage);

    const speed = Math.sqrt(
      projectile.velocity.x ** 2 +
      projectile.velocity.y ** 2 +
      projectile.velocity.z ** 2
    );
    const knockback: Vec3 = {
      x: (projectile.velocity.x / (speed || 1)) * GAME_CONFIG.KNOCKBACK_MULTIPLIER * projectile.mass,
      y: Math.abs(projectile.velocity.y / (speed || 1)) * GAME_CONFIG.KNOCKBACK_MULTIPLIER + 2,
      z: (projectile.velocity.z / (speed || 1)) * GAME_CONFIG.KNOCKBACK_MULTIPLIER * projectile.mass,
    };

    this.onHit(this, targetId, damage, knockback, fx);

    if (target.hp <= 0) {
      target.isAlive = false;
      const alive = this.getAlivePlayers();
      if (alive.length <= 1) {
        this.endGame(alive[0]?.id || null);
      }
    }

    this.onStateChange(this);
  }

  handleFallDamage(playerId: string, fallDistance: number): void {
    const map = MAP_CONFIGS.find(m => m.id === this.state.mapId);
    if (!map?.hasFallDamage) return;

    const player = this.state.players.get(playerId);
    if (!player || !player.isAlive) return;

    if (fallDistance > Math.abs(GAME_CONFIG.FALL_DAMAGE_THRESHOLD)) {
      const damage = Math.round(fallDistance * GAME_CONFIG.FALL_DAMAGE_PER_UNIT);
      player.hp = Math.max(0, player.hp - damage);
      if (player.hp <= 0) {
        player.isAlive = false;
        const alive = this.getAlivePlayers();
        if (alive.length <= 1) {
          this.endGame(alive[0]?.id || null);
        }
      }
      this.onStateChange(this);
    }
  }

  updatePlayerPosition(playerId: string, position: Vec3): void {
    const player = this.state.players.get(playerId);
    if (player) {
      player.position = position;
    }
  }

  private checkBotTurn(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    if (this.state.phase !== 'playing') return;
    if (!this.isCurrentTurnBot()) return;

    const delay = 1000 + Math.random() * 1500;
    this.botTimer = setTimeout(() => {
      this.executeBotTurn();
    }, delay);
  }

  private executeBotTurn(): void {
    const botId = this.getCurrentTurnPlayer();
    if (!botId) return;

    const bot = this.state.players.get(botId);
    if (!bot || !bot.isAlive || !bot.isBot) return;

    const targets = this.getAlivePlayers().filter(p => p.id !== botId);
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];

    const dx = target.position.x - bot.position.x;
    const dz = target.position.z - bot.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const power = 10 + Math.random() * 15;
    const angle = Math.atan2(dz, dx);
    const spread = (Math.random() - 0.5) * 0.4;

    const velocity: Vec3 = {
      x: Math.cos(angle + spread) * power,
      y: 8 + Math.random() * 6 + dist * 0.3,
      z: Math.sin(angle + spread) * power,
    };

    const obj = THROWABLE_OBJECTS[Math.floor(Math.random() * THROWABLE_OBJECTS.length)];

    const projectile = this.handleThrow(botId, obj.id, velocity);
    if (projectile) {
      this.onBotThrow(this, projectile);
    }
  }

  private advanceTurn(): void {
    this.clearTurnTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    if (this.state.phase !== 'playing') return;

    const alivePlayers = this.getAlivePlayers();
    if (alivePlayers.length <= 1) return;

    let nextIndex = (this.state.currentTurnIndex + 1) % this.state.turnOrder.length;
    let attempts = 0;
    while (attempts < this.state.turnOrder.length) {
      const pid = this.state.turnOrder[nextIndex];
      const p = this.state.players.get(pid);
      if (p && p.isAlive) break;
      nextIndex = (nextIndex + 1) % this.state.turnOrder.length;
      attempts++;
    }

    this.state.currentTurnIndex = nextIndex;
    this.state.turnTimeLeft = GAME_CONFIG.TURN_DURATION;

    this.startTurnTimer();
    this.onTurnEnd(this);
    this.onStateChange(this);

    this.checkBotTurn();
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    this.state.turnTimeLeft = GAME_CONFIG.TURN_DURATION;

    this.turnTimer = setInterval(() => {
      this.state.turnTimeLeft--;
      if (this.state.turnTimeLeft <= 0) {
        this.advanceTurn();
      }
    }, 1000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private endGame(winnerId: string | null): void {
    this.state.phase = 'finished';
    this.state.winnerId = winnerId;
    this.clearTurnTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    if (winnerId) {
      const winner = this.state.players.get(winnerId);
      if (winner) winner.score++;
    }

    this.onGameEnd(this);
    this.onStateChange(this);
  }

  private getAlivePlayers(): PlayerState[] {
    return Array.from(this.state.players.values()).filter(p => p.isAlive);
  }

  cleanup(): void {
    this.clearTurnTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }

  reset(): void {
    this.cleanup();
    const mapConfig = MAP_CONFIGS.find(m => m.id === this.state.mapId) || MAP_CONFIGS[0];

    let i = 0;
    for (const [, player] of this.state.players) {
      const charDef = getCharacterDef(player.characterId);
      player.hp = charDef.hp;
      player.maxHp = charDef.hp;
      player.isAlive = true;
      player.position = { ...mapConfig.spawnPoints[i % mapConfig.spawnPoints.length] };
      i++;
    }

    this.state.phase = 'waiting';
    this.state.currentTurnIndex = 0;
    this.state.winnerId = null;
    this.state.projectiles = [];
    this.state.turnTimeLeft = GAME_CONFIG.TURN_DURATION;
    this.onStateChange(this);
  }

  serialize() {
    return {
      id: this.state.id,
      name: this.state.name,
      mapId: this.state.mapId,
      players: Object.fromEntries(this.state.players),
      turnOrder: this.state.turnOrder,
      currentTurnIndex: this.state.currentTurnIndex,
      currentTurnPlayer: this.getCurrentTurnPlayer(),
      phase: this.state.phase,
      maxPlayers: this.state.maxPlayers,
      playerCount: this.state.players.size,
      winnerId: this.state.winnerId,
      turnTimeLeft: this.state.turnTimeLeft,
    };
  }
}
