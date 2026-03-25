import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../store';
import { getSocket } from '../socket';
import { ChatPanel } from './ChatPanel';
import { SettingsModal } from './SettingsModal';

export function Room() {
  const currentRoom = useGameStore((s) => s.currentRoom);
  const playerId = useGameStore((s) => s.playerId);
  const characters = useGameStore((s) => s.characters);
  const showSettings = useGameStore((s) => s.showSettings);
  const setShowSettings = useGameStore((s) => s.setShowSettings);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const emitLeaveRoom = useCallback(() => {
    getSocket().emit('room:leave');
    setLeaveConfirmOpen(false);
  }, []);

  useEffect(() => {
    if (!leaveConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeaveConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveConfirmOpen]);

  if (!currentRoom) return null;

  const players = Object.values(currentRoom.players);
  const emptySlots = currentRoom.maxPlayers - players.length;
  const hasBots = players.some((p) => p.isBot);

  const startGame = () => getSocket().emit('game:start');
  const addBot = () => getSocket().emit('game:addBot');

  const getChar = (charId: string) => characters.find((c) => c.id === charId);
  const getCharColor = (charId: string) => getChar(charId)?.color || '#8e9aaf';
  const getCharName = (charId: string) => {
    const ch = getChar(charId);
    return ch ? ch.nameKo : '비둘기 신입';
  };

  return (
    <div className="room-view">
      <div className="room-main">
        <div className="room-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2>{currentRoom.name}</h2>
            <span className="room-map-badge">{currentRoom.mapId}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(true)}>
              Settings
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setLeaveConfirmOpen(true)}>
              방 나가기
            </button>
            {emptySlots > 0 && currentRoom.phase === 'waiting' && (
              <button className="btn btn-secondary btn-sm" onClick={addBot}>
                + Add Bot
              </button>
            )}
            {players.length >= 2 && (
              <button className="btn btn-primary btn-sm" onClick={startGame}>
                Start Game
              </button>
            )}
          </div>
        </div>

        <div className="player-grid">
          {players.map((p) => (
            <div key={p.id} className="player-slot" style={p.isBot ? { borderColor: 'var(--warning)', borderStyle: 'dashed' } : undefined}>
              <div
                className="player-slot-avatar"
                style={{ background: getCharColor(p.characterId) }}
              >
                {p.isBot ? 'B' : p.nickname[0]?.toUpperCase()}
              </div>
              <div className="player-slot-name">
                {p.nickname}
                {p.id === playerId && ' (You)'}
                {p.isBot && ' (Bot)'}
              </div>
              <div className="player-slot-char">{getCharName(p.characterId)}</div>
            </div>
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="player-slot player-slot-empty">
              Waiting...
            </div>
          ))}
        </div>

        <div style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>
          {players.length < 2
            ? 'Need at least 2 players to start. Add a bot to play solo!'
            : 'Ready to start! Any player can click Start Game.'}
        </div>
      </div>

      <ChatPanel />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

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
            aria-labelledby="room-leave-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="room-leave-confirm-title">방 나가기</h3>
            <p className="leave-confirm-text">정말 방을 나가시겠습니까?</p>
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
    </div>
  );
}
