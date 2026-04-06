import React, { useState } from 'react';
import { useRoomStore } from '../../store/useRoomStore';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

const AMOUNTS = [1, 2, 5, 10, 20, 50];

interface Props {
  navigateTo: (page: Page) => void;
}

export default function RoomPage({ navigateTo }: Props) {
  const { currentRoom, recordRound, undoRound, settleRoom, addPlayer, removePlayer, setCurrentRoom } = useRoomStore();
  const room = currentRoom;

  const [winners, setWinners] = useState<string[]>([]);
  const [losers, setLosers] = useState<string[]>([]);
  const [amount, setAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  if (!room) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <div>房间不存在，<span style={{ color: '#FF6B6B', cursorPointer: 'pointer' }} onClick={() => navigateTo('index')}>返回首页</span></div>
      </div>
    );
  }

  const sortedPlayers = [...room.players].sort((a, b) => b.currentScore - a.currentScore);

  const toggleWinner = (id: string) => {
    setWinners(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  const toggleLoser = (id: string) => {
    setLosers(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const handleRecord = () => {
    if (winners.length === 0 || losers.length === 0) return;
    const finalAmount = showCustom && customAmount ? parseInt(customAmount) : amount;
    if (!finalAmount || finalAmount <= 0) return;
    recordRound({ roomId: room.roomId, winners, losers, amount: finalAmount });
    const updated = useRoomStore.getState().rooms.find(r => r.roomId === room.roomId);
    if (updated) setCurrentRoom(updated);
    setWinners([]);
    setLosers([]);
    setCustomAmount('');
    setShowCustom(false);
    setAmount(1);
  };

  const handleUndo = () => {
    undoRound(room.roomId);
    const updated = useRoomStore.getState().rooms.find(r => r.roomId === room.roomId);
    if (updated) setCurrentRoom(updated);
  };

  const handleSettle = () => {
    const result = settleRoom(room.roomId);
    if (result) navigateTo('settlement');
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    addPlayer(room.roomId, newPlayerName.trim());
    setNewPlayerName('');
    const updated = useRoomStore.getState().rooms.find(r => r.roomId === room.roomId);
    if (updated) setCurrentRoom(updated);
  };

  const getRankClass = (rank: number) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-default';
  };

  const getLastChange = (playerId: string): number => {
    if (room.rounds.length === 0) return 0;
    const last = room.rounds[room.rounds.length - 1];
    return last.scoreChanges[playerId] || 0;
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomId).then(() => alert('房间码已复制'));
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '16px', marginTop: '16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>{room.name}</div>
        <div className="flex items-center gap-8 clickable" onClick={copyRoomCode} title="点击复制">
          <span style={{ fontSize: '14px', color: '#888' }}>房间码</span>
          <span style={{ background: '#f0f0f0', padding: '4px 12px', borderRadius: '4px', fontWeight: 700, letterSpacing: '2px' }}>{room.roomId}</span>
        </div>
      </div>

      {/* Players */}
      <div className="card">
        <div className="flex justify-between items-center mb-8">
          <span style={{ fontWeight: 600 }}>👥 玩家列表（{room.players.length}人）</span>
          <span style={{ fontSize: '12px', color: '#888' }}>第{room.rounds.length + 1}局</span>
        </div>

        {sortedPlayers.map((player, idx) => {
          const rank = idx + 1;
          const lastChange = getLastChange(player.playerId);
          return (
            <div key={player.playerId} className="player-item">
              <div className={`rank-badge ${getRankClass(rank)}`}>
                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
              </div>
              <div className="avatar" style={{ background: player.avatarColor }}>
                {player.name.slice(0, 1)}
              </div>
              <div className="flex-1">
                <span style={{ fontWeight: 600 }}>{player.name}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 700, fontSize: '18px', color: player.currentScore >= room.initialScore ? '#52c41a' : '#ff4d4f' }}>
                  {player.currentScore >= room.initialScore ? '+' : ''}{player.currentScore - room.initialScore}
                </span>
                <span style={{ fontSize: '12px', color: '#888', marginLeft: '4px' }}>/{player.currentScore}</span>
              </div>
            </div>
          );
        })}

        {/* Add player */}
        {room.players.length < 8 && (
          <div className="flex items-center gap-8 mt-8">
            <input
              className="input"
              style={{ flex: 1 }}
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              placeholder="新玩家昵称"
              maxLength={8}
              onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
            />
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }} onClick={handleAddPlayer}>添加</button>
          </div>
        )}
      </div>

      {/* Score Panel */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '12px' }}>📝 记牌区</div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>选择赢家</div>
          <div className="flex flex-wrap gap-8">
            {room.players.map(p => (
              <div
                key={p.playerId}
                className={`player-tag ${winners.includes(p.playerId) ? 'selected' : ''}`}
                onClick={() => toggleWinner(p.playerId)}
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>选择输家</div>
          <div className="flex flex-wrap gap-8">
            {room.players.map(p => (
              <div
                key={p.playerId}
                className={`player-tag loser-tag ${losers.includes(p.playerId) ? 'selected' : ''}`}
                onClick={() => toggleLoser(p.playerId)}
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>金额</div>
          <div className="flex flex-wrap gap-8">
            {AMOUNTS.map(a => (
              <div
                key={a}
                className={`amount-tag ${!showCustom && amount === a ? 'selected' : ''}`}
                onClick={() => { setAmount(a); setShowCustom(false); }}
              >
                {a}元
              </div>
            ))}
            <div
              className={`amount-tag ${showCustom ? 'selected' : ''}`}
              onClick={() => setShowCustom(true)}
            >
              自定义
            </div>
          </div>
          {showCustom && (
            <input
              className="input"
              style={{ marginTop: '8px' }}
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="输入金额"
            />
          )}
        </div>

        <div className="flex gap-12">
          <button
            className={`btn ${winners.length > 0 && losers.length > 0 ? 'btn-success' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={handleRecord}
          >
            ✅ 确认记牌
          </button>
          {room.rounds.length > 0 && (
            <button className="btn btn-secondary" onClick={handleUndo} style={{ padding: '12px 16px' }}>
              ↩️ 撤销
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-12 mt-16">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigateTo('index')}>
          🏠 首页
        </button>
        <button
          className={`btn ${room.rounds.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={room.rounds.length > 0 ? handleSettle : undefined}
        >
          📊 结算
        </button>
      </div>
    </div>
  );
}
