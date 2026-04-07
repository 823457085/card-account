<template>
  <div class="container" style="padding-top: 32px">
    <div class="title">🏆 结算</div>
    <div class="subtitle">{{ record?.roomSnapshot.name }} · 共{{ record?.rounds.length }}局</div>

    <div v-if="!lastSettlement" style="text-align: center; margin-top: 100px">
      <div>无结算数据</div>
      <button class="btn btn-secondary" style="margin-top: 16px" @click="navigateTo('index')">返回首页</button>
    </div>

    <template v-if="lastSettlement">
      <!-- Final Scores -->
      <div class="card">
        <span style="font-weight: 600; margin-bottom: 12px; display: block">📊 最终排名</span>
        <div
          v-for="(fs, idx) in lastSettlement.finalScores"
          :key="fs.playerId"
          class="player-item"
        >
          <div :class="['rank-badge', rankClass(idx + 1)]">
            {{ idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1 }}
          </div>
          <div class="avatar" :style="{ background: getPlayer(fs.playerId)?.avatarColor }">
            {{ getPlayer(fs.playerId)?.name?.slice(0, 1) }}
          </div>
          <div class="flex-1">
            <span style="font-weight: 600">{{ getPlayer(fs.playerId)?.name }}</span>
          </div>
          <span style="font-weight: 700; font-size: 18px; color: scoreDiff(fs) >= 0 ? '#52c41a' : '#ff4d4f'">
            {{ scoreDiff(fs) >= 0 ? '+' : '' }}{{ scoreDiff(fs) }}
          </span>
        </div>
      </div>

      <!-- Settlements -->
      <div v-if="lastSettlement.settlements.length > 0" class="card">
        <span style="font-weight: 600; margin-bottom: 12px; display: block">💰 转账明细</span>
        <div
          v-for="(s, idx) in lastSettlement.settlements"
          :key="idx"
          class="flex justify-between items-center"
          style="padding: 8px 0; border-bottom: 1px solid #f0f0f0"
        >
          <span style="color: #666">
            <span style="color: #ff4d4f; font-weight: 600">{{ getPlayerName(s.from) }}</span>
            →
            <span style="color: #52c41a; font-weight: 600">{{ getPlayerName(s.to) }}</span>
          </span>
          <span style="font-weight: 700; font-size: 18px">{{ s.amount }}元</span>
        </div>
      </div>

      <button class="btn btn-secondary" style="margin-top: 16px" @click="handleExport">📤 导出结果</button>

      <div class="flex gap-12 mt-16">
        <button class="btn btn-secondary" style="flex: 1" @click="navigateTo('index')">🏠 返回首页</button>
        <button class="btn btn-primary" style="flex: 1" @click="navigateTo('historyDetail', record?.recordId)">📋 查看详情</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoomStore } from '../../store/useRoomStore';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page) => void;
}

const props = defineProps<Props>();

const { lastSettlement } = useRoomStore();

const record = computed(() => lastSettlement.value?.record);
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

const handleExport = () => {
  if (!lastSettlement.value || !record.value) return;
  const lines = [
    `🏆 ${record.value.roomSnapshot.name} 结算结果`,
    `📅 ${new Date(record.value.endedAt).toLocaleDateString()}`,
    '',
    '最终排名：'
  ];
  lastSettlement.value.finalScores.forEach((fs, idx) => {
    const p = players.value.find(pl => pl.playerId === fs.playerId);
    if (p) lines.push(`${idx + 1}. ${p.name}：${fs.score}分`);
  });
  lines.push('');
  lines.push('💰 转账明细：');
  lastSettlement.value.settlements.forEach(s => {
    lines.push(`${getPlayerName(s.from)} → ${getPlayerName(s.to)}：${s.amount}元`);
  });
  const text = lines.join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
  }
};
</script>
