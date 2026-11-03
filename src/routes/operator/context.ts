import type { Bindings } from "../admin/context";

export type { Bindings };

/** Set by the operator gate; every handler below it can rely on it. */
export type Vars = { operatorEmail: string };

export type OperatorEnv = { Bindings: Bindings; Variables: Vars };
