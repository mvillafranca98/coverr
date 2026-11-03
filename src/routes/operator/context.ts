import type { Bindings as AdminBindings } from "../admin/context";

export type Bindings = AdminBindings & {
  /** Who may sign in to /operador. See `lib/operator.ts`. */
  OPERATOR_EMAILS?: string[];
};

/** Set by the operator gate; every handler below it can rely on it. */
export type Vars = { operatorEmail: string };

export type OperatorEnv = { Bindings: Bindings; Variables: Vars };
