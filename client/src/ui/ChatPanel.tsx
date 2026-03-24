import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store';
import { getSocket } from '../socket';

export function ChatPanel() {
  const globalChat = useGameStore((s) => s.globalChat);
  const roomChat = useGameStore((s) => s.roomChat);
  const chatTab = useGameStore((s) => s.chatTab);
  const setChatTab = useGameStore((s) => s.setChatTab);
  const currentRoom = useGameStore((s) => s.currentRoom);
  const playerId = useGameStore((s) => s.playerId);
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);

  const messages = chatTab === 'global' ? globalChat : roomChat;

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    if (chatTab === 'room' && currentRoom) {
      getSocket().emit('chat:room', text);
    } else {
      getSocket().emit('chat:global', text);
    }
    setInput('');
  };

  return (
    <div className="chat-sidebar">
      <div className="chat-tabs">
        <button
          className={`chat-tab ${chatTab === 'global' ? 'active' : ''}`}
          onClick={() => setChatTab('global')}
        >
          Global
        </button>
        <button
          className={`chat-tab ${chatTab === 'room' ? 'active' : ''}`}
          onClick={() => setChatTab('room')}
          style={{ opacity: currentRoom ? 1 : 0.4 }}
          disabled={!currentRoom}
        >
          Room
        </button>
      </div>

      <div className="chat-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            No messages yet
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.senderId === playerId ? 'chat-msg-self' : ''}`}>
            <span className="chat-msg-nick">{msg.senderNickname}</span>
            {msg.content}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={chatTab === 'room' ? 'Room chat...' : 'Global chat...'}
          maxLength={200}
        />
        <button className="btn btn-primary btn-sm" onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
