import React from 'react';
import { useHistoryStore } from '../../store/useHistoryStore';
import { GameRecord, Round, SettlementItem } from '../../types';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page) => void;
  recordId?: string | null;
}

export default function HistoryDetailPage({ navigateTo, recordId }: Props) {
  const { records, deleteRecord } = useHistoryStore();
  const record: GameRecord | undefined = recordId
    ? records.find(r => r.recordId === recordId)
    : records[0];

  if (!record) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
        <div>记录不存在</div>
        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => navigateTo('history')}>返回历史</button>
      </div>
    );
  }

  const players = record.roomSnapshot.players;
  const getName = (id: string) => players.find(p => p.playerId === id)?.name || '未知';
  const getColor = (id: string) => players.find(p => p.playerId === id)?.avatarColor || '#ccc';

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
      `📝 共${record.rounds.length}局`,
      '',
      '最终排名：'
    ];
    record.finalScores.forEach((fs, idx) => {
      const p = players.find(pl => pl.playerId === fs.playerId);
      if (p) lines.push(`${idx + 1}. ${p.name}：${fs.score}分`);
    });
    lines.push('');
    lines.push('💰 转账明细：');
    record.settlements.forEach(s => {
      lines.push(`${getName(s.from)} → ${getName(s.to)}：${s.amount}元`);
    });
    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
    } else {
      prompt('复制以下内容：', text);
    }
  };

  const handleDelete = () => {
    if (window.confirm('确认删除？')) {
      deleteRecord(record.recordId);
      navigateTo('history');
    }
  };

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>
          {record.roomSnapshot.gameType === 'mahjong' ? '🀄' : '🃏'} {record.roomSnapshot.name}
        </div>
        <div style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>
          {new Date(record.endedAt).toLocaleString()}
        </div>
      </div>

      {/* Final Ranking */}
      <div className="card">
        <span style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>🏆 最终排名</span>
        {record.finalScores.map((fs, idx) => {
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
              <span style={{ color: '#888', fontSize: '12px', marginLeft: '4px' }}>/{fs.score}</span>
            </div>
          );
        })}
      </div>

      {/* Rounds Detail */}
      <div className="card">
        <span style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>📝 局数详情（共{record.rounds.length}局）</span>
        {record.rounds.map((round: Round) => (
          <div key={round.roundId} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div className="flex justify-between">
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#888' }}>第{round.roundNumber}局</span>
              <span style={{ fontSize: '14px', color: '#888' }}>{round.amount}元/分</span>
            </div>
            <div className="flex flex-wrap gap-8 mt-4">
              {round.winners.map(wid => (
                <div key={wid} className="result-tag winner">{getName(wid)} +{Math.abs(round.scoreChanges[wid])}</div>
              ))}
              {round.losers.map(lid => (
                <div key={lid} className="result-tag loser">{getName(lid)} {round.scoreChanges[lid]}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Settlements */}
      {record.settlements.length > 0 && (
        <div className="card">
          <span style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>💰 转账明细</span>
          {record.settlements.map((s: SettlementItem, idx: number) => (
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

      <div className="flex gap-12 mt-16">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExport}>📤 导出</button>
        <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete}>🗑️ 删除</button>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => navigateTo('history')}>
        ← 返回历史战局
      </button>
    </div>
  );
}
