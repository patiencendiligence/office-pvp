import { useState } from 'react';
import { useGameStore, getResolvedCharacterId } from '../store';
import { getSocket } from '../socket';
import { ChatPanel } from './ChatPanel';
import { SettingsModal } from './SettingsModal';

export function Lobby() {
  const rooms = useGameStore((s) => s.rooms);
  const nickname = useGameStore((s) => s.nickname);
  const showSettings = useGameStore((s) => s.showSettings);
  const setShowSettings = useGameStore((s) => s.setShowSettings);
  const maps = useGameStore((s) => s.maps);
  const wins = useGameStore((s) => s.wins);

  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMap, setNewRoomMap] = useState('office');

  const joinRoom = (roomId: string) => {
    const characterId = getResolvedCharacterId();
    const sock = getSocket();
    sock.emit('player:setCharacter', characterId);
    sock.emit('room:join', { roomId, characterId });
  };

  const createRoom = () => {
    getSocket().emit('room:create', { name: newRoomName || 'New Room', mapId: newRoomMap });
    setShowCreate(false);
    setNewRoomName('');
  };

  return (
    <div className="lobby">
      <div className="lobby-main">
        <div className="lobby-header">
          <h1>Office PvP</h1>
          <div className="lobby-header-actions">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center', marginRight: 8 }}>
              {nickname} | Wins: {wins}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(true)}>
              Settings
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + Create Room
            </button>
          </div>
        </div>

        <div className="room-list">
          {rooms.map((room) => (
            <div key={room.id} className="room-card" onClick={() => joinRoom(room.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{room.name}</h3>
                <span className={`room-card-badge badge-${room.phase}`}>
                  {room.phase}
                </span>
              </div>
              <div className="room-card-info">
                <span>Map: {room.mapId}</span>
                <span>{room.playerCount}/{room.maxPlayers} players</span>
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>
              No rooms yet. Create one to start!
            </div>
          )}
        </div>
      </div>

      <ChatPanel />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Room</h3>
            <div className="create-room-form">
              <div className="modal-field">
                <label>Room Name</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="My Room"
                  maxLength={24}
                />
              </div>
              <div className="modal-field">
                <label>Select Map</label>
                <div className="map-grid">
                  {maps.map((m) => (
                    <div
                      key={m.id}
                      className={`map-option ${newRoomMap === m.id ? 'selected' : ''}`}
                      onClick={() => setNewRoomMap(m.id)}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={createRoom}>
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
