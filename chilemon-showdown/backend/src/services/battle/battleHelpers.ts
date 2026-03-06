import { dbChilemon, dbMoves } from "../../db";
import type {
  BattleChilemonState,
  Move,
  Player,
  Stat,
  TeamChilemon,
} from "../../types";

export type BaseStats = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export class BattleRuntime {
  private movesById = new Map<number, Move>();
  private movesLoaded = false;

  constructor(private db: D1Database) {}

  hasAvailableMon(player: Player): boolean {
    return player.partyState.some((s) => s.currentHP > 0);
  }

  canSwitchTo(player: Player, toIndex: number) {
    const st = player.partyState[toIndex];
    return st && st.currentHP > 0 && toIndex !== player.activeIndex;
  }

  getStateOrThrow(player: Player, idx: number): BattleChilemonState {
    const st = player.partyState[idx];
    if (!st) throw new Error(`partyState[${idx}] not initialized`);
    return st;
  }

  onSwitchIn(player: Player, toIndex: number) {
    player.activeIndex = toIndex;
    const st = this.getStateOrThrow(player, toIndex);
    st.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
    st.volatile = {};
  }

  getActiveStateOrThrow(p: Player): BattleChilemonState {
    const st = p.partyState[p.activeIndex];
    if (!st) throw new Error(`Active partyState not initialized (index ${p.activeIndex})`);
    return st;
  }

  isFainted(p: Player): boolean {
    const st = this.getActiveStateOrThrow(p);
    return st.currentHP <= 0;
  }

  /* =========================================================
     INIT HELPERS
     ========================================================= */

  private async getSpeciesBaseStats(pokemonId: number): Promise<BaseStats> {
    const doc = await dbChilemon.findById(this.db, pokemonId);
    if (!doc) throw new Error(`Species not found: ${pokemonId}`);

    const byName = Object.fromEntries(doc.stats.map((s: Stat) => [s.name.toLowerCase(), s.base_value]));
    return {
      hp: byName.hp ?? 1,
      atk: byName.atk ?? 1,
      def: byName.def ?? 1,
      spa: byName.spa ?? 1,
      spd: byName.spd ?? 1,
      spe: byName.spe ?? 1,
    };
  }

  private calcStat(base: number, ev: number, level: number, isHP = false): number {
    if (isHP) return Math.floor(((2 * base + Math.floor(ev / 4)) * level) / 100) + level + 10;
    return Math.floor(((2 * base + Math.floor(ev / 4)) * level) / 100) + 5;
  }

  async initializePartyState(team: TeamChilemon[]) {
    const states: BattleChilemonState[] = [];
    for (const [i, slot] of team.entries()) {
      const base = await this.getSpeciesBaseStats(slot.chilemonId);
      const totalHP = this.calcStat(base.hp, slot.effort?.[0] ?? 0, slot.level ?? 50, true);
      states.push({
        refTeamIndex: i,
        currentHP: totalHP,
        maxHP: totalHP,
        status: "none",
        stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
        volatile: {},
      });
    }
    return states;
  }

  applyStage(value: number, stage: number): number {
    const num = stage >= 0 ? 2 + stage : 2;
    const den = stage >= 0 ? 2 : 2 - stage;
    return Math.floor(value * (num / den));
  }

  async getStat(player: Player, statName: keyof BaseStats): Promise<number> {
    const st = this.getStateOrThrow(player, player.activeIndex);
    const teamSlot = player.team[st.refTeamIndex];
    if (!teamSlot) throw new Error(`team[${st.refTeamIndex}] not initialized`);

    const base = await this.getSpeciesBaseStats(teamSlot.chilemonId);
    const idxMap: Record<keyof BaseStats, number> = { hp: 0, atk: 1, def: 2, spa: 3, spd: 4, spe: 5 };

    const evIndex = idxMap[statName];
    const ev = teamSlot.effort?.[evIndex] ?? 0;
    const level = teamSlot.level ?? 50;

    const isHP = statName === "hp";
    const raw = this.calcStat(base[statName], ev, level, isHP);

    if (!isHP) {
      return this.applyStage(raw, st.stages[statName]);
    }
    return raw;
  }

  /* =========================================================
     MOVES CACHE
     ========================================================= */

  private async loadMovesFromDB() {
    if (this.movesLoaded) return;
    const moves = await dbMoves.listAll(this.db);
    for (const m of moves) {
      this.movesById.set(m.id, m);
    }
    this.movesLoaded = true;
    console.log(`Moves cache loaded: ${this.movesById.size} moves.`);
  }

  async ensureMovesLoaded(): Promise<void> {
    if (!this.movesLoaded) {
      await this.loadMovesFromDB();
    }
  }

  getMoveData(moveId: number): Move {
    const move = this.movesById.get(moveId);
    if (!move) throw new Error(`Move ID ${moveId} not found`);
    return move;
  }

  /* =========================================================
     DAMAGE & STATUS
     ========================================================= */

  getTeamSlotOrThrow(p: Player, idx: number): TeamChilemon {
    if (idx < 0 || idx >= p.team.length) {
      throw new Error(`team index out of range: ${idx}`);
    }
    const slot = p.team[idx];
    if (!slot) throw new Error(`team[${idx}] missing`);
    return slot;
  }

  async applyDamage(attacker: Player, defender: Player, move: Move): Promise<number> {
    const atkState = this.getActiveStateOrThrow(attacker);
    const defState = this.getActiveStateOrThrow(defender);

    const atkSlot = this.getTeamSlotOrThrow(attacker, atkState.refTeamIndex);
    const defSlot = this.getTeamSlotOrThrow(defender, defState.refTeamIndex);

    const atkRaw = await this.getStat(attacker, move.damage_class === "physical" ? "atk" : "spa");
    const defRaw = await this.getStat(defender, move.damage_class === "physical" ? "def" : "spd");

    const level = atkSlot.level ?? 50;
    const power = move.power ?? 0;

    const atkEff = this.applyStage(atkRaw, move.damage_class === "physical" ? atkState.stages.atk : atkState.stages.spa);
    const defEff = this.applyStage(defRaw, move.damage_class === "physical" ? defState.stages.def : defState.stages.spd);

    const damage = Math.floor((((2 * level) / 5 + 2) * power * atkEff) / Math.max(1, defEff) / 50 + 2);
    return Math.max(1, damage);
  }

  applyStatusMove(user: Player, target: Player, move: Move, battleLog: string[]) {
    if (move.stat_changes && move.stat_changes.length > 0) {
      const actor = move.target === "user" ? user : target;
      const active = this.getActiveStateOrThrow(actor);
      for (const { stat, change } of move.stat_changes) {
        if (stat in active.stages) {
          const current = (active.stages as any)[stat] as number;
          (active.stages as any)[stat] = clamp(current + change, -6, 6);
          battleLog.push(
            `${actor.username}'s ${stat.toUpperCase()} ${change > 0 ? "increased" : "decreased"} by ${Math.abs(change)} stage(s)!`
          );
        }
      }
    }

    switch (move.name.toLowerCase()) {
      case "recover": {
        const healMon = this.getActiveStateOrThrow(user);
        const healAmount = Math.floor(healMon.currentHP * 0.5);
        healMon.currentHP = Math.min(healMon.currentHP + healAmount, healMon.maxHP);
        battleLog.push(`${user.username}'s Chilemon regained some HP!`);
        break;
      }
      case "reflect": {
        user.sideEffects = user.sideEffects || {};
        user.sideEffects.reflect = 5;
        battleLog.push(`${user.username} set up Reflect!`);
        break;
      }
      case "light-screen": {
        user.sideEffects = user.sideEffects || {};
        user.sideEffects.lightScreen = 5;
        battleLog.push(`${user.username} set up Light Screen!`);
        break;
      }
      default:
        break;
    }
  }

  /* =========================================================
     ACCURACY HELPERS
     ========================================================= */

  private accuracyMultiplier(userAccStage: number, targetEvaStage: number): number {
    const stageMulAccEva = (stage: number): number => {
      const s = clamp(Math.trunc(stage), -6, 6);
      const num = s >= 0 ? 3 + s : 3;
      const den = s >= 0 ? 3 : 3 - s;
      return num / den;
    };
    const acc = stageMulAccEva(userAccStage);
    const eva = stageMulAccEva(targetEvaStage);
    return acc / eva;
  }

  rollToHit(baseAccuracy: number | null | undefined, userAccStage: number, targetEvaStage: number): boolean {
    if (baseAccuracy == null) return true;
    const eff = Math.max(0, Math.min(100, baseAccuracy * this.accuracyMultiplier(userAccStage, targetEvaStage)));
    return Math.random() * 100 < eff;
  }
}
