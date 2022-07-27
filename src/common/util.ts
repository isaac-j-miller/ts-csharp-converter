export function assertNever(t: never): asserts t is never {
  throw new Error("AssertNever");
}
