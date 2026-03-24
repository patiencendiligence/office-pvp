import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore } from '../store';
import { getSocket } from '../socket';
import {
  initPhysics,
  stepPhysics,
  addBody,
  removeBody,
  createPlatformBody,
  createPlayerBody,
  createProjectileBody,
  resetPhysics,
  getWorld,
  getBody,
} from './physics';
import { keysPressed } from './inputKeys';
import type { ProjectileData, Vec3 } from '../types';

const MAP_PLATFORMS: Record<string, Array<{ position: Vec3; size: Vec3; color: string; moving?: boolean }>> = {
  office: [
    { position: { x: 0, y: -0.25, z: 0 }, size: { x: 20, y: 0.5, z: 12 }, color: '#3a3d4a' },
    { position: { x: -4, y: 2, z: 0 }, size: { x: 3, y: 0.3, z: 3 }, color: '#5a5d6a' },
    { position: { x: 4, y: 2, z: 0 }, size: { x: 3, y: 0.3, z: 3 }, color: '#5a5d6a' },
  ],
  pantry: [
    { position: { x: 0, y: -0.25, z: 0 }, size: { x: 16, y: 0.5, z: 10 }, color: '#4a3d2a' },
    { position: { x: 0, y: 3, z: 0 }, size: { x: 6, y: 0.3, z: 4 }, color: '#6a5d4a' },
    { position: { x: -6, y: 1.5, z: 3 }, size: { x: 2, y: 0.3, z: 2 }, color: '#6a5d4a' },
  ],
  bus: [
    { position: { x: 0, y: -0.25, z: 0 }, size: { x: 14, y: 0.5, z: 6 }, color: '#2a3d5a' },
    { position: { x: -2, y: 1.5, z: 0 }, size: { x: 2, y: 0.3, z: 2 }, color: '#4a5d7a', moving: true },
    { position: { x: 2, y: 2.5, z: 0 }, size: { x: 2, y: 0.3, z: 2 }, color: '#4a5d7a', moving: true },
  ],
  subway: [
    { position: { x: 0, y: -0.25, z: 0 }, size: { x: 18, y: 0.5, z: 10 }, color: '#3a3a4a' },
    { position: { x: -6, y: 1.5, z: 4 }, size: { x: 2, y: 3, z: 0.3 }, color: '#6a6a7a' },
    { position: { x: 6, y: 1.5, z: 4 }, size: { x: 2, y: 3, z: 0.3 }, color: '#6a6a7a' },
  ],
  rooftop: [
    { position: { x: 0, y: -0.25, z: 0 }, size: { x: 14, y: 0.5, z: 10 }, color: '#4a4a3a' },
    { position: { x: -3, y: 3, z: 0 }, size: { x: 4, y: 0.3, z: 3 }, color: '#6a6a5a' },
    { position: { x: 4, y: 5, z: 2 }, size: { x: 3, y: 0.3, z: 2 }, color: '#6a6a5a' },
  ],
};

const CHAR_COLORS: Record<string, string> = {
  pigeon: '#8e9aaf',
  duck: '#4a7c3f',
  owl: '#8B6914',
  chicken: '#cc3333',
  parrot: '#e07020',
  seagull: '#f0f0f0',
};

/** characters.png: 4 columns = left, right, back(상), front(하); 6 rows = one per character */
const SPRITE_SHEET_COLS = 4;
const SPRITE_SHEET_ROWS = 6;

type CardinalFacing = 'left' | 'right' | 'back' | 'front';

const DIR_COL: Record<CardinalFacing, number> = {
  left: 0,
  right: 1,
  back: 2,
  front: 3,
};

const CHARACTER_SHEET_ROW: Record<string, number> = {
  pigeon: 0,
  duck: 1,
  owl: 2,
  chicken: 3,
  parrot: 4,
  seagull: 5,
};

function applySpriteFrameUV(tex: THREE.Texture, spriteRow: number, facing: CardinalFacing) {
  const frameW = 1 / SPRITE_SHEET_COLS;
  const frameH = 1 / SPRITE_SHEET_ROWS;
  const dirCol = DIR_COL[facing];
  tex.repeat.set(frameW * 0.23, frameH * 0.9);
  tex.offset.set(
    dirCol * frameW + frameW * 0.05,
    1 - (spriteRow + 1) * frameH + frameH * 0.05
  );
  tex.needsUpdate = true;
}

