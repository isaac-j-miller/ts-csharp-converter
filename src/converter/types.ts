import { Symbol, Type } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";

export type TokenType =
  | "Type"
  | "Alias"
  | "StringUnion"
  | "Interface"
  | "Enum"
  | "Primitive";
export type PrimitiveTypeName =
  | "string"
  | "String"
  | "number"
  | "Number"
  | "boolean"
  | "Boolean"
  | "object"
  | "any"
  | "undefined"
  | "null"
  | "unknown";

export type GenericReference = {
  isGenericReference: true;
  genericParamName: string;
};

export type PropertyStructure = {
  propertyName: string;
  baseType: Symbol | PrimitiveType | GenericReference | ISyntheticSymbol; // TODO: change this or make it reference a specific type
  isArray: boolean;
  isOptional: boolean;
  genericParameters?: string[];
};

export type TypeStructure<T extends TokenType> = {
  tokenType: T;
  name: string;
  unionMembers?: string[];
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
  id: string;
  isSynthetic: true;
}

export interface IRegistryType<T extends TokenType = TokenType> {
  readonly tokenType: T;
  readonly shouldBeRendered: boolean;
  getStructure(): TypeStructure<T>;
  getHash(): string;
  getSymbol(): Symbol | PrimitiveType | ISyntheticSymbol;
  getCSharpElement(): CSharpElement;
}

export type RegistryKey = Symbol | ISyntheticSymbol;

export function isPrimitiveType(t: unknown): t is PrimitiveType {
  return !!(t as PrimitiveType).isPrimitiveType;
}

export function isGenericReference(t: unknown): t is GenericReference {
  return !!(t as GenericReference).isGenericReference;
}

export function isSyntheticSymbol(
  t: Symbol | ISyntheticSymbol
): t is ISyntheticSymbol {
  return !!(t as ISyntheticSymbol).isSynthetic;
}
