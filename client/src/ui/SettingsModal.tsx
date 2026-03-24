import { useState } from 'react';
import { useGameStore } from '../store';
import { getSocket } from '../socket';

interface Props {
  onClose: () => void;
}

// Sheet: 4 directions × 6 character rows (see GameScene sprite UV).
const SPRITE_SHEET_COLS = 4;
const SPRITE_SHEET_ROWS = 6;
const PREVIEW_DIR_COL = 3; // 정면 (하/S)

function getCharSpriteStyle(spriteRow: number) {
  const pctX = SPRITE_SHEET_COLS > 1 ? (PREVIEW_DIR_COL / (SPRITE_SHEET_COLS - 1)) * 100 : 0;
  const pctY = SPRITE_SHEET_ROWS > 1 ? (spriteRow / (SPRITE_SHEET_ROWS - 1)) * 100 : 0;
  return {
    backgroundImage: 'url(/characters.png)',
    backgroundSize: `${SPRITE_SHEET_COLS * 100}% ${SPRITE_SHEET_ROWS * 100}%`,
    backgroundPosition: `${pctX}% ${pctY}%`,
    imageRendering: 'pixelated' as const,
  };
}

export function SettingsModal({ onClose }: Props) {
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const characterId = useGameStore((s) => s.characterId);
  const setCharacterId = useGameStore((s) => s.setCharacterId);
  const characters = useGameStore((s) => s.characters);
  const wins = useGameStore((s) => s.wins);

  const [nick, setNick] = useState(nickname);
  const [charId, setCharId] = useState(characterId);

  const save = () => {
    if (nick.trim()) {
      setNickname(nick.trim());
      getSocket().emit('player:setNickname', nick.trim());
    }
    setCharacterId(charId);
    getSocket().emit('player:setCharacter', charId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <div className="modal-field">
          <label>Nickname</label>
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={16}
            placeholder="Enter nickname..."
          />
        </div>

        <div className="modal-field">
          <label>Character (Wins: {wins})</label>
          <div className="char-grid">
            {characters.map((c) => {
              const locked = wins < c.winsRequired;
              return (
                <div
                  key={c.id}
                  className={`char-option ${charId === c.id ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => !locked && setCharId(c.id)}
                >
                  <div
                    className="char-option-avatar"
                    style={{
                      ...getCharSpriteStyle(c.spriteRow),
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      filter: locked ? 'grayscale(1) brightness(0.4)' : 'none',
                    }}
                  />
                  <div className="char-option-name">{c.nameKo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    HP {c.hp} | PWR x{c.power}
                  </div>
                  {locked && (
                    <div className="char-option-lock">
                      {c.winsRequired}승 필요
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
