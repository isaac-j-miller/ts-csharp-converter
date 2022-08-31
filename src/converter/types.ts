import { Symbol, Type } from "ts-morph";
import { ICSharpElement } from "src/csharp/elements/types";
import type { TypeRegistryPossiblyGenericType } from "./registry-types/possibly-generic";
import { primitiveTypeNames, jsDocNumberTypes, CONSTS_KEYWORD } from "./consts";

export type ConstKeyword = typeof CONSTS_KEYWORD;
export type NonPrimitiveType = Exclude<TokenType, "Primitive" | "Const">;
export type TokenType =
  | "Type"
  | "StringUnion"
  | "Primitive"
  | "Dictionary"
  | "Const"
  | "Tuple"
  | "Instance";

export type PrimitiveTypeName = typeof primitiveTypeNames[number];

export type LiteralValue = string | boolean | number | undefined | null | LiteralValue[];
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
  genericParameters?: PropertyStringArgs;
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
  genericParameters?: TypeReference[];
  defaultLiteralValue?: LiteralValue;
  jsDocNumberType?: JsDocNumberType;
  commentString?: string;
};

export type GenericParameter = {
  name: string;
  apparent?: TypeReference;
  constraint?: TypeReference;
  default?: TypeReference;
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

export type PropertyStringArg = TypeReference | string;

export type PropertyStringArgs = PropertyStringArg[];

export interface ISyntheticSymbol {
  getDeclaredType(): Type;
  getName(): string;
  isAlias(): false;
  getUnderlyingSymbol(): Symbol | undefined;
  getSourceFilePath(): string | undefined;
  id: string;
  isSynthetic: true;
}
export type UnderlyingType<T extends TokenType> = T extends "Primitive" | "Const"
  ? undefined
  : Type;
export interface IRegistryType<T extends TokenType = TokenType> {
  readonly tokenType: T;
  readonly shouldBeRendered: boolean;
  isGeneric(): this is TypeRegistryPossiblyGenericType<T>;
  addCommentString(commentString: string): void;
  isPublic(): boolean;
  getLevel(): number;
  getStructure(): TypeStructure<T>;
  getHash(): string;
  getPropertyString(genericParameterValues?: PropertyStringArgs): string;
  getSymbol(): Exclude<BaseTypeReference, GenericReference>;
  getCSharpElement(): ICSharpElement;
  getType(): UnderlyingType<T>;
  rename(name: string): void;
  getOriginalName(): string;
  isNonPrimitive(): this is IRegistryType<NonPrimitiveType>;
  usesRef(ref: Exclude<BaseTypeReference, GenericReference>): boolean
  usesType(type: IRegistryType): boolean
  equals(ref: IRegistryType): boolean
  registerRefs(): void
  getRefHashes(): string[]
}

export type RegistryKey = Symbol | ISyntheticSymbol;

export function isPrimitiveType(t: unknown): t is PrimitiveType {
  return !!(t as PrimitiveType)?.isPrimitiveType;
}
export function isPrimitiveTypeName(str: unknown): str is PrimitiveTypeName {
  if (typeof str !== "string") {
    return false;
  }
  return primitiveTypeNames.includes(str as PrimitiveTypeName);
}
export function isGenericReference(t: unknown): t is GenericReference {
  return !!(t as GenericReference)?.isGenericReference;
}

export function isSyntheticSymbol(t: unknown): t is ISyntheticSymbol {
  return !!(t as ISyntheticSymbol)?.isSynthetic;
}

export function isConstType(t: unknown): t is ConstType {
  return !!(t as ConstType)?.isConstType;
}
