import type { Vec3 } from '../types';

const MIN_DRAG_PX = 10;
const MAX_POWER = 30;

/** Shared by desktop pointer-up and mobile aim pad release. */
export function computeThrowFromAimPull(dx: number, dy: number): Vec3 | null {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < MIN_DRAG_PX) return null;
  const power = Math.min(dist / 15, MAX_POWER);
  const angle = Math.atan2(dy, dx);
  return {
    x: Math.cos(angle) * power,
    y: Math.abs(Math.sin(angle)) * power * 0.8 + 5,
    z: 0,
  };
}