function computeFacing(
  playerId: string,
  localPlayerId: string | undefined,
  body: CANNON.Body,
  lastPos: { x: number; z: number },
  lastFacing: CardinalFacing
): CardinalFacing {
  const isLocal = localPlayerId === playerId;

  if (isLocal) {
    let fx = 0;
    let fz = 0;
    if (keysPressed.has('a') || keysPressed.has('arrowleft')) fx -= 1;
    if (keysPressed.has('d') || keysPressed.has('arrowright')) fx += 1;
    if (keysPressed.has('w') || keysPressed.has('arrowup')) fz -= 1;
    if (keysPressed.has('s') || keysPressed.has('arrowdown')) fz += 1;
    if (fx !== 0 || fz !== 0) {
      if (Math.abs(fx) >= Math.abs(fz)) {
        return fx < 0 ? 'left' : 'right';
      }
      return fz < 0 ? 'back' : 'front';
    }
  }

  const vx = body.velocity.x;
  const vz = body.velocity.z;
  const speed = Math.sqrt(vx * vx + vz * vz);
  if (speed > 0.2) {
    if (Math.abs(vx) >= Math.abs(vz)) {
      return vx < 0 ? 'left' : 'right';
    }
    return vz < 0 ? 'back' : 'front';
  }

  const dx = body.position.x - lastPos.x;
  const dz = body.position.z - lastPos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > 0.008) {
    if (Math.abs(dx) >= Math.abs(dz)) {
      return dx < 0 ? 'left' : 'right';
    }
    return dz < 0 ? 'back' : 'front';
  }

  return lastFacing;
}

const OBJ_COLORS: Record<string, string> = {
  mug: '#8B4513',
  keyboard: '#333333',
  chair: '#666666',
  monitor: '#1a1a2e',
  stapler: '#cc0000',
  phone: '#2c3e50',
};

interface ActiveProjectile {
  id: string;
  data: ProjectileData;
  meshRef: THREE.Mesh | null;
  bodyId: string;
  age: number;
}

