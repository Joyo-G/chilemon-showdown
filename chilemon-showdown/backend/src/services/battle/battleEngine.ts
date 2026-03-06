import { BattleRuntime } from "./battleHelpers";
import type { Action, ActionMove, Battle, Player } from "../../types";

const SWITCH_PRIORITY = 7;

export class BattleEngine {
  constructor(private helpers: BattleRuntime) {}

  async initializeBattle(battle: Battle) {
    for (const p of battle.players) {
      p.partyState = await this.helpers.initializePartyState(p.team);
      p.activeIndex = 0;
      p.mustSwitch = false;
    }
    battle.status = "in-progress";
    battle.turn = 1;
    battle.log.push("¡La batalla comenzó!");
  }

  async submitMove(battle: Battle, userId: string, moveId: number) {
    battle.actions.push({ kind: "move", userId, moveId });
    await this.tryResolveTurn(battle);
  }

  async submitSwitch(battle: Battle, userId: string, toIndex: number) {
    battle.actions.push({ kind: "switch", userId, toIndex });
    await this.tryResolveTurn(battle);
  }

  private async tryResolveTurn(battle: Battle) {
    const [p1, p2] = battle.players;
    if (!p1 || !p2) return;

    const action1 = battle.actions.find((a) => a.userId === p1.userId);
    const action2 = battle.actions.find((a) => a.userId === p2.userId);
    if (!action1 || !action2) return;

    await this.resolveTurn(battle, action1, action2);
    battle.actions = [];
    battle.turn += 1;
    battle.log.push(`--- Turno ${battle.turn - 1} resuelto ---`);
  }

  private async resolveTurn(battle: Battle, a1: Action, a2: Action) {
    const [p1, p2] = battle.players;
    if (!p1 || !p2) return;
    const order = await this.compareActions(p1, a1, p2, a2);

    for (const step of order) {
      const attacker = step.user === 1 ? p1 : p2;
      const defender = step.user === 1 ? p2 : p1;
      const action = step.user === 1 ? a1 : a2;

      if (battle.status === "finished") break;
      await this.executeAction(battle, attacker, defender, action);
    }
  }

  private async executeAction(
    battle: Battle,
    attacker: Player,
    defender: Player,
    action: Action,
  ) {
    if (this.helpers.isFainted(attacker) && action.kind !== "switch") return;

    if (action.kind === "switch") {
      this.helpers.onSwitchIn(attacker, action.toIndex);
      attacker.mustSwitch = false;
      battle.log.push(
        `${attacker.username} cambió a Chilemon #${action.toIndex + 1}.`,
      );
      return;
    }

    await this.helpers.ensureMovesLoaded();
    const move = this.helpers.getMoveData((action as ActionMove).moveId);

    if (move.damage_class === "status") {
      this.helpers.applyStatusMove(attacker, defender, move, battle.log);
      return;
    }

    let baseAcc = 90;
    const atkState = this.helpers.getActiveStateOrThrow(attacker);
    const defState = this.helpers.getActiveStateOrThrow(defender);

    if (
      !this.helpers.rollToHit(
        baseAcc,
        atkState.stages.acc ?? 0,
        defState.stages.eva ?? 0,
      )
    ) {
      battle.log.push(`${attacker.username} usó ${move.name} pero falló.`);
      return;
    }

    const damage = await this.helpers.applyDamage(attacker, defender, move);
    defState.currentHP = Math.max(0, defState.currentHP - damage);
    battle.log.push(
      `${attacker.username} usó ${move.name} e hizo ${damage} de daño.`,
    );

    if (defState.currentHP <= 0) {
      battle.log.push(`${defender.username}'s Chilemon se debilitó.`);
      defState.currentHP = 0;

      if (!this.helpers.hasAvailableMon(defender)) {
        battle.status = "finished";
        battle.winner = attacker.userId;
        battle.log.push(`${attacker.username} gana la batalla!`);
      } else {
        defender.mustSwitch = true;
        battle.log.push(`${defender.username} debe cambiar de Chilemon.`);
      }
    }
  }

  private async compareActions(p1: Player, a1: Action, p2: Player, a2: Action) {
    await this.helpers.ensureMovesLoaded();
    const key = async (p: Player, a: Action) => {
      if (a.kind === "switch") return { pri: SWITCH_PRIORITY, spe: 0 };
      const move = this.helpers.getMoveData((a as ActionMove).moveId);
      const spe = await this.helpers.getStat(p, "spe");
      return { pri: move.priority ?? 0, spe };
    };

    const k1 = await key(p1, a1);
    const k2 = await key(p2, a2);

    if (k1.pri !== k2.pri)
      return k1.pri > k2.pri
        ? [{ user: 1 }, { user: 2 }]
        : [{ user: 2 }, { user: 1 }];
    if (k1.spe !== k2.spe)
      return k1.spe > k2.spe
        ? [{ user: 1 }, { user: 2 }]
        : [{ user: 2 }, { user: 1 }];
    return Math.random() < 0.5
      ? [{ user: 1 }, { user: 2 }]
      : [{ user: 2 }, { user: 1 }];
  }
}
