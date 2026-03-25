import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameStore } from '../store';
import { getSocket } from '../socket';
import { GameScene } from '../game/GameScene';
import { MobileGameControls } from './MobileGameControls';
import { useMobileGameLayout } from './useMobileGameLayout';
import { HelpModal } from './HelpModal';

const OBJ_ICONS: Record<string, string> = {
  mug: '\u2615',
  keyboard: '\u2328',
  chair: '\uD83E\uDE91',
  monitor: '\uD83D\uDCBB',
  stapler: '\uD83D\uDCCC',
  phone: '\u260E',
};

export function GameView() {
  const mobileGameLayout = useMobileGameLayout();
  const currentRoom = useGameStore((s) => s.currentRoom);
  const playerId = useGameStore((s) => s.playerId);
  const objects = useGameStore((s) => s.objects);
  const selectedObject = useGameStore((s) => s.selectedObject);
  const setSelectedObject = useGameStore((s) => s.setSelectedObject);
  const winner = useGameStore((s) => s.winner);
  const characters = useGameStore((s) => s.characters);

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; nick: string; text: string }>>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const hitVisual = useGameStore((s) => s.hitVisual);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const sock = getSocket();
    const handler = (msg: any) => {
      setChatMessages((prev) => [...prev.slice(-49), { id: msg.id, nick: msg.senderNickname, text: msg.content }]);
    };
    sock.on('chat:room', handler);
    sock.on('chat:global', handler);
    return () => {
      sock.off('chat:room', handler);
      sock.off('chat:global', handler);
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!leaveConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeaveConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveConfirmOpen]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    if (currentRoom) {
      getSocket().emit('chat:room', text);
    } else {
      getSocket().emit('chat:global', text);
    }
    setChatInput('');
  }, [chatInput, currentRoom]);

  if (!currentRoom) return null;

  const players = Object.values(currentRoom.players);
  const isMyTurn = currentRoom.currentTurnPlayer === playerId;

  const getCharColor = (charId: string) =>
    characters.find((c) => c.id === charId)?.color || '#4a90d9';

  const handleRestart = () => getSocket().emit('game:restart');

  const emitLeaveRoom = useCallback(() => {
    getSocket().emit('room:leave');
    setLeaveConfirmOpen(false);
  }, []);

  /** 게임 종료 후 결과 화면에서 로비로 */
  const handleLeaveAfterGame = useCallback(() => {
    getSocket().emit('room:leave');
  }, []);

  const getWinnerName = () => {
    if (!winner?.winnerId || !winner.players) return 'Nobody';
    return winner.players[winner.winnerId]?.nickname || 'Unknown';
  };

  const canvasShakeClass =
    hitVisual?.kind === 'critical'
      ? 'game-canvas--shake-critical'
      : hitVisual?.kind === 'rank'
        ? 'game-canvas--shake-rank'
        : '';

  return (
    <div className={`game-container${mobileGameLayout ? ' game-container--touch' : ''}`.trim()}>
      {hitVisual?.kind === 'critical' && (
        <div className="hit-fx-critical-banner" aria-hidden>
          CRITICAL!
        </div>
      )}
      <div className={`game-canvas ${canvasShakeClass}`.trim()}>
        <Canvas
          shadows
          camera={{ position: [0, 12, 16], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <GameScene />
        </Canvas>
      </div>

      <div className="game-hud">
        {/* HP bars */}
        <div className="hud-top">
          {players.map((p) => {
            const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
            const hpColor = hpPct > 50 ? 'var(--success)' : hpPct > 25 ? 'var(--warning)' : 'var(--danger)';
            const isTurn = currentRoom.currentTurnPlayer === p.id;
            return (
              <div key={p.id} className={`hp-card ${isTurn ? 'active-turn' : ''} ${!p.isAlive ? 'dead' : ''}`}>
                <div className="hp-name">
                  <span style={{ color: getCharColor(p.characterId) }}>
                    {p.nickname}{p.id === playerId ? ' (You)' : ''}{p.isBot ? ' (Bot)' : ''}
                  </span>
                  <span>{p.hp}/{p.maxHp}</span>
                </div>
                <div className="hp-bar-bg">
                  <div className="hp-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Turn indicator */}
        {currentRoom.phase === 'playing' && (
          <div className="turn-indicator">
            {isMyTurn
              ? mobileGameLayout
                ? '내 턴 — 조이스틱 이동 · 점프 · 오른쪽 패드 당겨 발사'
                : 'Your Turn! WASD to move, drag to throw'
              : `${players.find((p) => p.id === currentRoom.currentTurnPlayer)?.nickname || '...'}'s Turn`}
            <span className="timer">{currentRoom.turnTimeLeft}s</span>
            <button type="button" className="btn-hud-help" onClick={() => setShowHelp(true)}>
              도움말
            </button>
            <button
              type="button"
              className="btn-leave-room"
              onClick={() => setLeaveConfirmOpen(true)}
            >
              방 나가기
            </button>
          </div>
        )}

        {currentRoom.phase === 'waiting' && (
          <div className="turn-indicator turn-indicator--waiting">
            <button type="button" className="btn-hud-help" onClick={() => setShowHelp(true)}>
              도움말
            </button>
            <button
              type="button"
              className="btn-leave-room"
              onClick={() => setLeaveConfirmOpen(true)}
            >
              방 나가기
            </button>
          </div>
        )}

        {isMyTurn && currentRoom.phase === 'playing' && mobileGameLayout && <MobileGameControls />}

        {isMyTurn && currentRoom.phase === 'playing' && !mobileGameLayout && (
          <div className="dpad">
            <button
              className="dpad-btn dpad-up"
              onPointerDown={() => (window as any).__applyMobileMove?.('w', true)}
              onPointerUp={() => (window as any).__applyMobileMove?.('w', false)}
              onPointerLeave={() => (window as any).__applyMobileMove?.('w', false)}
            >
              &#9650;
            </button>
            <button
              className="dpad-btn dpad-left"
              onPointerDown={() => (window as any).__applyMobileMove?.('a', true)}
              onPointerUp={() => (window as any).__applyMobileMove?.('a', false)}
              onPointerLeave={() => (window as any).__applyMobileMove?.('a', false)}
            >
              &#9664;
            </button>
            <button
              className="dpad-btn dpad-right"
              onPointerDown={() => (window as any).__applyMobileMove?.('d', true)}
              onPointerUp={() => (window as any).__applyMobileMove?.('d', false)}
              onPointerLeave={() => (window as any).__applyMobileMove?.('d', false)}
            >
              &#9654;
            </button>
            <button
              className="dpad-btn dpad-down"
              onPointerDown={() => (window as any).__applyMobileMove?.('s', true)}
              onPointerUp={() => (window as any).__applyMobileMove?.('s', false)}
              onPointerLeave={() => (window as any).__applyMobileMove?.('s', false)}
            >
              &#9660;
            </button>
          </div>
        )}

        {/* Object selector */}
        {isMyTurn && currentRoom.phase === 'playing' && (
          <div className="object-selector">
            {objects.map((obj) => (
              <button
                key={obj.id}
                className={`obj-btn ${selectedObject === obj.id ? 'selected' : ''}`}
                onClick={() => setSelectedObject(obj.id)}
                title={`${obj.name} (DMG: x${obj.damageMultiplier})`}
              >
                <span>{OBJ_ICONS[obj.id] || '\uD83D\uDCE6'}</span>
                {obj.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* In-game chat */}
        <div className="game-chat">
          <div className="game-chat-messages" ref={chatRef}>
            {chatMessages.map((m) => (
              <div key={m.id} className="chat-msg" style={{ fontSize: 11, padding: '3px 6px' }}>
                <span className="chat-msg-nick">{m.nick}</span>
                {m.text}
              </div>
            ))}
          </div>
          <div className="game-chat-input">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && sendChat()}
              placeholder="Chat..."
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {leaveConfirmOpen && (
        <div
          className="leave-confirm-backdrop"
          role="presentation"
          onClick={() => setLeaveConfirmOpen(false)}
        >
          <div
            className="leave-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="leave-confirm-title">방 나가기</h3>
            <p className="leave-confirm-text">
              {currentRoom.phase === 'playing'
                ? '정말 나가시겠습니까? 나가면 지는 거예요.'
                : '정말 방을 나가시겠습니까?'}
            </p>
            <div className="leave-confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setLeaveConfirmOpen(false)}>
                취소
              </button>
              <button type="button" className="btn btn-primary leave-confirm-ok" onClick={emitLeaveRoom}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner overlay */}
      {winner && (
        <div className="winner-overlay">
          <div className="winner-card">
            <h2>{winner.winnerId === playerId ? 'Victory!' : 'Game Over'}</h2>
            <p>
              {winner.winnerId
                ? `${getWinnerName()} wins!`
                : 'Draw!'}
            </p>
            <div className="btns">
              <button className="btn btn-secondary" onClick={handleLeaveAfterGame}>
                Leave
              </button>
              <button className="btn btn-primary" onClick={handleRestart}>
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
