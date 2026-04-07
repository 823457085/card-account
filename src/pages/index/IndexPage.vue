<template>
  <div class="container">
    <div class="title" style="margin-top: 60px">🀄 打牌记账</div>
    <div class="subtitle">和朋友打牌，算账不扯皮</div>

    <!-- Home Mode -->
    <div v-if="mode === 'home'">
      <div class="card clickable" @click="mode = 'create'">
        <div class="flex items-center">
          <span style="font-size: 28px; margin-right: 16px">🎯</span>
          <div>
            <div style="font-size: 18px; font-weight: 600">快速开始</div>
            <div style="font-size: 14px; color: #888">创建房间，开始一局</div>
          </div>
        </div>
      </div>

      <div class="card clickable" @click="mode = 'join'">
        <div class="flex items-center">
          <span style="font-size: 28px; margin-right: 16px">📋</span>
          <div>
            <div style="font-size: 18px; font-weight: 600">加入房间</div>
            <div style="font-size: 14px; color: #888">输入房间码加入</div>
          </div>
        </div>
      </div>

      <div class="card clickable" @click="navigateTo('history')">
        <div class="flex items-center">
          <span style="font-size: 28px; margin-right: 16px">📊</span>
          <div>
            <div style="font-size: 18px; font-weight: 600">历史战局</div>
            <div style="font-size: 14px; color: #888">查看过往记录</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Mode -->
    <div v-if="mode === 'create'">
      <div class="card">
        <div class="mb-16"><span style="font-weight: 600">房间名称</span></div>
        <input class="input" v-model="roomName" placeholder="如：麻将室" />

        <div class="mt-16 mb-8"><span style="font-weight: 600">玩法</span></div>
        <div class="flex flex-wrap gap-8">
          <div
            v-for="type in gameTypes"
            :key="type.value"
            :class="['tag', { active: gameType === type.value }]"
            @click="gameType = type.value"
          >
            {{ type.emoji }} {{ type.label }}
          </div>
        </div>

        <div class="mt-16 mb-8"><span style="font-weight: 600">茶水费/局</span></div>
        <input
          class="input"
          type="number"
          v-model.number="teaFee"
          placeholder="每人每局扣的分数，默认0"
          min="0"
        />

        <div class="mt-16 mb-8"><span style="font-weight: 600">你的昵称</span></div>
        <input class="input" v-model="playerName" placeholder="4-8个字符" maxlength="8" />

        <div v-if="error" style="color: #ff4d4f; font-size: 14px; margin-top: 12px">{{ error }}</div>
      </div>

      <div class="btn btn-primary" style="margin-top: 16px" @click="handleCreate">创建房间</div>
      <div class="btn btn-secondary" style="margin-top: 12px" @click="mode = 'home'; error = ''">返回</div>
    </div>

    <!-- Join Mode -->
    <div v-if="mode === 'join'">
      <div class="card">
        <div class="mb-8"><span style="font-weight: 600">房间码</span></div>
        <input
          class="input"
          v-model="joinCode"
          @input="joinCode = joinCode.replace(/\D/g, '').slice(0, 6)"
          placeholder="6位数字"
          maxlength="6"
        />

        <div class="mt-16 mb-8"><span style="font-weight: 600">你的昵称</span></div>
        <input class="input" v-model="playerName" placeholder="4-8个字符" maxlength="8" />

        <div v-if="error" style="color: #ff4d4f; font-size: 14px; margin-top: 12px">{{ error }}</div>
      </div>

      <div class="btn btn-primary" style="margin-top: 16px" @click="handleJoin">加入房间</div>
      <div class="btn btn-secondary" style="margin-top: 12px" @click="mode = 'home'; error = ''">返回</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoomStore } from '../../store/useRoomStore';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page) => void;
}

const props = defineProps<Props>();

const mode = ref<'home' | 'create' | 'join'>('home');
const roomName = ref('麻将室');
const gameType = ref<'mahjong' | 'poker' | 'guandan' | 'custom'>('mahjong');
const playerName = ref('');
const joinCode = ref('');
const teaFee = ref(0);
const error = ref('');

const { createRoom, joinRoom } = useRoomStore();

const gameTypes = [
  { value: 'mahjong' as const, label: '麻将', emoji: '🀄' },
  { value: 'poker' as const, label: '斗地主', emoji: '🃏' },
  { value: 'guandan' as const, label: '掼蛋', emoji: '🎴' },
  { value: 'custom' as const, label: '自定义', emoji: '⚙️' },
];

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code && code.length === 6) {
    joinCode.value = code;
    mode.value = 'join';
  }
});

const handleCreate = () => {
  if (!playerName.value.trim()) { error.value = '请输入你的昵称'; return; }
  error.value = '';
  const room = createRoom({
    name: roomName.value,
    gameType: gameType.value,
    playerName: playerName.value.trim(),
    teaFee: teaFee.value
  });
  if (room) props.navigateTo('room');
};

const handleJoin = () => {
  if (!playerName.value.trim()) { error.value = '请输入你的昵称'; return; }
  if (!joinCode.value.trim()) { error.value = '请输入房间码'; return; }
  error.value = '';
  const room = joinRoom(joinCode.value.trim(), playerName.value.trim());
  if (room) props.navigateTo('room');
  else error.value = '房间不存在或已失效';
};
</script>
