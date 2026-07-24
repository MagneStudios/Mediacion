export type IaKey = "ia_modelo" | "ia_temperature" | "ia_max_tokens";

export type UpdateIaConfigDto = {
  ia_modelo?: string;
  ia_temperature?: number;
  ia_max_tokens?: number;
};

export type IaConfigResult = { updated: IaKey[] };
