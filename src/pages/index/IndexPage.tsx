import React, { useState } from 'react';
import { useRoomStore } from '../../store/useRoomStore';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page) => void;
}

export default function IndexPage({ navigateTo }: Props) {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [roomName, setRoomName] = useState('麻将室');
  const [gameType, setGameType] = useState<'mahjong' | 'poker' | 'guandan' | 'custom'>('mahjong');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const { createRoom, joinRoom } = useRoomStore();

  const handleCreate = () => {
    if (!playerName.trim()) { setError('请输入你的昵称'); return; }
    setError('');
    const room = createRoom({ name: roomName, gameType, playerName: playerName.trim() });
    if (room) navigateTo('room');
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('请输入你的昵称'); return; }
    if (!joinCode.trim()) { setError('请输入房间码'); return; }
    setError('');
    const room = joinRoom(joinCode.trim(), playerName.trim());
    if (room) navigateTo('room');
    else setError('房间不存在或已失效');
  };

  return (
    <div className="container">
      <div className="title" style={{ marginTop: '60px' }}>🀄 打牌记账</div>
      <div className="subtitle">和朋友打牌，算账不扯皮</div>

      {mode === 'home' && (
        <div>
          <div className="card clickable" onClick={() => setMode('create')}>
            <div className="flex items-center">
              <span style={{ fontSize: '28px', marginRight: '16px' }}>🎯</span>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>快速开始</div>
                <div style={{ fontSize: '14px', color: '#888' }}>创建房间，开始一局</div>
              </div>
            </div>
          </div>

          <div className="card clickable" onClick={() => setMode('join')}>
            <div className="flex items-center">
              <span style={{ fontSize: '28px', marginRight: '16px' }}>📋</span>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>加入房间</div>
                <div style={{ fontSize: '14px', color: '#888' }}>输入房间码加入</div>
              </div>
            </div>
          </div>

          <div className="card clickable" onClick={() => navigateTo('history')}>
            <div className="flex items-center">
              <span style={{ fontSize: '28px', marginRight: '16px' }}>📊</span>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>历史战局</div>
                <div style={{ fontSize: '14px', color: '#888' }}>查看过往记录</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'create' && (
        <div>
          <div className="card">
            <div className="mb-16"><span style={{ fontWeight: 600 }}>房间名称</span></div>
            <input className="input" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="如：麻将室" />

            <div className="mt-16 mb-8"><span style={{ fontWeight: 600 }}>玩法</span></div>
            <div className="flex flex-wrap gap-8">
              {(['mahjong', 'poker', 'guandan', 'custom'] as const).map(type => (
                <div key={type} className={`tag ${gameType === type ? 'active' : ''}`} onClick={() => setGameType(type)}>
                  {type === 'mahjong' ? '🀄 麻将' : type === 'poker' ? '🃏 斗地主' : type === 'guandan' ? '🎴 掼蛋' : '⚙️ 自定义'}
                </div>
              ))}
            </div>

            <div className="mt-16 mb-8"><span style={{ fontWeight: 600 }}>你的昵称</span></div>
            <input className="input" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="4-8个字符" maxLength={8} />

            {error && <div style={{ color: '#ff4d4f', fontSize: '14px', marginTop: '12px' }}>{error}</div>}
          </div>

          <div className="btn btn-primary" style={{ marginTop: '16px' }} onClick={handleCreate}>创建房间</div>
          <div className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => { setMode('home'); setError(''); }}>返回</div>
        </div>
      )}

      {mode === 'join' && (
        <div>
          <div className="card">
            <div className="mb-8"><span style={{ fontWeight: 600 }}>房间码</span></div>
            <input className="input" value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6位数字" maxLength={6} />

            <div className="mt-16 mb-8"><span style={{ fontWeight: 600 }}>你的昵称</span></div>
            <input className="input" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="4-8个字符" maxLength={8} />

            {error && <div style={{ color: '#ff4d4f', fontSize: '14px', marginTop: '12px' }}>{error}</div>}
          </div>

          <div className="btn btn-primary" style={{ marginTop: '16px' }} onClick={handleJoin}>加入房间</div>
          <div className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => { setMode('home'); setError(''); }}>返回</div>
        </div>
      )}
    </div>
  );
}
