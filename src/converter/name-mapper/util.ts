import { cSharpPrimitives, CSharpPrimitiveType } from "src/csharp/";

export const capitalize = (str: string): string => {
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
