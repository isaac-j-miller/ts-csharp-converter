export const jsDocNumberTypes = [
  "decimal",
  "float",
  "double",
  "sbyte",
  "byte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
] as const;

export const primitiveTypeNames = [
  "string",
  "String",
  "number",
  "Number",
  "boolean",
  "Boolean",
  "object",
  "any",
  "undefined",
  "null",
  "unknown",
  "symbol",
  "Symbol",
  ...jsDocNumberTypes,
] as const;

export const CONSTS_KEYWORD = "__consts__" as const;
