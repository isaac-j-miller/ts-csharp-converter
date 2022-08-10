import { cSharpPrimitives, CSharpPrimitiveType } from "src/csharp/";
import { CasingConvention, casingConventions } from "./types";

export const capitalize = (str: string): string => {
  if (!str) {
    return "";
  }
  const [first, ...rest] = str;
  return [first.toLocaleUpperCase(), ...rest].join("");
};

export function isCSharpPrimitive(str: string): boolean {
  const bracketIndex = str.indexOf("[");
  if (bracketIndex === -1) {
    return cSharpPrimitives.includes(str as CSharpPrimitiveType);
  }
  const base = str.split("[")[0];
  return cSharpPrimitives.includes(base as CSharpPrimitiveType);
}

export function toCasingConvention<T extends string | undefined>(
  t: T
): T extends string ? CasingConvention : undefined {
  if (!t) {
    return undefined as T extends string ? CasingConvention : undefined;
  }
  for (const convention of Object.values(CasingConvention)) {
    if (typeof convention === "string") {
      continue;
    }
    if (CasingConvention[convention] === t) {
      return convention as T extends string ? CasingConvention : undefined;
    }
  }
  throw new Error(
    `Invalid Casing Convention (${t}). Must be one of ${casingConventions}`
  );
}
