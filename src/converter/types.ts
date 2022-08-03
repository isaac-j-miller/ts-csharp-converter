import { MappedTypeNode, Symbol, Type } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";

export type TokenType =
  | "Type"
  | "Alias"
  | "StringUnion"
  | "Interface"
  | "Enum"
  | "Primitive"
  | "Dictionary"
  | "Const"
  | "Tuple"
  | "Array";

const primitiveTypeNames = [
  "string",
  "String",
  "number",
  "Number",
  "float",
  "int",
  "boolean",
  "Boolean",
  "object",
  "any",
  "undefined",
  "null",
  "unknown",
] as const;
export type PrimitiveTypeName = typeof primitiveTypeNames[number];

export type LiteralValue =
  | string
  | boolean
  | number
  | undefined
  | null
  | LiteralValue[];

export const jsDocNumberTypes = ["int", "float"] as const;
export type JsDocNumberType = typeof jsDocNumberTypes[number];

export type UnionMember = {
  name: string;
  value?: number;
};

export type GenericReference = {
  isGenericReference: true;
  genericParamName: string;
};
export type TypeReference<T extends BaseTypeReference = BaseTypeReference> = {
  isArray: boolean;
  arrayDepth: number;
  ref: T;
};
export type BaseTypeReference =
  | Symbol
  | PrimitiveType
  | GenericReference
  | ISyntheticSymbol
  | ConstType;

export type PropertyStructure = {
  propertyName: string;
  baseType: BaseTypeReference;
  isArray: boolean;
  arrayDepth?: number;
  isOptional: boolean;
  genericParameters?: string[];
  defaultLiteralValue?: LiteralValue;
  jsDocNumberType?: JsDocNumberType;
  commentString?: string;
};

export type GenericParameter = {
  name: string;
  constraint?: TypeReference;
};

export type TypeStructure<T extends TokenType> = {
  tokenType: T;
  name: string;
  unionMembers?: UnionMember[];
  tupleMembers?: TypeReference[];
  properties?: Record<string, PropertyStructure>;
  genericParameters?: GenericParameter[];
  mappedIndexType?: TypeReference;
  mappedValueType?: TypeReference;
  commentString?: string;
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
  addCommentString(commentString: string): void;
  isPublic(): boolean;
  getLevel(): number;
  getStructure(): TypeStructure<T>;
  getHash(): string;
  getPropertyString(genericParameterValues?: string[]): string;
  getSymbol(): Exclude<BaseTypeReference, GenericReference>;
  getCSharpElement(): CSharpElement;
  getType(): Type | undefined;
  rename(name: string): void;
  getOriginalName(): string;
  markAsMappedType(mappedTypeNode: MappedTypeNode): void;
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
