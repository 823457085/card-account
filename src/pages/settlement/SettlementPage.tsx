import React from 'react';
import { useRoomStore } from '../../store/useRoomStore';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page) => void;
}

export default function SettlementPage({ navigateTo }: Props) {
  const { lastSettlement } = useRoomStore();

  if (!lastSettlement) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <div>无结算数据</div>
        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => navigateTo('index')}>返回首页</button>
      </div>
    );
  }

  const { finalScores, settlements, record } = lastSettlement;
  const players = record.roomSnapshot.players;
  const getName = (id: string) => players.find(p => p.playerId === id)?.name || '未知';

  const getRankClass = (rank: number) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-default';
  };

  const handleExport = () => {
    const lines = [
      `🏆 ${record.roomSnapshot.name} 结算结果`,
      `📅 ${new Date(record.endedAt).toLocaleDateString()}`,
      '',
      '最终排名：'
    ];
    finalScores.forEach((fs, idx) => {
      const p = players.find(pl => pl.playerId === fs.playerId);
      if (p) lines.push(`${idx + 1}. ${p.name}：${fs.score}分`);
    });
    lines.push('');
    lines.push('💰 转账明细：');
    settlements.forEach(s => {
      lines.push(`${getName(s.from)} → ${getName(s.to)}：${s.amount}元`);
    });
    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
    } else {
      prompt('复制以下内容：', text);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      <div className="title">🏆 结算</div>
      <div className="subtitle">{record.roomSnapshot.name} · 共{record.rounds.length}局</div>

      {/* Final Scores */}
      <div className="card">
        <span style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>📊 最终排名</span>
        {finalScores.map((fs, idx) => {
          const p = players.find(pl => pl.playerId === fs.playerId);
          if (!p) return null;
          const diff = fs.score - record.roomSnapshot.initialScore;
          return (
            <div key={fs.playerId} className="player-item">
              <div className={`rank-badge ${getRankClass(idx + 1)}`}>
                {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
              </div>
              <div className="avatar" style={{ background: p.avatarColor }}>
                {p.name.slice(0, 1)}
              </div>
              <div className="flex-1">
                <span style={{ fontWeight: 600 }}>{p.name}</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '18px', color: diff >= 0 ? '#52c41a' : '#ff4d4f' }}>
                {diff >= 0 ? '+' : ''}{diff}
              </span>
            </div>
          );
        })}
      </div>

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className="card">
          <span style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>💰 转账明细</span>
          {settlements.map((s, idx) => (
            <div key={idx} className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ color: '#666' }}>
                <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{getName(s.from)}</span>
                {' → '}
                <span style={{ color: '#52c41a', fontWeight: 600 }}>{getName(s.to)}</span>
              </span>
              <span style={{ fontWeight: 700, fontSize: '18px' }}>{s.amount}元</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary" onClick={handleExport} style={{ marginTop: '16px' }}>
        📤 导出结果
      </button>

      <div className="flex gap-12 mt-16">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigateTo('index')}>
          🏠 返回首页
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigateTo('historyDetail')}>
          📋 查看详情
        </button>
      </div>
    </div>
  );
}
