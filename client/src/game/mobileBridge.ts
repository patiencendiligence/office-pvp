/**
 * Mutable bridge read by GameScene (useFrame) and written by mobile HUD.
 * Avoids tight React↔R3F coupling for analog input.
 */
export const mobileBridge = {
  moveX: 0,
  moveZ: 0,
  jumpNonce: 0,
  aimDragging: false,
  /** Same semantics as desktop: pull vector = center − finger (screen px). */
  aimDx: 0,
  aimDy: 0,
};

export function requestMobileJump(): void {
  mobileBridge.jumpNonce += 1;
}

export function resetMobileMove(): void {
  mobileBridge.moveX = 0;
  mobileBridge.moveZ = 0;
}

export function clearMobileAim(): void {
  mobileBridge.aimDragging = false;
  mobileBridge.aimDx = 0;
  mobileBridge.aimDy = 0;
}
