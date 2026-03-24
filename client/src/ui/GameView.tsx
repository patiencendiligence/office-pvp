import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameStore } from '../store';
import { getSocket } from '../socket';
import { GameScene } from '../game/GameScene';

const OBJ_ICONS: Record<string, string> = {
  mug: '\u2615',
  keyboard: '\u2328',
  chair: '\uD83E\uDE91',
  monitor: '\uD83D\uDCBB',
  stapler: '\uD83D\uDCCC',
  phone: '\u260E',
};

export function GameView() {
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
  const handleLeave = () => getSocket().emit('room:leave');

  const getWinnerName = () => {
    if (!winner?.winnerId || !winner.players) return 'Nobody';
    return winner.players[winner.winnerId]?.nickname || 'Unknown';
  };

  return (
    <div className="game-container">
      <div className="game-canvas">
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
                    {p.nickname}{p.id === playerId ? ' (You)' : ''}
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
            {isMyTurn ? 'Your Turn! Drag to aim & throw' : `${players.find(p => p.id === currentRoom.currentTurnPlayer)?.nickname || '...'}'s Turn`}
            <span className="timer">{currentRoom.turnTimeLeft}s</span>
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
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Chat..."
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>

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
              <button className="btn btn-secondary" onClick={handleLeave}>
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
