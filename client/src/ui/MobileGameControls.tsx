import { useCallback, useRef } from 'react';
import { getSocket } from '../socket';
import { useGameStore } from '../store';
import { mobileBridge, requestMobileJump, resetMobileMove, clearMobileAim } from '../game/mobileBridge';
import { computeThrowFromAimPull } from '../game/throwAim';

const JOY_MAX_RADIUS = 44;
const KNOB_SIZE = 52;

function VirtualJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);

  const setKnob = (dx: number, dy: number) => {
    const knob = knobRef.current;
    if (knob) {
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    const len = Math.hypot(dx, dy);
    const nx = len > 0.5 ? dx / len : 0;
    const nz = len > 0.5 ? dy / len : 0;
    mobileBridge.moveX = nx;
    mobileBridge.moveZ = nz;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = baseRef.current;
    if (!el) return;
    dragging.current = true;
    pointerId.current = e.pointerId;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_MAX_RADIUS) {
      dx = (dx / len) * JOY_MAX_RADIUS;
      dy = (dy / len) * JOY_MAX_RADIUS;
    }
    setKnob(dx, dy);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || e.pointerId !== pointerId.current) return;
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_MAX_RADIUS) {
      dx = (dx / len) * JOY_MAX_RADIUS;
      dy = (dy / len) * JOY_MAX_RADIUS;
    }
    setKnob(dx, dy);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    dragging.current = false;
    pointerId.current = null;
    resetMobileMove();
    const knob = knobRef.current;
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={baseRef}
      className="vj-base"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={(e) => {
        if (dragging.current) endDrag(e);
      }}
    >
      <div ref={knobRef} className="vj-knob" style={{ width: KNOB_SIZE, height: KNOB_SIZE }} />
    </div>
  );
}

function AimPad() {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);

  const updateAim = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    mobileBridge.aimDx = cx - clientX;
    mobileBridge.aimDy = cy - clientY;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = padRef.current;
    if (!el) return;
    dragging.current = true;
    pointerId.current = e.pointerId;
    mobileBridge.aimDragging = true;
    el.setPointerCapture(e.pointerId);
    updateAim(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || e.pointerId !== pointerId.current) return;
    updateAim(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    dragging.current = false;
    pointerId.current = null;
    const v = computeThrowFromAimPull(mobileBridge.aimDx, mobileBridge.aimDy);
    const objectType = useGameStore.getState().selectedObject;
    clearMobileAim();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (v) {
      getSocket().emit('game:throw', {
        objectType,
        velocity: v,
      });
    }
  };

  return (
    <div
      ref={padRef}
      className="aim-pad"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="aim-pad-cross" aria-hidden />
      <span className="aim-pad-hint">당겨서 조준 · 손 떼면 발사</span>
    </div>
  );
}

export function MobileGameControls() {
  const lastJumpAt = useRef(0);

  const onJump = (e: React.PointerEvent) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastJumpAt.current < 280) return;
    lastJumpAt.current = now;
    requestMobileJump();
  };

  return (
    <div className="mobile-game-controls">
      <VirtualJoystick />
      <button type="button" className="mobile-jump-btn" onPointerDown={onJump}>
        점프
      </button>
      <AimPad />
    </div>
  );
}
