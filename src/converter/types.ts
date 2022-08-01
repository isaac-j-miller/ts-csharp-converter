import { Symbol, Type } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";

export type TokenType =
  | "Type"
  | "Alias"
  | "StringUnion"
  | "Interface"
  | "Enum"
  | "Primitive"
  | "Dictionary"
  | "Const";
const primitiveTypeNames = [
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
] as const;
export type LiteralValue =
  | string
  | boolean
  | number
  | undefined
  | null
  | LiteralValue[];
export type PrimitiveTypeName = typeof primitiveTypeNames[number];

export type UnionMember = {
  name: string;
  value?: number;
};

export type GenericReference = {
  isGenericReference: true;
  genericParamName: string;
};
export type TypeReference =
  | Symbol
  | PrimitiveType
  | GenericReference
  | ISyntheticSymbol
  | ConstType;
export type PropertyStructure = {
  propertyName: string;
  baseType: TypeReference;
  isArray: boolean;
  arrayDepth?: number;
  isOptional: boolean;
  genericParameters?: string[];
  defaultLiteralValue?: LiteralValue;
};

export type GenericParameter = {
  name: string;
  constraint?: TypeReference;
};

export type TypeStructure<T extends TokenType> = {
  tokenType: T;
  name: string;
  unionMembers?: UnionMember[];
  properties?: Record<string, PropertyStructure>;
  genericParameters?: GenericParameter[];
  mappedIndexType?: string;
  mappedValueType?: string;
};

export type PrimitiveType = {
  isPrimitiveType: true;
  primitiveType: PrimitiveTypeName;
};

export type ConstType = {
  isConstType: true;
};

export interface ISyntheticSymbol {
  getDeclaredType(): Type;
  getName(): string;
  isAlias(): false;
  getUnderlyingSymbol(): Symbol | undefined;
  getSourceFilePath(): string | undefined;
  id: string;
  isSynthetic: true;
}

export interface IRegistryType<T extends TokenType = TokenType> {
  readonly tokenType: T;
  readonly shouldBeRendered: boolean;
  isPublic(): boolean;
  getLevel(): number;
  getStructure(): TypeStructure<T>;
  getHash(): string;
  getPropertyString(genericParameterValues?: string[]): string;
  getSymbol(): Exclude<TypeReference, GenericReference>;
  getCSharpElement(): CSharpElement;
  getType(): Type | undefined;
  rename(name: string): void;
  getOriginalName(): string;
}

export type RegistryKey = Symbol | ISyntheticSymbol;

export function isPrimitiveType(t: unknown): t is PrimitiveType {
  return !!(t as PrimitiveType).isPrimitiveType;
}
export function isPrimitiveTypeName(str: unknown): str is PrimitiveTypeName {
  if (typeof str !== "string") {
    return false;
  }
  return primitiveTypeNames.includes(str as PrimitiveTypeName);
}
export function isGenericReference(t: unknown): t is GenericReference {
  return !!(t as GenericReference).isGenericReference;
}

export function isSyntheticSymbol(t: unknown): t is ISyntheticSymbol {
  return !!(t as ISyntheticSymbol).isSynthetic;
}

export function isConstType(t: unknown): t is ConstType {
  return !!(t as ConstType).isConstType;
}
