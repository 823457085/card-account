<template>
  <div class="container" style="padding-top: 32px">
    <div style="font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 16px">📊 历史战局</div>

    <!-- Filter tabs -->
    <div class="flex gap-8 mb-16">
      <div
        v-for="f in filters"
        :key="f.value"
        :class="['filter-tab', { active: filter === f.value }]"
        @click="filter = f.value"
      >
        {{ f.label }}
      </div>
    </div>

    <div v-if="filteredRecords.length === 0" style="text-align: center; color: #888; padding: 60px 0">
      <div style="font-size: 48px; display: block; margin-bottom: 16px">📭</div>
      <div>暂无历史记录</div>
    </div>

    <div v-for="record in filteredRecords" :key="record.recordId" class="card clickable" @click="handleViewDetail(record)">
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <span style="font-size: 24px; margin-right: 8px">
            {{ gameTypeEmoji(record.roomSnapshot.gameType) }}
          </span>
          <div>
            <span style="font-weight: 600">{{ record.roomSnapshot.name }}</span>
            <span style="font-size: 12px; color: #888; margin-left: 8px">{{ formatDate(record.endedAt) }}</span>
          </div>
        </div>
        <span style="color: #888; font-size: 12px">共{{ record.rounds.length }}局</span>
      </div>

      <div class="flex flex-wrap gap-8 mt-8">
        <div
          v-for="(fs, idx) in record.finalScores.slice(0, 4)"
          :key="fs.playerId"
          class="score-tag"
        >
          {{ idx + 1 }}.{{ getPlayerName(record, fs.playerId) }} {{ scoreDiff(record, fs) >= 0 ? '+' : '' }}{{ scoreDiff(record, fs) }}
        </div>
      </div>

      <div class="flex justify-between items-center mt-8">
        <span style="font-size: 12px; color: #52c41a">
          🏆 {{ topPlayerName(record) }} {{ topDiff(record) >= 0 ? '+' : '' }}{{ topDiff(record) }}
        </span>
        <div class="flex gap-8">
          <span style="color: #FF6B6B; font-size: 12px; cursor: pointer" @click.stop="handleDelete(record.recordId)">删除</span>
          <span style="color: #888; font-size: 12px">查看详情 →</span>
        </div>
      </div>
    </div>

    <button class="btn btn-secondary" style="margin-top: 16px" @click="navigateTo('index')">
      🏠 返回首页
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useHistoryStore } from '../../store/useHistoryStore';
import { formatDate } from '../../utils/format';
import type { GameRecord } from '../../types';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page, recordId?: string) => void;
}

const props = defineProps<Props>();

const { records, loadHistory, deleteRecord } = useHistoryStore();

const filter = ref<'all' | 'week' | 'month'>('all');

const filters = [
  { value: 'all' as const, label: '全部' },
  { value: 'week' as const, label: '本周' },
  { value: 'month' as const, label: '本月' },
];

const filteredRecords = computed(() => {
  if (filter.value === 'all') return records;
  const now = Date.now();
  const msMap = { week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };
  return records.filter(r => now - r.endedAt < msMap[filter.value]);
});

const getPlayerName = (record: GameRecord, playerId: string) => {
  return record.roomSnapshot.players.find(p => p.playerId === playerId)?.name || '';
};

const scoreDiff = (record: GameRecord, fs: { playerId: string; score: number }) => {
  return fs.score - record.roomSnapshot.initialScore;
};

const topPlayerName = (record: GameRecord) => {
  const top = record.finalScores[0];
  return top ? getPlayerName(record, top.playerId) : '';
};

const topDiff = (record: GameRecord) => {
  const top = record.finalScores[0];
  return top ? scoreDiff(record, top) : 0;
};

const gameTypeEmoji = (type: string) => {
  const map: Record<string, string> = { mahjong: '🀄', poker: '🃏', guandan: '🎴' };
  return map[type] || '🎮';
};

onMounted(() => {
  loadHistory();
});

const handleDelete = (recordId: string) => {
  if (window.confirm('确认删除这条记录？')) {
    deleteRecord(recordId);
  }
};

const handleViewDetail = (record: GameRecord) => {
  props.navigateTo('historyDetail', record.recordId);
};
</script>
