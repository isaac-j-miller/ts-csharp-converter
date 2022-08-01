import { Symbol, Type } from "ts-morph";
import { assertNever } from "src/common/util";
import { CSharpPrimitiveType } from "src/csharp/elements";
import {
  GenericParameter,
  IRegistryType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  LiteralValue,
  PrimitiveTypeName,
} from "./types";
import { SyntheticSymbol } from "./synthetic/symbol";
import { TypeRegistry } from "./registry";

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

    const typeConstraint = param.getConstraint();
    const constraintSymbol = typeConstraint
      ? getFinalSymbolOfType(typeConstraint)
      : undefined;
    const constraint = (
      constraintSymbol ? registry.getType(constraintSymbol) : undefined
    )?.getSymbol();
    const p: GenericParameter = {
      name: v,
      constraint,
    };

    params.push(p);
  });
  return params;
}
