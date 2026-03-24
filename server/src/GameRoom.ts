import { RoomState, PlayerState, ProjectileData, Vec3, GAME_CONFIG, MAP_CONFIGS, THROWABLE_OBJECTS, getCharacterDef } from './types';

let messageIdCounter = 0;

export class GameRoom {
  state: RoomState;
  private turnTimer: NodeJS.Timeout | null = null;
  private onStateChange: (room: GameRoom) => void;
  private onTurnEnd: (room: GameRoom) => void;
  private onGameEnd: (room: GameRoom) => void;
  private onHit: (room: GameRoom, targetId: string, damage: number, knockback: Vec3) => void;

  constructor(
    id: string,
    name: string,
    mapId: string,
    callbacks: {
      onStateChange: (room: GameRoom) => void;
      onTurnEnd: (room: GameRoom) => void;
      onGameEnd: (room: GameRoom) => void;
      onHit: (room: GameRoom, targetId: string, damage: number, knockback: Vec3) => void;
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
    };

    this.state.players.set(id, player);
    this.state.turnOrder.push(id);
    this.onStateChange(this);
    return player;
  }

  removePlayer(id: string): boolean {
    const had = this.state.players.delete(id);
    this.state.turnOrder = this.state.turnOrder.filter(pid => pid !== id);

    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      this.state.currentTurnIndex = 0;
    }

    if (this.state.phase === 'playing') {
      const alive = this.getAlivePlayers();
      if (alive.length <= 1) {
        this.endGame(alive[0]?.id || null);
      }
    }

    if (this.state.players.size === 0) {
      this.cleanup();
    }

    this.onStateChange(this);
    return had;
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
    return true;
  }

  getCurrentTurnPlayer(): string | null {
    if (this.state.phase !== 'playing') return null;
    return this.state.turnOrder[this.state.currentTurnIndex] || null;
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
      damage: Math.round(10 * obj.damageMultiplier * getCharacterDef(player.characterId).power * (clampedSpeed / GAME_CONFIG.MAX_THROW_POWER)),
    };

    this.state.projectiles.push(projectile);
    this.advanceTurn();
    return projectile;
  }

  handleHit(targetId: string, projectile: ProjectileData): void {
    const target = this.state.players.get(targetId);
    if (!target || !target.isAlive) return;

    const damage = projectile.damage;
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

    this.onHit(this, targetId, damage, knockback);

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

  private advanceTurn(): void {
    this.clearTurnTimer();

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
