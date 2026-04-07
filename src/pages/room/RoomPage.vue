<template>
  <div class="container">
    <!-- Header -->
    <div class="flex justify-between items-center" style="margin-bottom: 16px; margin-top: 16px">
      <div style="font-size: 20px; font-weight: 700">{{ room?.name }}</div>
      <div class="flex items-center gap-8 clickable" @click="copyRoomCode" title="点击复制">
        <span style="font-size: 14px; color: #888">房间码</span>
        <span style="background: #f0f0f0; padding: 4px 12px; border-radius: 4px; font-weight: 700; letter-spacing: 2px">{{ room?.roomId }}</span>
      </div>
    </div>

    <!-- No Room -->
    <div v-if="!room" class="container" style="text-align: center; margin-top: 100px">
      <div>房间不存在，<span style="color: #FF6B6B; cursor: pointer" @click="navigateTo('index')">返回首页</span></div>
    </div>

    <template v-if="room">
      <!-- QR Code Section -->
      <div class="card" style="margin-bottom: 12px; padding: 16px">
        <div class="flex justify-between items-center">
          <span style="font-weight: 600">📱 邀请加入</span>
          <span class="clickable" style="font-size: 14px; color: #1890ff" @click="showQR = !showQR">
            {{ showQR ? '收起二维码' : '显示二维码' }}
          </span>
        </div>
        <div v-if="showQR" style="display: flex; flex-direction: column; align-items: center; margin-top: 12px; gap: 8px">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="房间二维码" style="width: 200px; height: 200px; border: 1px solid #eee; border-radius: 8px" />
          <div v-else style="width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; border-radius: 8px">生成中...</div>
          <div style="font-size: 13px; color: #888; text-align: center">
            扫码加入 · 房间码 <strong>{{ room.roomId }}</strong>
          </div>
        </div>
      </div>

      <!-- Tea Fee Section -->
      <div class="card" style="margin-bottom: 12px; padding: 12px 16px">
        <div class="flex justify-between items-center">
          <span style="font-size: 14px">🍵 茶水费：<strong>{{ room.teaFee || 0 }}</strong> 分/局</span>
          <span class="clickable" style="font-size: 14px; color: #1890ff" @click="toggleTeaFeeEdit">
            {{ editingTeaFee ? '取消' : '修改' }}
          </span>
        </div>
        <div v-if="editingTeaFee" class="flex items-center gap-8" style="margin-top: 8px">
          <input class="input" type="number" v-model.number="teaFeeInput" min="0" style="flex: 1" />
          <button class="btn btn-primary" style="padding: 8px 16px; font-size: 14px" @click="handleSaveTeaFee">保存</button>
        </div>
      </div>

      <!-- Players horizontal avatar bar -->
      <div class="card" style="margin-bottom: 12px">
        <div class="flex justify-between items-center mb-8">
          <span style="font-weight: 600">👥 {{ room.players.length }}人</span>
          <span style="font-size: 12px; color: #888">第{{ room.rounds.length + 1 }}局</span>
        </div>
        <div style="display: flex; justify-content: space-around; gap: 8px; flex-wrap: wrap">
          <div
            v-for="player in room.players"
            :key="player.playerId"
            style="display: flex; flex-direction: column; align-items: center; min-width: 60px; max-width: 80px"
          >
            <div
              class="avatar"
              :style="{
                background: player.avatarColor,
                width: '44px',
                height: '44px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }"
            >
              {{ player.name.slice(0, 1) }}
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 4px; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap" :title="player.name">
              {{ player.name }}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: (player.currentScore - room.initialScore) >= 0 ? '#52c41a' : '#ff4d4f'; margin-top: 2px">
              {{ (player.currentScore - room.initialScore) >= 0 ? '+' : '' }}{{ player.currentScore - room.initialScore }}
            </div>
          </div>
        </div>
      </div>

      <!-- Add player -->
      <div v-if="room.players.length < 8" class="flex items-center gap-8 mt-8">
        <input
          class="input"
          style="flex: 1"
          v-model="newPlayerName"
          placeholder="新玩家昵称"
          maxlength="8"
          @keydown.enter="handleAddPlayer"
        />
        <button class="btn btn-secondary" style="padding: 8px 16px; font-size: 14px" @click="handleAddPlayer">添加</button>
      </div>

      <!-- Score Panel -->
      <div class="card">
        <div style="font-weight: 600; margin-bottom: 12px">📝 记牌区</div>

        <div style="margin-bottom: 16px">
          <div style="font-size: 14px; color: #888; margin-bottom: 8px">选择赢家</div>
          <div class="flex flex-wrap gap-8">
            <div
              v-for="p in room.players"
              :key="p.playerId"
              :class="['player-tag', { selected: winners.includes(p.playerId) }]"
              @click="toggleWinner(p.playerId)"
            >
              {{ p.name }}
            </div>
          </div>
        </div>

        <div style="margin-bottom: 16px">
          <div style="font-size: 14px; color: #888; margin-bottom: 8px">选择输家</div>
          <div class="flex flex-wrap gap-8">
            <div
              v-for="p in room.players"
              :key="p.playerId"
              :class="['player-tag loser-tag', { selected: losers.includes(p.playerId) }]"
              @click="toggleLoser(p.playerId)"
            >
              {{ p.name }}
            </div>
          </div>
        </div>

        <div style="margin-bottom: 16px">
          <div style="font-size: 14px; color: #888; margin-bottom: 8px">金额</div>
          <div class="flex flex-wrap gap-8">
            <div
              v-for="a in amounts"
              :key="a"
              :class="['amount-tag', { selected: !showCustom && amount === a }]"
              @click="amount = a; showCustom = false"
            >
              {{ a }}元
            </div>
            <div
              :class="['amount-tag', { selected: showCustom }]"
              @click="showCustom = true"
            >
              自定义
            </div>
          </div>
          <input
            v-if="showCustom"
            class="input"
            style="margin-top: 8px"
            v-model="customAmount"
            @input="customAmount = customAmount.replace(/\D/g, '')"
            placeholder="输入金额"
          />
        </div>

        <div class="flex gap-12">
          <button
            :class="['btn', winners.length > 0 && losers.length > 0 ? 'btn-success' : 'btn-secondary']"
            style="flex: 1"
            @click="handleRecord"
          >
            ✅ 确认记牌
          </button>
          <button v-if="room.rounds.length > 0" class="btn btn-secondary" @click="handleUndo" style="padding: 12px 16px">
            ↩️ 撤销
          </button>
        </div>
      </div>

      <!-- Real-time Settlement -->
      <div v-if="room.rounds.length > 0" class="card">
        <div class="flex justify-between items-center clickable" @click="showPending = !showPending">
          <span style="font-weight: 600">📐 实时算账</span>
          <span style="font-size: 14px; color: #1890ff">{{ showPending ? '收起' : '查看' }}</span>
        </div>
        <div v-if="showPending">
          <template v-if="pendingSettlements.length === 0">
            <div style="margin-top: 12px; color: #888; font-size: 14px">暂无待结算转账（所有人分数一致）</div>
          </template>
          <template v-else>
            <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px">
              <div style="font-size: 13px; color: #888">当前累计应付转账（结算前随时可见）</div>
              <div
                v-for="(item, idx) in pendingSettlements"
                :key="idx"
                style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8f8f8; border-radius: 6px; font-size: 14px"
              >
                <div style="display: flex; align-items: center; gap: 6px">
                  <span style="font-weight: 600; color: #ff4d4f">{{ getPlayerName(item.from) }}</span>
                  <span style="color: #888">付</span>
                  <span style="font-weight: 600; color: #52c41a">{{ getPlayerName(item.to) }}</span>
                </div>
                <span style="font-weight: 700; color: #333; font-size: 16px">¥{{ item.amount % 1 === 0 ? item.amount : item.amount.toFixed(2) }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-12 mt-16">
        <button class="btn btn-secondary" style="flex: 1" @click="navigateTo('index')">🏠 首页</button>
        <button
          :class="['btn', room.rounds.length > 0 ? 'btn-primary' : 'btn-secondary']"
          style="flex: 1"
          @click="room.rounds.length > 0 && handleSettle()"
        >
          📊 结算
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoomStore } from '../../store/useRoomStore';
import { calculateSettlements } from '../../services/settlement';

