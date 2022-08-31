import { JSDocTagInfo, Symbol, Type, Node } from "ts-morph";
import { assertNever } from "src/common/util";
import { CSharpPrimitiveType } from "src/csharp/types";
import { LoggerFactory } from "src/common/logging/factory";
import {
  BaseTypeReference,
  ConstType,
  GenericParameter,
  GenericReference,
  IRegistryType,
  isConstType,
  isGenericReference,
  isPrimitiveType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  JsDocNumberType,
  LiteralValue,
  NonPrimitiveType,
  PrimitiveType,
  PrimitiveTypeName,
  PropertyStringArgs,
  TypeReference,
} from "./types";
import { SyntheticSymbol } from "./synthetic/symbol";
import type { TypeRegistry } from "./registry";

// TODO: make this config-driven
const DEFAULT_NUMBER_TYPE = "int" as const;

export function toCSharpPrimitive(primitive: PrimitiveTypeName): CSharpPrimitiveType {
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
  if (!sym) {
    throw new Error("symbol not defined");
  }
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
  const typeTags = tags.filter(t => t.getName() === "type");
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
export function asPrimitiveTypeName(t: Type, tags?: JSDocTagInfo[]): PrimitiveTypeName | undefined {
  const apparentType = t.getApparentType();
  const baseTypeName = apparentType.getBaseTypes()[0]?.getText()?.toLowerCase();
  const apparentTypeName = apparentType.getSymbol()?.getName()?.toLowerCase();
  const tagsToUse = tags ?? (t.getSymbol() ?? t.getAliasSymbol())?.getJsDocTags();
  const apparentNumberType = getJsDocNumberType(tagsToUse);
  
  if (apparentType.isString() || baseTypeName === "string" || apparentTypeName === "string") {
    return "string";
  }
  if (apparentType.isNumber() || baseTypeName === "number" || apparentTypeName === "number") {
    if (apparentNumberType) {
      return apparentNumberType;
    }
    return "number";
  }
  if (apparentType.isBoolean() || baseTypeName === "boolean" || apparentTypeName === "boolean") {
    return "boolean";
  }
  if (baseTypeName === "object" || apparentTypeName === "object" || t.getText() === "object") {
    return "object";
  }
  if (apparentType.isAny()) {
    return "any";
  }
  return;
}

export function literalValueToCSharpLiteralValue(v: LiteralValue): string | undefined {
  if(v===undefined) return undefined
  if (Array.isArray(v)) {
    const values = v.map(val => literalValueToCSharpLiteralValue(val));
    return `{ ${values.join(", ")} }`;
  }
  return JSON.stringify(v);
}

export function getRefactorName(name: string): string {
  const match = name.match(/\d+$/);
  if (match) {
    const num = match[0];
    const newNum = Number.parseInt(num, 10) + 1;
    return name.replace(num, newNum.toString());
  }
  return name + "2";
}

export function resolveTypeName(
  registry: TypeRegistry,
  ref: BaseTypeReference,
  parentGenericParameters: GenericParameter[],
  immediateGenericParameters?: PropertyStringArgs
): string {
  if (isGenericReference(ref)) {
    return ref.genericParamName;
  }
  if (isPrimitiveType(ref)) {
    return toCSharpPrimitive(ref.primitiveType);
  }
  if (isConstType(ref)) {
    throw new Error("__const__ should not be referenced");
  }
  const registryType = registry.getType(ref);
  if (!registryType) {
    throw new Error(`Type not found in registry: ${ref}`);
  }
  const genericParameterNames =
    immediateGenericParameters ??
    getGenericParameters(registry, registryType, parentGenericParameters);
  return registryType.getPropertyString(genericParameterNames);
}

export function getGenericParametersFromType(
  registry: TypeRegistry,
  type: Type,
  parentGenericParameters: GenericParameter[],
  typeName?: string
): PropertyStringArgs {
  const logger = LoggerFactory.getLogger("generic-resolver");
  const params: PropertyStringArgs = [];
  const genericParameters = type.getAliasTypeArguments();
  if (!typeName) {
    typeName = (type.getAliasSymbol() ?? type.getSymbol())?.getName() ?? "<anonymous>";
  }
  genericParameters.forEach((param, i) => {
    const symName = param.getSymbol()?.getName();
    if (symName) {
      const inParentParams = parentGenericParameters.find(p => p.name === symName);
      if (inParentParams) {
        const ref: GenericReference = {
          isGenericReference: true,
          genericParamName: inParentParams.name,
        };
        const isArray = param.isArray();
        const arrayDepth = getArrayDepth(param);
        const typeRef: TypeReference<GenericReference> = {
          ref,
          isArray,
          arrayDepth,
        };
        params.push(typeRef);
        return;
      }
    }
    const apparentType = param.getApparentType();
    let sym: Symbol | ISyntheticSymbol | PrimitiveType | ConstType | undefined =
      getFinalSymbolOfType(apparentType);
    const fromRegistryByText = registry.findTypeBySymbolText(param.getText());
    if (fromRegistryByText) {
      sym = fromRegistryByText.getSymbol();
    }
    if (!sym) {
      const defaultType = param.getDefault();
      if (!defaultType) {
        logger.warn(`No symbol found for param ${i} of ${typeName} and default value not found`);
        return;
      }
      const defaultSymbol = getFinalSymbolOfType(defaultType);
      if (!defaultSymbol) {
        const defaultApparentType = defaultType.getApparentType();
        const apparentSymbol = getFinalSymbolOfType(defaultApparentType);
        if (apparentSymbol) {
          sym = apparentSymbol;
        }
      } else {
        sym = defaultSymbol;
      }
      if (!sym) {
        logger.warn(
          `No symbol found for param ${i} of ${typeName} but default value was found, but with no symbol`
        );
        return;
      }
    }
    let fromRegistry = registry.getType(sym);
    if (!fromRegistry) {
      const castSym = sym as Symbol;
      logger.warn(`No type found in registry for symbol ${castSym.getName()}, using any`);
      fromRegistry = registry.getType("any");
    }
    if (fromRegistry.isNonPrimitive()) {
      const genericParamGenericParameters = getGenericParameters(
        registry,
        fromRegistry,
        parentGenericParameters
      );
      const propString = fromRegistry.getPropertyString(genericParamGenericParameters);
      params.push(propString);
    } else {
      params.push(fromRegistry.getPropertyString());
    }
  });
  return params;
}

export function getGenericParameters(
  registry: TypeRegistry,
  registryType: IRegistryType<NonPrimitiveType>,
  parentGenericParameters: GenericParameter[]
): PropertyStringArgs {
  const t = registryType.getType()?.getApparentType();
  if (!t) {
    return [];
  }
  const typeName = registryType.getStructure().name;
  return getGenericParametersFromType(registry, t, parentGenericParameters, typeName);
}

export function formatCSharpArrayString(
  name: string,
  isArray: boolean,
  arrayDepth: number
): string {
  if (!isArray) {
    return name;
  }
  return name + `[${",".repeat(arrayDepth ? arrayDepth - 1 : 0)}]`;
}

export function getComments(node: Node): string | undefined {
  const commentString = node
    ?.getLeadingCommentRanges()
    .map(c => c.getText())
    .join("\n");
  return commentString;
}
