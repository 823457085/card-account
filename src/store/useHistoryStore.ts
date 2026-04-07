import { defineStore } from 'pinia';
import { ref } from 'vue';
import { GameRecord } from '../types';
import { storage } from '../services/storage';

export const useHistoryStore = defineStore('history', () => {
  const records = ref<GameRecord[]>([]);

  function loadHistory() {
    records.value = storage.get<GameRecord[]>('history') || [];
  }

  function deleteRecord(recordId: string) {
    records.value = records.value.filter(r => r.recordId !== recordId);
    storage.set('history', records.value);
  }

  return { records, loadHistory, deleteRecord };
});