type Page = 'index' | 'room' | 'settlement' | 'history' | 'historyDetail';

interface Props {
  navigateTo: (page: Page) => void;
}

const props = defineProps<Props>();

const store = useRoomStore();
const room = computed(() => store.currentRoom);

const { recordRound, undoRound, settleRoom, addPlayer, updateTeaFee } = store;

const winners = ref<string[]>([]);
const losers = ref<string[]>([]);
const amount = ref(1);
const customAmount = ref('');
const showCustom = ref(false);
const newPlayerName = ref('');
const showQR = ref(false);
const qrDataUrl = ref('');
const editingTeaFee = ref(false);
const teaFeeInput = ref(0);
const showPending = ref(false);

const amounts = [1, 2, 5, 10, 20, 50];

const pendingSettlements = computed(() => {
  if (!room.value) return [];
  return calculateSettlements(room.value.players, room.value.initialScore);
});

const getPlayerName = (playerId: string) => {
  return room.value?.players.find(p => p.playerId === playerId)?.name || playerId;
};

onMounted(() => {
  if (showQR.value && room.value) {
    import('qrcode').then(({ default: QRCode }) => {
      const url = `${window.location.origin}/join?code=${room.value!.roomId}`;
      QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setQrDataUrl);
    });
  }
});

watch(showQR, (val) => {
  if (val && room.value) {
    import('qrcode').then(({ default: QRCode }) => {
      const url = `${window.location.origin}/join?code=${room.value!.roomId}`;
      QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setQrDataUrl);
    });
  }
});

