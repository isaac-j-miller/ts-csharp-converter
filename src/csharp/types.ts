export type GenericParam = {
  constraint?: string;
};

export type ConstructorParam = {
  name: string;
  type: string;
};

export type PropertyValue = {
  value: string;
  isDictionary?: boolean;
  optional: boolean;
};

export type CSharpElementKind = "class" | "enum" | "namespace" | "struct";

export type CSharpAccessLevel = "private" | "protected" | "public";
export const cSharpPrimitives = [
  "string",
  "double",
  "bool",
  "object",
  "int",
  "null",
] as const;
export type CSharpPrimitiveType = typeof cSharpPrimitives[number];

export type CSharpProperty = {
  name: string;
  accessLevel: CSharpAccessLevel;
  getter: boolean;
  setter: boolean;
  optional: boolean;
  isConst: boolean;
  defaultValue?: string;
  kind: CSharpPrimitiveType | string;
  commentString?: string;
};
export const TAB_WIDTH = 4;
