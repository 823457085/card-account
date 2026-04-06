import { create } from 'zustand';
import { GameRecord } from '../types';
import { storage } from '../services/storage';

interface HistoryState {
  records: GameRecord[];
  loadHistory: () => void;
  deleteRecord: (recordId: string) => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],

  loadHistory: () => {
    const records = storage.get<GameRecord[]>('history') || [];
    set({ records });
  },

  deleteRecord: (recordId) => {
    const records = get().records.filter(r => r.recordId !== recordId);
    set({ records });
    storage.set('history', records);
  }
}));
