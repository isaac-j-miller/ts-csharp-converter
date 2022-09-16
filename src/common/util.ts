export function assertNever(t: never): asserts t is never {
  throw new Error(`AssertNever: value ${t} should be never`);
}

export const capitalize = (str: string): string => {
  if (!str) {
    return "";
  }
  const [first, ...rest] = str;
  return [first.toLocaleUpperCase(), ...rest].join("");
};
