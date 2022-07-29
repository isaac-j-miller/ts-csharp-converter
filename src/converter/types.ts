import { Symbol, Type } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";

export type TokenType =
  | "Type"
  | "Alias"
  | "StringUnion"
  | "Interface"
  | "Enum"
  | "Primitive"
  | "Dictionary";
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
  | ISyntheticSymbol;
export type PropertyStructure = {
  propertyName: string;
  baseType: TypeReference; // TODO: change this or make it reference a specific type
  isArray: boolean;
  isOptional: boolean;
  genericParameters?: string[];
};

export type TypeStructure<T extends TokenType> = {
  tokenType: T;
  name: string;
  unionMembers?: UnionMember[];
  properties?: Record<string, PropertyStructure>;
  genericParameters?: string[];
  mappedIndexType?: string;
  mappedValueType?: string;
};

export type PrimitiveType = {
  isPrimitiveType: true;
  primitiveType: PrimitiveTypeName;
};

export interface ISyntheticSymbol {
  getDeclaredType(): Type;
  getName(): string;
  isAlias(): false;
  getUnderlyingSymbol(): Symbol | undefined;
  id: string;
  isSynthetic: true;
}

export interface IRegistryType<T extends TokenType = TokenType> {
  readonly tokenType: T;
  readonly shouldBeRendered: boolean;
  getStructure(): TypeStructure<T>;
  getHash(): string;
  getPropertyString(genericParameterValues?: string[]): string;
  getSymbol(): Symbol | PrimitiveType | ISyntheticSymbol;
  getCSharpElement(): CSharpElement;
  getType(): Type | undefined;
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
