import { JSDocTagInfo, Symbol, Type, TypeParameter } from "ts-morph";
import { assertNever } from "src/common/util";
import { CSharpPrimitiveType } from "src/csharp/elements";
import {
  BaseTypeReference,
  GenericParameter,
  IRegistryType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  JsDocNumberType,
  LiteralValue,
  PrimitiveTypeName,
  TypeReference,
} from "./types";
import { SyntheticSymbol } from "./synthetic/symbol";
import { TypeRegistry } from "./registry";

// TODO: make this config-driven
const DEFAULT_NUMBER_TYPE = "int" as const;

export function toCSharpPrimitive(
  primitive: PrimitiveTypeName
): CSharpPrimitiveType {
  switch (primitive) {
    case "Boolean":
    case "boolean":
      return "bool";
    case "Number":
    case "number":
      return DEFAULT_NUMBER_TYPE;
    case "String":
    case "string":
      return "string";
    case "any":
    case "object":
    case "unknown":
      return "object";
    case "null":
    case "undefined":
      return "null";
    case "float":
      return "double";
    case "int":
      return "int";
    default:
      assertNever(primitive);
  }
  throw new Error("Somehow this fell through");
}

export function getFinalSymbol<T extends Symbol | ISyntheticSymbol>(sym: T): T {
  if (!isSyntheticSymbol(sym) && sym.isAlias()) {
    return getFinalSymbol(sym.getAliasedSymbolOrThrow()) as T;
  }
  return sym;
}
export function getFinalArrayType(type: Type): Type {
  if (type.isArray()) {
    return getFinalArrayType(type.getArrayElementTypeOrThrow());
  }
  return type;
}
export function getArrayDepth(type: Type, depth: number = 0): number {
  if (type.isArray()) {
    return getArrayDepth(type.getArrayElementTypeOrThrow(), depth + 1);
  }
  return depth;
}
export function getFinalSymbolOfType(type: Type): Symbol | undefined {
  const sym = type.getSymbol() ?? type.getAliasSymbol();
  if (sym) {
    return getFinalSymbol(sym);
  }
  return;
}

export function getGenericTypeName(name: string, typeArgs?: string[]) {
  if (!typeArgs || typeArgs.length === 0) {
    return name;
  }
  return `${name}<${typeArgs.join(", ")}>`;
}

export function createSymbol(name: string, t: Type): ISyntheticSymbol {
  const symbolFromType = getFinalSymbolOfType(t);
  return new SyntheticSymbol(name, t, symbolFromType);
}
function getTypeFromTag(tag: JSDocTagInfo): JsDocNumberType | undefined {
  const textInfos = tag.getText();
  for (const textInfo of textInfos) {
    const { text } = textInfo;
    if (text === "{float}") {
      return "float";
    }
    if (text === "{int}") {
      return "int";
    }
  }
  return;
}
export function getJsDocNumberType(
  tags?: JSDocTagInfo[],
  index?: number
): JsDocNumberType | undefined {
  if (!tags) {
    return;
  }
  const typeTags = tags.filter((t) => t.getName() === "type");
  if (index !== undefined) {
    const tagToUse = typeTags[index];
    if (tagToUse) {
      const typeFromTag = getTypeFromTag(tagToUse);
      if (typeFromTag) {
        return typeFromTag;
      }
    }
    return;
  }
  for (const tag of typeTags) {
    const typeFromTag = getTypeFromTag(tag);
    if (typeFromTag) {
      return typeFromTag;
    }
  }
  return;
}
export function asPrimitiveTypeName(
  t: Type,
  tags?: JSDocTagInfo[]
): PrimitiveTypeName | undefined {
  const apparentType = t.getApparentType();
  const baseTypeName = apparentType.getBaseTypes()[0]?.getText()?.toLowerCase();
  const apparentTypeName = apparentType.getSymbol()?.getName()?.toLowerCase();
  const tagsToUse =
    tags ?? (t.getSymbol() ?? t.getAliasSymbol())?.getJsDocTags();
  const apparentNumberType = getJsDocNumberType(tagsToUse);
  if (
    apparentType.isString() ||
    baseTypeName === "string" ||
    apparentTypeName === "string"
  ) {
    return "string";
  }
  if (
    apparentType.isNumber() ||
    baseTypeName === "number" ||
    apparentTypeName === "number"
  ) {
    if (apparentNumberType) {
      return apparentNumberType;
    }
    return "number";
  }
  if (
    apparentType.isBoolean() ||
    baseTypeName === "boolean" ||
    apparentTypeName === "boolean"
  ) {
    return "boolean";
  }
  if (baseTypeName === "object" || apparentTypeName === "object") {
    return "object";
  }
  if (apparentType.isAny()) {
    return "any";
  }
  return;
}

