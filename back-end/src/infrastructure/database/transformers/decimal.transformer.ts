import type { ValueTransformer } from "typeorm";

export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number =>
    value === null || value === undefined ? 0 : Number(value)
};
