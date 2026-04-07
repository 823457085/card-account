<template>
  <view class="app-container">
    <IndexPage v-if="currentPage === 'index'" :navigate-to="navigateTo" />
    <RoomPage v-else-if="currentPage === 'room'" :navigate-to="navigateTo" />
    <SettlementPage v-else-if="currentPage === 'settlement'" :navigate-to="navigateTo" />
    <HistoryPage v-else-if="currentPage === 'history'" :navigate-to="navigateTo" />
    <HistoryDetailPage v-else-if="currentPage === 'historyDetail'" :navigate-to="navigateTo" :record-id="historyDetailId || undefined" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import IndexPage from './pages/index/IndexPage.vue';
import RoomPage from './pages/room/RoomPage.vue';
import SettlementPage from './pages/settlement/SettlementPage.vue';
import HistoryPage from './pages/history/HistoryPage.vue';
import HistoryDetailPage from './pages/history-detail/HistoryDetailPage.vue';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

const currentPage = ref<Page>('index');
const historyDetailId = ref<string | null>(null);

const navigateTo = (page: Page, recordId?: string) => {
  currentPage.value = page;
  if (page === 'historyDetail' && recordId) {
    historyDetailId.value = recordId;
  }
};
</script>

<style>
@import './styles/global.scss';

.app-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 0;
}

.container {
  padding: 16px;
}

.title {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #888;
  text-align: center;
  margin-bottom: 24px;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.flex-1 {
  flex: 1;
}

.flex-wrap {
  flex-wrap: wrap;
}

.gap-8 {
  gap: 8px;
}

.gap-12 {
  gap: 12px;
}

.mt-4 { margin-top: 4px; }
.mt-8 { margin-top: 8px; }
.mt-12 { margin-top: 12px; }
.mt-16 { margin-top: 16px; }
.mb-8 { margin-bottom: 8px; }
.mb-12 { margin-bottom: 12px; }
.mb-16 { margin-bottom: 16px; }
.ml-4 { margin-left: 4px; }
.mr-8 { margin-right: 8px; }
.px-16 { padding-left: 16px; padding-right: 16px; }
.py-12 { padding-top: 12px; padding-bottom: 12px; }

.clickable {
  cursor: pointer;
}

.clickable:active {
  opacity: 0.7;
}

.input {
  width: 100%;
  height: 44px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 16px;
  box-sizing: border-box;
  outline: none;
  background: #fff;
}

.input:focus {
  border-color: #4ECDC4;
}

.btn {
  height: 48px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: linear-gradient(135deg, #4ECDC4, #44A08D);
  color: #fff;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-success {
  background: linear-gradient(135deg, #52c41a, #389e0d);
  color: #fff;
}

.btn-danger {
  background: linear-gradient(135deg, #ff4d4f, #cf1322);
  color: #fff;
}

.tag {
  padding: 8px 16px;
  border-radius: 20px;
  background: #f0f0f0;
  font-size: 14px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.tag.active {
  background: #e6f7ff;
  border-color: #4ECDC4;
  color: #4ECDC4;
}

.player-tag {
  padding: 8px 16px;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  color: #333;
}

.player-tag.selected {
  background: #fff1f0;
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.player-tag.loser-tag.selected {
  background: #f5f5f5;
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.amount-tag {
  padding: 8px 16px;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.amount-tag.selected {
  background: #e6f7ff;
  border-color: #4ECDC4;
  color: #4ECDC4;
  font-weight: 600;
}

.player-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.player-item:last-child {
  border-bottom: none;
}

.rank-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  margin-right: 10px;
  flex-shrink: 0;
}

.rank-1 { background: #fff1f0; color: #fa8c16; }
.rank-2 { background: #f9f9f9; color: #8c8c8c; }
.rank-3 { background: #fff7e6; color: #ad6800; }
.rank-default { background: #f5f5f5; color: #666; }

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  margin-right: 10px;
  flex-shrink: 0;
}

.score-tag {
  padding: 4px 10px;
  border-radius: 4px;
  background: #f5f5f5;
  font-size: 12px;
  color: #666;
}

.result-tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.result-tag.winner {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.result-tag.loser {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.filter-tab {
  padding: 8px 20px;
  border-radius: 20px;
  background: #f0f0f0;
  font-size: 14px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.filter-tab.active {
  background: #4ECDC4;
  color: #fff;
}
</style>
