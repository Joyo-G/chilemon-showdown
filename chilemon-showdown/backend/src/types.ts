export type UUID = string;

export interface Ability {
  name: string;
  is_hidden: boolean;
  slot: number;
}

export interface Stat {
  name: string;
  base_value: number;
}

export interface ChileType {
  type: string;
  slot: number;
}

export interface Chilemon {
  id: number;
  name: string;
  abilities: Ability[];
  height: number;
  weight: number;
  moves: number[];
  stats: Stat[];
  types: ChileType[];
}

export interface MoveStatChange {
  stat: string;
  change: number;
}

export interface Move {
  id: number;
  name: string;
  damage_class: string;
  power: number | null;
  pp: number;
  priority: number;
  stat_changes: MoveStatChange[];
  target: string;
  type: string;
  ailment: string;
  effect_entry: string;
}

export interface User {
  id: UUID;
  username: string;
  password?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  id: UUID;
  userId: UUID;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamChilemon {
  id: UUID;
  teamId: UUID;
  chilemonId: number;
  position: number;
  nickname: string;
  level: number;
  moves: number[];
  effort: number[];
  createdAt?: string;
  updatedAt?: string;
}

export type Stage = -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Status = "none" | "brn" | "psn" | "tox" | "slp" | "par" | "frz";

export interface BattleChilemonState {
  refTeamIndex: number;
  currentHP: number;
  maxHP: number;
  status: Status;
  stages: {
    atk: Stage;
    def: Stage;
    spa: Stage;
    spd: Stage;
    spe: Stage;
    acc: Stage;
    eva: Stage;
  };
  volatile: Record<string, unknown>;
}

export interface Player {
  userId: UUID;
  username: string;
  team: TeamChilemon[];
  activeIndex: number;
  partyState: BattleChilemonState[];
  sideEffects?: Record<string, unknown>;
  mustSwitch?: boolean;
}

export type ActionKind = "move" | "switch";
export interface ActionBase {
  kind: ActionKind;
  userId: UUID;
}
export interface ActionMove extends ActionBase {
  kind: "move";
  moveId: number;
}
export interface ActionSwitch extends ActionBase {
  kind: "switch";
  toIndex: number;
}
export type Action = ActionMove | ActionSwitch;

export type BattleStatus = "waiting" | "in-progress" | "finished";

export interface Battle {
  id: UUID;
  players: Player[];
  field?: {
    weather?: {
      kind: "none" | "rain" | "sun" | "sand" | "hail";
      turnsLeft?: number;
    };
    terrain?: {
      kind: "none" | "electric" | "grassy" | "misty" | "psychic";
      turnsLeft?: number;
    };
  };
  turn: number;
  actions: Action[];
  log: string[];
  winner?: UUID;
  status: BattleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export type Variables = {
  userId?: string;
  csrf?: string;
};
