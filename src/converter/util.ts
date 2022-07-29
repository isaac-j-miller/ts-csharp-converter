import { Symbol, Type } from "ts-morph";
import { assertNever } from "src/common/util";
import { CSharpPrimitiveType } from "src/csharp/elements";
import {
  isSyntheticSymbol,
  ISyntheticSymbol,
  PrimitiveTypeName,
} from "./types";
import { SyntheticSymbol } from "./synthetic/symbol";

export function toCSharpPrimitive(
  primitive: PrimitiveTypeName
): CSharpPrimitiveType {
  switch (primitive) {
    case "Boolean":
    case "boolean":
      return "bool";
    case "Number":
    case "number":
      // TODO: somehow guess whether should be int or double
      return "int";
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

export function asPrimitiveTypeName(t: Type): PrimitiveTypeName | undefined {
  const apparentType = t.getApparentType();
  const baseTypeName = apparentType.getBaseTypes()[0]?.getText()?.toLowerCase();
  const apparentTypeName = apparentType.getSymbol()?.getName()?.toLowerCase();

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
    return "number";
  }
  if (
    apparentType.isBoolean() ||
    baseTypeName === "boolean" ||
    apparentTypeName === "boolean"
  ) {
    return "boolean";
  }
  if (apparentType.isAny()) {
    return "any";
  }
  return;
}
