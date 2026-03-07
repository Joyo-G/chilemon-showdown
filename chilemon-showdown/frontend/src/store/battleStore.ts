import { create } from "zustand";
import type { BattleSummary } from "../services/battle";
import { getUserBattles, createBattle, getBattle } from "../services/battle";

type BattleState = {
  activeBattles: BattleSummary[];
  currentBattle?: BattleSummary;
  loading: boolean;
  error?: string;
  fetchUserBattles: (userId: string) => Promise<void>;
  createNewBattle: (userId: string, teamId: string) => Promise<BattleSummary>;
  fetchBattle: (battleId: string, userId?: string) => Promise<void>;
  getActiveBattles: () => BattleSummary[];
  getPendingBattles: () => BattleSummary[];
  getFinishedBattles: () => BattleSummary[];
  clearError: () => void;
};

export const useBattleStore = create<BattleState>((set, get) => ({
  activeBattles: [],
  currentBattle: undefined,
  loading: false,
  error: undefined,

  fetchUserBattles: async (userId: string) => {
    try {
      set({ loading: true, error: undefined });
      const battles = await getUserBattles(userId);
      set({
        activeBattles: Array.isArray(battles) ? battles : [],
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error?.message ?? "Error al cargar las batallas",
        loading: false,
      });
    }
  },

  createNewBattle: async (userId: string, teamId: string) => {
    try {
      set({ loading: true, error: undefined });
      const newBattle = await createBattle(userId, teamId);
      set((state) => ({
        activeBattles: [...state.activeBattles, newBattle],
        currentBattle: newBattle,
        loading: false,
      }));
      return newBattle;
    } catch (error: any) {
      set({
        error: error?.message ?? "Error al crear la batalla",
        loading: false,
      });
      throw error;
    }
  },

  fetchBattle: async (battleId: string, userId?: string) => {
    try {
      set({ loading: true, error: undefined });
      const battle = await getBattle(battleId, userId);
      set({
        currentBattle: battle,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error?.message ?? "Error al cargar la batalla",
        loading: false,
      });
    }
  },

  getActiveBattles: () => {
    const { activeBattles } = get();
    return activeBattles.filter((b) => b.status === "in-progress");
  },

  getPendingBattles: () => {
    const { activeBattles } = get();
    return activeBattles.filter((b) => b.status === "waiting");
  },

  getFinishedBattles: () => {
    const { activeBattles } = get();
    return activeBattles.filter((b) => b.status === "finished");
  },

  clearError: () => set({ error: undefined }),
}));