export function literalValueToCSharpLiteralValue(v: LiteralValue): string {
  if (Array.isArray(v)) {
    const values = v.map((val) => literalValueToCSharpLiteralValue(val));
    return `{ ${values.join(", ")} }`;
  }
  return JSON.stringify(v);
}

export function getRefactorName(name: string): string {
  const match = name.match(/\d+$/);
  if (match) {
    const num = match[0];
    const newNum = Number.parseInt(num) + 1;
    return name.replace(num, newNum.toString());
  }
  return name + "2";
}
export function getGenericParameters(
  registry: TypeRegistry,
  t: Type | undefined
): GenericParameter[] {
  if (!t) {
    return [];
  }
  const params: GenericParameter[] = [];
  const genericParameters = t.getAliasTypeArguments();
  genericParameters.forEach((param) => {
    const apparentType = param.getApparentType();
    const defaultValue = param.getDefault();
    let v = (
      apparentType.getSymbol() ?? apparentType.getAliasSymbol()
    )?.getName();

    if (defaultValue && !v) {
      const defaultSymbol = getFinalSymbolOfType(defaultValue);
      const asPrimitive = asPrimitiveTypeName(defaultValue);
      let defaultParam: IRegistryType | undefined = asPrimitive
        ? registry.getType(asPrimitive)
        : undefined;
      if (defaultSymbol && !defaultParam) {
        defaultParam = registry.getType(defaultSymbol);
      }
      if (defaultParam) {
        const defaultParamGenericParams = getGenericParameters(
          registry,
          defaultValue
        );
        v = defaultParam.getPropertyString(
          defaultParamGenericParams.map((v) => v.name)
        );
      }
    }
    if (!v) {
      return;
    }

    const p = getConstraint(registry, param, v);

    params.push(p);
  });
  return params;
}

export function formatCsharpArrayString(
  name: string,
  isArray: boolean,
  arrayDepth: number
): string {
  if (!isArray) {
    return name;
  }
  return name + `[${",".repeat(arrayDepth ? arrayDepth - 1 : 0)}]`;
}

function getConstraint(
  registry: TypeRegistry,
  param: TypeParameter,
  v: string
): GenericParameter {
  const underlyingTypeConstraint = param.getConstraint();
  const typeConstraint = underlyingTypeConstraint
    ? getFinalArrayType(underlyingTypeConstraint)
    : undefined;
  const constraintSymbol = typeConstraint
    ? getFinalSymbolOfType(typeConstraint)
    : undefined;
  let isArray = false;
  let arrayDepth = 0;
  if (typeConstraint) {
    isArray = typeConstraint.isArray();
    arrayDepth = getArrayDepth(typeConstraint);
  }
  const constraintBaseRef: BaseTypeReference | undefined = (
    constraintSymbol ? registry.getType(constraintSymbol) : undefined
  )?.getSymbol();
  const constraint = constraintBaseRef
    ? {
        ref: constraintBaseRef,
        isArray,
        arrayDepth,
      }
    : undefined;
  const p: GenericParameter = {
    name: v,
    constraint,
  };
  return p;
}
