import { useEffect } from 'react';
import { useGameStore } from './store';
import { getSocket } from './socket';
import { Lobby } from './ui/Lobby';
import { Room } from './ui/Room';
import { GameView } from './ui/GameView';
import './styles.css';

export default function App() {
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    getSocket();
  }, []);

  return (
    <div className="app">
      {screen === 'lobby' && <Lobby />}
      {screen === 'room' && <Room />}
      {screen === 'game' && <GameView />}
    </div>
  );
}
