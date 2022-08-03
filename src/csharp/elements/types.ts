export type GenericParam = {
  constraint?: string;
};

export type PropertyValue = {
  value: string;
  isDictionary?: boolean;
  optional: boolean;
};

export type CSharpElementKind = "class" | "enum" | "namespace" | "struct";

export type CSharpAccessLevel = "private" | "protected" | "public";
export type CSharpPrimitiveType =
  | "string"
  | "double"
  | "bool"
  | "object"
  | "int"
  | "null";
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