const toggleWinner = (id: string) => {
  winners.value = winners.value.includes(id) ? winners.value.filter(w => w !== id) : [...winners.value, id];
};

const toggleLoser = (id: string) => {
  losers.value = losers.value.includes(id) ? losers.value.filter(l => l !== id) : [...losers.value, id];
};

const handleRecord = () => {
  if (winners.value.length === 0 || losers.value.length === 0) return;
  const finalAmount = showCustom.value && customAmount.value ? parseInt(customAmount.value) : amount.value;
  if (!finalAmount || finalAmount <= 0) return;
  recordRound({ roomId: room.value!.roomId, winners: winners.value, losers: losers.value, amount: finalAmount });
  winners.value = [];
  losers.value = [];
  customAmount.value = '';
  showCustom.value = false;
  amount.value = 1;
};

const handleUndo = () => {
  if (!room.value) return;
  undoRound(room.value.roomId);
};

const handleSettle = () => {
  if (!room.value) return;
  const result = settleRoom(room.value.roomId);
  if (result) props.navigateTo('settlement');
};

const handleAddPlayer = () => {
  if (!newPlayerName.value.trim() || !room.value) return;
  addPlayer(room.value.roomId, newPlayerName.value.trim());
  newPlayerName.value = '';
};

const toggleTeaFeeEdit = () => {
  if (!room.value) return;
  teaFeeInput.value = room.value.teaFee || 0;
  editingTeaFee.value = !editingTeaFee.value;
};

const handleSaveTeaFee = () => {
  if (!room.value) return;
  updateTeaFee(room.value.roomId, Math.max(0, teaFeeInput.value));
  editingTeaFee.value = false;
};

const copyRoomCode = () => {
  if (!room.value) return;
  navigator.clipboard.writeText(room.value.roomId).then(() => {
    alert('房间码已复制');
  });
};
</script>
