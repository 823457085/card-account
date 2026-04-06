import React, { useState } from 'react';
import { useHistoryStore } from '../../store/useHistoryStore';
import { getGameTypeName, formatDate } from '../../utils/format';
import { GameRecord } from '../../types';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page, recordId?: string) => void;
}

export default function HistoryPage({ navigateTo }: Props) {
  const { records, loadHistory, deleteRecord } = useHistoryStore();
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');
  const [selectedRecord, setSelectedRecord] = useState<GameRecord | null>(null);

  const filteredRecords = records.filter(r => {
    if (filter === 'all') return true;
    const now = Date.now();
    const diff = now - r.endedAt;
    if (filter === 'week') return diff < 7 * 24 * 60 * 60 * 1000;
    if (filter === 'month') return diff < 30 * 24 * 60 * 60 * 1000;
    return true;
  });

  const handleDelete = (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    if (window.confirm('确认删除这条记录？')) {
      deleteRecord(recordId);
    }
  };

  const handleViewDetail = (record: GameRecord) => {
    setSelectedRecord(record);
    navigateTo('historyDetail', record.recordId);
  };

  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, textAlign: 'center', marginBottom: '16px' }}>📊 历史战局</div>

      {/* Filter tabs */}
      <div className="flex gap-8 mb-16">
        {(['all', 'week', 'month'] as const).map(f => (
          <div
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : f === 'week' ? '本周' : '本月'}
          </div>
        ))}
      </div>

      {filteredRecords.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: '60px 0' }}>
          <div style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📭</div>
          <div>暂无历史记录</div>
        </div>
      ) : (
        filteredRecords.map(record => {
          const topPlayer = record.finalScores[0];
          const topName = topPlayer ? record.roomSnapshot.players.find(p => p.playerId === topPlayer.playerId)?.name : '';
          const diff = topPlayer ? topPlayer.score - record.roomSnapshot.initialScore : 0;

          return (
            <div key={record.recordId} className="card clickable" onClick={() => handleViewDetail(record)}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span style={{ fontSize: '24px', marginRight: '8px' }}>
                    {record.roomSnapshot.gameType === 'mahjong' ? '🀄' : record.roomSnapshot.gameType === 'poker' ? '🃏' : '🎴'}
                  </span>
                  <div>
                    <span style={{ fontWeight: 600 }}>{record.roomSnapshot.name}</span>
                    <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>{formatDate(record.endedAt)}</span>
                  </div>
                </div>
                <span style={{ color: '#888', fontSize: '12px' }}>共{record.rounds.length}局</span>
              </div>

              <div className="flex flex-wrap gap-8 mt-8">
                {record.finalScores.slice(0, 4).map((fs, idx) => {
                  const p = record.roomSnapshot.players.find(pl => pl.playerId === fs.playerId);
                  if (!p) return null;
                  const scoreDiff = fs.score - record.roomSnapshot.initialScore;
                  return (
                    <div key={fs.playerId} className="score-tag">
                      {idx + 1}.{p.name} {scoreDiff >= 0 ? '+' : ''}{scoreDiff}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mt-8">
                <span style={{ fontSize: '12px', color: '#52c41a' }}>🏆 {topName} {diff >= 0 ? '+' : ''}{diff}</span>
                <div className="flex gap-8">
                  <span style={{ color: '#FF6B6B', fontSize: '12px', cursor: 'pointer' }} onClick={e => handleDelete(e, record.recordId)}>删除</span>
                  <span style={{ color: '#888', fontSize: '12px' }}>查看详情 →</span>
                </div>
              </div>
            </div>
          );
        })
      )}

      <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => navigateTo('index')}>
        🏠 返回首页
      </button>
    </div>
  );
}
