<template>
  <div class="container" style="padding-top: 32px">
    <div style="font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 16px">📋 战局详情</div>

    <div v-if="!record" style="text-align: center; margin-top: 100px">
      <div>记录不存在</div>
      <button class="btn btn-secondary" style="margin-top: 16px" @click="navigateTo('index')">返回首页</button>
    </div>

    <template v-if="record">
      <!-- Header -->
      <div class="card">
        <div class="flex justify-between items-center">
          <div>
            <div style="font-weight: 700; font-size: 18px">{{ record.roomSnapshot.name }}</div>
            <div style="font-size: 13px; color: #888; margin-top: 4px">
              {{ formatDate(record.startedAt) }} · {{ record.rounds.length }}局 · {{ gameTypeName(record.roomSnapshot.gameType) }}
            </div>
          </div>
          <span style="font-size: 28px">{{ gameTypeEmoji(record.roomSnapshot.gameType) }}</span>
        </div>
      </div>

      <!-- Players -->
      <div class="card">
        <div style="font-weight: 600; margin-bottom: 12px">👥 玩家</div>
        <div
          v-for="(fs, idx) in sortedFinalScores"
          :key="fs.playerId"
          class="player-item"
        >
          <div :class="['rank-badge', rankClass(idx + 1)]">{{ idx + 1 }}</div>
          <div class="avatar" :style="{ background: getPlayer(fs.playerId)?.avatarColor }">
            {{ getPlayer(fs.playerId)?.name?.slice(0, 1) }}
          </div>
          <div class="flex-1">
            <span style="font-weight: 600">{{ getPlayer(fs.playerId)?.name }}</span>
          </div>
          <span :style="{ fontWeight: 700, fontSize: '16px', color: scoreDiff(fs) >= 0 ? '#52c41a' : '#ff4d4f' }">
            {{ scoreDiff(fs) >= 0 ? '+' : '' }}{{ scoreDiff(fs) }}分
          </span>
        </div>
      </div>

      <!-- Rounds -->
      <div class="card">
        <div style="font-weight: 600; margin-bottom: 12px">📝 局数记录</div>
        <div
          v-for="round in record.rounds"
          :key="round.roundId"
          style="padding: 10px 0; border-bottom: 1px solid #f5f5f5"
        >
          <div class="flex justify-between items-center">
            <span style="font-weight: 600; color: #666">第{{ round.roundNumber }}局</span>
            <span style="color: #888; font-size: 13px">{{ formatTime(round.createdAt) }}</span>
          </div>
          <div class="flex flex-wrap gap-8 mt-4">
            <span style="color: #52c41a; font-size: 14px">
              🏆 {{ round.winners.map(id => getPlayer(id)?.name).join('、') }} +{{ round.amount }}
            </span>
          </div>
          <div class="flex flex-wrap gap-8 mt-2">
            <span style="color: #ff4d4f; font-size: 14px">
              💔 {{ round.losers.map(id => getPlayer(id)?.name).join('、') }} -{{ round.amount }}
            </span>
          </div>
        </div>
      </div>

      <!-- Settlements -->
      <div v-if="record.settlements.length > 0" class="card">
        <div style="font-weight: 600; margin-bottom: 12px">💰 转账明细</div>
        <div
          v-for="(s, idx) in record.settlements"
          :key="idx"
          class="flex justify-between items-center"
          style="padding: 8px 0; border-bottom: 1px solid #f0f0f0"
        >
          <span style="color: #666">
            <span style="color: #ff4d4f; font-weight: 600">{{ getPlayerName(s.from) }}</span>
            →
            <span style="color: #52c41a; font-weight: 600">{{ getPlayerName(s.to) }}</span>
          </span>
          <span style="font-weight: 700; font-size: 16px">{{ s.amount }}元</span>
        </div>
      </div>

      <button class="btn btn-secondary" style="margin-top: 16px" @click="navigateTo('history')">← 返回历史战局</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHistoryStore } from '../../store/useHistoryStore';
import { formatDate, formatTime } from '../../utils/format';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page, recordId?: string) => void;
  recordId?: string;
}

const props = defineProps<Props>();

const { records } = useHistoryStore();

const record = computed(() => {
  if (!props.recordId) return null;
  return records.find(r => r.recordId === props.recordId) || null;
});

const sortedFinalScores = computed(() => {
  if (!record.value) return [];
  return [...record.value.finalScores].sort((a, b) => b.score - a.score);
});

const players = computed(() => record.value?.roomSnapshot.players || []);

const getPlayer = (playerId: string) => players.value.find(p => p.playerId === playerId);
const getPlayerName = (playerId: string) => getPlayer(playerId)?.name || '未知';

const scoreDiff = (fs: { playerId: string; score: number }) => {
  return fs.score - (record.value?.roomSnapshot.initialScore || 0);
};

const rankClass = (rank: number) => {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-default';
};

const gameTypeName = (type: string) => {
  const map: Record<string, string> = { mahjong: '麻将', poker: '斗地主', guandan: '掼蛋', custom: '自定义' };
  return map[type] || '自定义';
};

const gameTypeEmoji = (type: string) => {
  const map: Record<string, string> = { mahjong: '🀄', poker: '🃏', guandan: '🎴' };
  return map[type] || '🎮';
};
</script>
