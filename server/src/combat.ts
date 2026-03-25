import { GAME_CONFIG, THROWABLE_OBJECTS, getCharacterDef } from './types';
import type { Vec3 } from './types';

/** 직급 (낮을수록 신입) — 공격자·방어자 비교로 데미지 배율 */
export const CHARACTER_RANK: Record<string, number> = {
  pigeon: 1,
  duck: 2,
  owl: 3,
  chicken: 4,
  parrot: 5,
  seagull: 6,
};

const RANK_LOWER_HITS_HIGHER = 1.3;
const RANK_HIGHER_HITS_LOWER = 0.8;

export function getRankMultiplier(attackerCharacterId: string, defenderCharacterId: string): number {
  const a = CHARACTER_RANK[attackerCharacterId] ?? 1;
  const d = CHARACTER_RANK[defenderCharacterId] ?? 1;
  const diff = d - a;
  if (diff > 0) return RANK_LOWER_HITS_HIGHER;
  if (diff < 0) return RANK_HIGHER_HITS_LOWER;
  return 1.0;
}

const ITEM_WEAK = 1.4;
const ITEM_RESIST = 0.7;

/** object id = THROWABLE_OBJECTS[].id (coffee → mug, desk → phone 등 게임 아이템 id) */
export const CHARACTER_ITEM_AFFINITY: Record<string, { weak: string[]; resist: string[] }> = {
  pigeon: { weak: ['mug'], resist: ['phone'] },
  duck: { weak: ['mug'], resist: ['keyboard'] },
  owl: { weak: ['monitor'], resist: ['chair'] },
  chicken: { weak: ['stapler'], resist: ['phone'] },
  parrot: { weak: ['keyboard'], resist: ['mug'] },
  seagull: { weak: ['chair'], resist: ['monitor'] },
};

export function getItemMultiplier(defenderCharacterId: string, objectType: string): number {
  const data = CHARACTER_ITEM_AFFINITY[defenderCharacterId];
  if (!data) return 1.0;
  if (data.weak.includes(objectType)) return ITEM_WEAK;
  if (data.resist.includes(objectType)) return ITEM_RESIST;
  return 1.0;
}

/** 투척 시 base 데미지 (상성 미적용) — handleThrow / 클라이언트 충돌 보고 공통 */
export function computeBaseProjectileDamage(
  attackerCharacterId: string,
  objectType: string,
  velocity: Vec3
): number {
  const obj = THROWABLE_OBJECTS.find((o) => o.id === objectType) || THROWABLE_OBJECTS[0];
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
  const clampedSpeed = Math.min(speed, GAME_CONFIG.MAX_THROW_POWER);
  const power = getCharacterDef(attackerCharacterId).power;
  return Math.round(
    10 * obj.damageMultiplier * power * (clampedSpeed / GAME_CONFIG.MAX_THROW_POWER)
  );
}

export function computeFinalDamage(
  baseDamage: number,
  attackerCharacterId: string,
  defenderCharacterId: string,
  objectType: string
): number {
  const rankM = getRankMultiplier(attackerCharacterId, defenderCharacterId);
  const itemM = getItemMultiplier(defenderCharacterId, objectType);
  return Math.max(1, Math.round(baseDamage * rankM * itemM));
}

export type HitFxFlags = {
  critical: boolean;
  resist: boolean;
  rankStrike: boolean;
};

export function getHitFxFlags(
  attackerCharacterId: string,
  defenderCharacterId: string,
  objectType: string
): HitFxFlags {
  const itemM = getItemMultiplier(defenderCharacterId, objectType);
  const rankM = getRankMultiplier(attackerCharacterId, defenderCharacterId);
  return {
    critical: itemM >= ITEM_WEAK - 0.01,
    resist: itemM <= ITEM_RESIST + 0.01,
    rankStrike: rankM >= RANK_LOWER_HITS_HIGHER - 0.01,
  };
}