export function GameScene() {
  const currentRoom = useGameStore((s) => s.currentRoom);
  const playerId = useGameStore((s) => s.playerId);
  const projectiles = useGameStore((s) => s.projectiles);
  const clearProjectiles = useGameStore((s) => s.clearProjectiles);
  const selectedObject = useGameStore((s) => s.selectedObject);
  const { camera, gl } = useThree();

  const playerMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const playerBodies = useRef<Map<string, string>>(new Map());
  const activeProjectiles = useRef<ActiveProjectile[]>([]);
  const projectileMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const particlesRef = useRef<THREE.Points | null>(null);
  const particlePositions = useRef<Float32Array>(new Float32Array(300));
  const particleVelocities = useRef<Float32Array>(new Float32Array(300));
  const particleLifetimes = useRef<Float32Array>(new Float32Array(100));
  const movingPlatforms = useRef<Array<{ mesh: THREE.Mesh; body: CANNON.Body; baseX: number; time: number }>>(
    []
  );
  const initialized = useRef(false);
  const aimState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }>({ active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const aimLineRef = useRef<THREE.Line | null>(null);
  const orbitRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const projIdCounter = useRef(0);
  const positionSyncTimer = useRef(0);

  const mapId = currentRoom?.mapId || 'office';

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.add(key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Expose mobile dpad control
  const applyMobileMove = useCallback((dir: string, pressed: boolean) => {
    if (pressed) {
      keysPressed.add(dir);
    } else {
      keysPressed.delete(dir);
    }
  }, []);

  // Store applyMobileMove on window for the HUD to call
  useEffect(() => {
    (window as any).__applyMobileMove = applyMobileMove;
    return () => { delete (window as any).__applyMobileMove; };
  }, [applyMobileMove]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    resetPhysics();
    initPhysics();

    const platforms = MAP_PLATFORMS[mapId] || MAP_PLATFORMS.office;
    platforms.forEach((plat, i) => {
      const body = createPlatformBody(plat.position, plat.size);
      addBody(`platform_${i}`, body);
    });

    if (currentRoom) {
      const players = Object.values(currentRoom.players);
      players.forEach((p) => {
        const body = createPlayerBody(p.position);
        const bodyId = `player_${p.id}`;
        addBody(bodyId, body);
        playerBodies.current.set(p.id, bodyId);
      });
    }

    return () => {
      resetPhysics();
      initialized.current = false;
    };
  }, []);

  useEffect(() => {
    const sock = getSocket();
    const hitHandler = (data: { targetId: string; damage: number; knockback: Vec3 }) => {
      const bodyId = playerBodies.current.get(data.targetId);
      if (bodyId) {
        const body = getBody(bodyId);
        if (body) {
          body.applyImpulse(
            new CANNON.Vec3(data.knockback.x, data.knockback.y, data.knockback.z)
          );
        }
      }
      spawnParticles(data.targetId);
    };

    const moveHandler = (data: { playerId: string; position: Vec3 }) => {
      if (data.playerId === useGameStore.getState().playerId) return;
      const bodyId = playerBodies.current.get(data.playerId);
      if (bodyId) {
        const body = getBody(bodyId);
        if (body) {
          body.position.set(data.position.x, data.position.y, data.position.z);
          body.velocity.set(0, 0, 0);
        }
      }
    };

    sock.on('game:hit', hitHandler);
    sock.on('game:playerMoved', moveHandler);
    return () => {
      sock.off('game:hit', hitHandler);
      sock.off('game:playerMoved', moveHandler);
    };
  }, []);

  useEffect(() => {
    if (projectiles.length > 0) {
      projectiles.forEach((proj) => {
        const id = `proj_${++projIdCounter.current}`;
        const body = createProjectileBody(proj.position, proj.velocity, proj.mass);
        addBody(id, body);

        body.addEventListener('collide', (e: any) => {
          for (const [pid, bodyId] of playerBodies.current) {
            if (pid !== proj.playerId && getBody(bodyId) === e.body) {
              getSocket().emit('game:hit', {
                targetId: pid,
                objectType: proj.objectType,
                velocity: proj.velocity,
              });
              break;
            }
          }
        });

        activeProjectiles.current.push({
          id,
          data: proj,
          meshRef: null,
          bodyId: id,
          age: 0,
        });
      });
      clearProjectiles();
    }
  }, [projectiles, clearProjectiles]);

  const spawnParticles = useCallback((targetId: string) => {
    const bodyId = playerBodies.current.get(targetId);
    if (!bodyId) return;
    const body = getBody(bodyId);
    if (!body) return;

    for (let i = 0; i < 100; i++) {
      const idx = i * 3;
      particlePositions.current[idx] = body.position.x;
      particlePositions.current[idx + 1] = body.position.y + 1;
      particlePositions.current[idx + 2] = body.position.z;
      particleVelocities.current[idx] = (Math.random() - 0.5) * 8;
      particleVelocities.current[idx + 1] = Math.random() * 6 + 2;
      particleVelocities.current[idx + 2] = (Math.random() - 0.5) * 8;
      particleLifetimes.current[i] = 1.0;
    }

    if (particlesRef.current) {
      const geo = particlesRef.current.geometry;
      geo.setAttribute('position', new THREE.BufferAttribute(particlePositions.current.slice(), 3));
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: THREE.Event) => {
      if (!currentRoom || currentRoom.currentTurnPlayer !== playerId) return;
      if (currentRoom.phase !== 'playing') return;

      const event = (e as any).nativeEvent || e;
      aimState.current = {
        active: true,
        startX: event.clientX ?? event.touches?.[0]?.clientX ?? 0,
        startY: event.clientY ?? event.touches?.[0]?.clientY ?? 0,
        currentX: event.clientX ?? event.touches?.[0]?.clientX ?? 0,
        currentY: event.clientY ?? event.touches?.[0]?.clientY ?? 0,
      };

      if (orbitRef.current) {
        orbitRef.current.enabled = false;
      }
    },
    [currentRoom, playerId]
  );

  const handlePointerMove = useCallback((e: THREE.Event) => {
    if (!aimState.current.active) return;
    const event = (e as any).nativeEvent || e;
    aimState.current.currentX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    aimState.current.currentY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!aimState.current.active) return;
    aimState.current.active = false;

    if (orbitRef.current) {
      orbitRef.current.enabled = true;
    }

    const dx = aimState.current.startX - aimState.current.currentX;
    const dy = aimState.current.startY - aimState.current.currentY;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return;

    const power = Math.min(dist / 15, 30);
    const angle = Math.atan2(dy, dx);

    const velocity: Vec3 = {
      x: Math.cos(angle) * power,
      y: Math.abs(Math.sin(angle)) * power * 0.8 + 5,
      z: 0,
    };

    getSocket().emit('game:throw', {
      objectType: selectedObject,
      velocity,
    });

    if (aimLineRef.current && sceneRef.current) {
      sceneRef.current.remove(aimLineRef.current);
      aimLineRef.current = null;
    }
  }, [selectedObject]);

  useFrame((state, delta) => {
    sceneRef.current = state.scene;
    stepPhysics(delta);

    // Player movement
    const isMyTurnNow = currentRoom?.phase === 'playing' && currentRoom?.currentTurnPlayer === playerId;
    if (isMyTurnNow && playerId) {
      const bodyId = playerBodies.current.get(playerId);
      if (bodyId) {
        const body = getBody(bodyId);
        if (body) {
          const MOVE_FORCE = 40;
          const keys = keysPressed;
          let fx = 0, fz = 0;
          if (keys.has('a') || keys.has('arrowleft')) fx -= MOVE_FORCE;
          if (keys.has('d') || keys.has('arrowright')) fx += MOVE_FORCE;
          if (keys.has('w') || keys.has('arrowup')) fz -= MOVE_FORCE;
          if (keys.has('s') || keys.has('arrowdown')) fz += MOVE_FORCE;

          if (fx !== 0 || fz !== 0) {
            body.applyForce(new CANNON.Vec3(fx, 0, fz));
          }

          const maxSpeed = 6;
          const vx = body.velocity.x;
          const vz = body.velocity.z;
          const speed = Math.sqrt(vx * vx + vz * vz);
          if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            body.velocity.x *= scale;
            body.velocity.z *= scale;
          }
        }
      }

      positionSyncTimer.current += delta;
      if (positionSyncTimer.current > 0.1) {
        positionSyncTimer.current = 0;
        const bodyId2 = playerBodies.current.get(playerId);
        if (bodyId2) {
          const body2 = getBody(bodyId2);
          if (body2) {
            getSocket().emit('game:playerPosition', {
              x: body2.position.x,
              y: body2.position.y,
              z: body2.position.z,
            });
          }
        }
      }
    }

    if (currentRoom) {
      const players = Object.values(currentRoom.players);
      players.forEach((p) => {
        const bodyId = playerBodies.current.get(p.id);
        if (!bodyId) return;
        const body = getBody(bodyId);
        if (!body) return;

        const group = playerMeshes.current.get(p.id);
        if (group) {
          group.position.set(body.position.x, body.position.y, body.position.z);

          if (body.position.y < -10) {
            body.position.set(p.position.x, p.position.y + 5, p.position.z);
            body.velocity.set(0, 0, 0);
          }
        }
      });
    }

    activeProjectiles.current.forEach((proj) => {
      const body = getBody(proj.bodyId);
      const mesh = projectileMeshes.current.get(proj.id);
      if (body && mesh) {
        mesh.position.set(body.position.x, body.position.y, body.position.z);
        mesh.rotation.x += delta * 5;
        mesh.rotation.z += delta * 3;
      }
      proj.age += delta;
    });

    const toRemove = activeProjectiles.current.filter((p) => p.age > 5);
    toRemove.forEach((p) => {
      removeBody(p.bodyId);
      projectileMeshes.current.delete(p.id);
    });
    activeProjectiles.current = activeProjectiles.current.filter((p) => p.age <= 5);

    if (particlesRef.current) {
      const geo = particlesRef.current.geometry;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      if (posAttr) {
        const positions = posAttr.array as Float32Array;
        let anyAlive = false;
        for (let i = 0; i < 100; i++) {
          if (particleLifetimes.current[i] <= 0) continue;
          anyAlive = true;
          particleLifetimes.current[i] -= delta;
          const idx = i * 3;
          positions[idx] += particleVelocities.current[idx] * delta;
          positions[idx + 1] += particleVelocities.current[idx + 1] * delta;
          particleVelocities.current[idx + 1] -= 9.8 * delta;
          positions[idx + 2] += particleVelocities.current[idx + 2] * delta;
        }
        if (anyAlive) posAttr.needsUpdate = true;
      }
    }

    movingPlatforms.current.forEach((mp) => {
      mp.time += delta;
      const newX = mp.baseX + Math.sin(mp.time * 0.8) * 3;
      mp.mesh.position.x = newX;
      mp.body.position.x = newX;
    });

    if (aimState.current.active && sceneRef.current) {
      const dx = aimState.current.startX - aimState.current.currentX;
      const dy = aimState.current.startY - aimState.current.currentY;
      const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 15, 30);
      const angle = Math.atan2(dy, dx);

      if (playerId && currentRoom) {
        const bodyId = playerBodies.current.get(playerId);
        if (bodyId) {
          const body = getBody(bodyId);
          if (body) {
            const points: THREE.Vector3[] = [];
            const vx = Math.cos(angle) * power;
            const vy = Math.abs(Math.sin(angle)) * power * 0.8 + 5;

            for (let t = 0; t < 2; t += 0.05) {
              points.push(
                new THREE.Vector3(
                  body.position.x + vx * t,
                  body.position.y + 1.5 + vy * t - 0.5 * 9.82 * t * t,
                  body.position.z
                )
              );
            }

            if (aimLineRef.current) {
              sceneRef.current.remove(aimLineRef.current);
            }

            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({
              color: 0x6c63ff,
              linewidth: 2,
              transparent: true,
              opacity: 0.6,
            });
            aimLineRef.current = new THREE.Line(lineGeo, lineMat);
            sceneRef.current.add(aimLineRef.current);
          }
        }
      }
    } else if (aimLineRef.current && sceneRef.current) {
      sceneRef.current.remove(aimLineRef.current);
      aimLineRef.current = null;
    }
  });

  const platforms = MAP_PLATFORMS[mapId] || MAP_PLATFORMS.office;
  const players = currentRoom ? Object.values(currentRoom.players) : [];

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <hemisphereLight args={['#b1e1ff', '#40302a', 0.3]} />

      <fog attach="fog" args={['#0a0a15', 20, 60]} />

      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={8}
        maxDistance={30}
        target={[0, 2, 0]}
      />

      {/* Platforms */}
      {platforms.map((plat, i) => (
        <mesh
          key={`plat_${i}`}
          position={[plat.position.x, plat.position.y, plat.position.z]}
          castShadow
          receiveShadow
          ref={(mesh) => {
            if (mesh && plat.moving) {
              const bodyId = `platform_${i}`;
              const body = getBody(bodyId);
              if (body) {
                movingPlatforms.current.push({
                  mesh,
                  body,
                  baseX: plat.position.x,
                  time: 0,
                });
              }
            }
          }}
        >
          <boxGeometry args={[plat.size.x, plat.size.y, plat.size.z]} />
          <meshStandardMaterial color={plat.color} roughness={0.8} />
        </mesh>
      ))}

      {/* Grid */}
      <gridHelper args={[40, 40, '#1a1a2e', '#1a1a2e']} position={[0, -0.49, 0]} />

      {/* Players */}
      {players.map((p) => (
        <CharacterSprite
          key={p.id}
          player={p}
          isCurrentTurn={currentRoom?.currentTurnPlayer === p.id}
          onGroupRef={(g) => {
            if (g) playerMeshes.current.set(p.id, g);
          }}
        />
      ))}

      {/* Projectiles */}
      {activeProjectiles.current.map((proj) => (
        <mesh
          key={proj.id}
          ref={(mesh) => {
            if (mesh) projectileMeshes.current.set(proj.id, mesh);
          }}
          position={[proj.data.position.x, proj.data.position.y, proj.data.position.z]}
          castShadow
        >
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial
            color={OBJ_COLORS[proj.data.objectType] || '#888'}
            emissive={OBJ_COLORS[proj.data.objectType] || '#888'}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}

      {/* Hit particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={100}
            array={particlePositions.current}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.15} color="#ffaa00" transparent opacity={0.8} sizeAttenuation />
      </points>

      {/* Invisible interaction plane for aiming */}
      <mesh
        visible={false}
        position={[0, 5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Decorative office props */}
      <OfficeDecorations mapId={mapId} />
    </>
  );
}

function CharacterSprite({
  player,
  isCurrentTurn,
  onGroupRef,
}: {
  player: { id: string; nickname: string; characterId: string; position: { x: number; y: number; z: number }; isAlive: boolean };
  isCurrentTurn: boolean;
  onGroupRef: (g: THREE.Group | null) => void;
}) {
  const baseTexture = useLoader(THREE.TextureLoader, '/characters.png');
  const texture = useMemo(() => {
    const tex = baseTexture.clone();
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    const row = CHARACTER_SHEET_ROW[player.characterId] ?? 0;
    applySpriteFrameUV(tex, row, 'front');
    return tex;
  }, [baseTexture, player.characterId]);

  const lastFacingRef = useRef<CardinalFacing>('front');
  const lastPosRef = useRef({ x: player.position.x, z: player.position.z });

  useEffect(() => {
    lastFacingRef.current = 'front';
    lastPosRef.current = { x: player.position.x, z: player.position.z };
  }, [player.id]);

  useFrame(() => {
    const body = getBody(`player_${player.id}`);
    if (!body) return;
    const localId = useGameStore.getState().playerId ?? undefined;
    const row = CHARACTER_SHEET_ROW[player.characterId] ?? 0;
    const facing = computeFacing(player.id, localId, body, lastPosRef.current, lastFacingRef.current);
    lastFacingRef.current = facing;
    applySpriteFrameUV(texture, row, facing);
    lastPosRef.current = { x: body.position.x, z: body.position.z };
  });

  const color = CHAR_COLORS[player.characterId] || '#8e9aaf';

  return (
    <group
      ref={onGroupRef}
      position={[player.position.x, player.position.y, player.position.z]}
    >
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <mesh position={[0, 0.8, 0]}>
          <planeGeometry args={[1.6, 2.0]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.1}
            opacity={player.isAlive ? 1 : 0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
      <Text
        position={[0, 2.0, 0]}
        fontSize={0.25}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.02}
        outlineColor="black"
      >
        {player.nickname}
      </Text>
      {isCurrentTurn && player.isAlive && (
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 16]} />
          <meshBasicMaterial color="#6c63ff" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
      {player.isAlive && (
        <pointLight position={[0, 1, 0]} color={color} intensity={0.5} distance={4} />
      )}
    </group>
  );
}

function OfficeDecorations({ mapId }: { mapId: string }) {
  const deskPositions = useMemo(() => {
    const positions: Array<[number, number, number]> = [];
    if (mapId === 'office' || mapId === 'pantry') {
      for (let x = -6; x <= 6; x += 4) {
        for (let z = -3; z <= 3; z += 3) {
          if (Math.random() > 0.4) {
            positions.push([x + (Math.random() - 0.5), 0.25, z + (Math.random() - 0.5)]);
          }
        }
      }
    }
    return positions;
  }, [mapId]);

  return (
    <>
      {deskPositions.map((pos, i) => (
        <group key={`desk_${i}`} position={pos}>
          {/* Desk top */}
          <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.08, 0.7]} />
            <meshStandardMaterial color="#6b5b4a" roughness={0.7} />
          </mesh>
          {/* Legs */}
          {[[-0.5, 0.3, -0.25], [0.5, 0.3, -0.25], [-0.5, 0.3, 0.25], [0.5, 0.3, 0.25]].map(
            (lp, j) => (
              <mesh key={j} position={lp as [number, number, number]} castShadow>
                <boxGeometry args={[0.05, 0.6, 0.05]} />
                <meshStandardMaterial color="#4a4a4a" />
              </mesh>
            )
          )}
        </group>
      ))}
    </>
  );
}
