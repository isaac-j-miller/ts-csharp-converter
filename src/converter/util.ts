import path from "path";
import { createHash } from "crypto";
import { JSDocTagInfo, Symbol, Type, Node } from "ts-morph";
import type { CSharpPrimitiveType } from "src/csharp/types";
import { LoggerFactory } from "src/common/logging/factory";
import type { CSharpConverterConfig } from "src/types";
import {
  BaseTypeReference,
  ConstType,
  GenericReference,
  IRegistryType,
  isConstType,
  isGenericReference,
  isPrimitiveType,
  isSyntheticSymbol,
  isUnionTypeValueReference,
  ISyntheticSymbol,
  JsDocNumberType,
  LiteralValue,
  NonPrimitiveType,
  PrimitiveType,
  PrimitiveTypeName,
  PropertyStringArg,
  PropertyStringArgs,
  TokenType,
  TypeReference,
} from "./types";
import { SyntheticSymbol } from "./synthetic/symbol";
import type { TypeRegistry } from "./registry";
import { NameType } from "./name-mapper/types";
import { NameMapper } from "./name-mapper/mapper";
import type { TypeRegistryPossiblyGenericType } from "./registry-types/possibly-generic";
import { jsDocNumberTypes } from "./consts";

export class ConfigDependentUtils {
  constructor(private config: CSharpConverterConfig) {}
  toCSharpPrimitive(primitive: PrimitiveTypeName): CSharpPrimitiveType {
    switch (primitive) {
      case "Boolean":
      case "boolean":
        return "bool";
      case "Number":
      case "number":
        return this.config.defaultNumericType;
      case "String":
      case "string":
        return "string";
      case "any":
      case "object":
      case "unknown":
      case "symbol":
      case "Symbol":
        return "object";
      case "null":
      case "undefined":
        return "null";
      default:
        if (jsDocNumberTypes.includes(primitive)) {
          return primitive;
        }
        throw new Error(`Unexpected value: ${primitive}`);
    }
  }
  getRelativePath(abs: string): string {
    return path.relative(path.dirname(this.config.tsconfigPath), abs);
  }
  resolveTypeName(
    registry: TypeRegistry,
    ref: BaseTypeReference,
    parent: TypeRegistryPossiblyGenericType<Exclude<TokenType, "Primitive" | "Const">>,
    immediateGenericParameters?: PropertyStringArgs
  ): string {
    if (isGenericReference(ref)) {
      const p = parent.getStructure().genericParameters?.find(g => g.name === ref.genericParamName);
      if (!p || parent.genericParamShouldBeRendered(p)) {
        return ref.genericParamName;
      }
      if (p.apparent) {
        return parent.resolveAndFormatTypeName(p.apparent);
      }
      if (p.constraint) {
        return parent.resolveAndFormatTypeName(p.constraint);
      }
      if (p.default) {
        return parent.resolveAndFormatTypeName(p.default);
      }
      throw new Error(
        `Generic param ${p.name} for ${
          parent.getStructure().name
        } should not be rendered, but no fallback type found`
      );
    }
    if (isPrimitiveType(ref)) {
      return this.toCSharpPrimitive(ref.primitiveType);
    }
    if (isConstType(ref)) {
      throw new Error("__const__ should not be referenced");
    }
    const registryType = registry.getType(ref);
    if (!registryType) {
      throw new Error(`Type not found in registry: ${ref}`);
    }
    const genericParameterNames = immediateGenericParameters?.length
      ? immediateGenericParameters
      : getGenericParameters(registry, registryType, parent);
    return registryType.getPropertyString(genericParameterNames);
  }
}

export function isCSharpNumericType(t: string): t is JsDocNumberType {
  return jsDocNumberTypes.includes(t as JsDocNumberType);
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

export function createSymbol(name: string, t?: Type): ISyntheticSymbol {
  const symbolFromType = t ? getFinalSymbolOfType(t) : undefined;
  return new SyntheticSymbol(name, t, symbolFromType);
}
function extractTextFromJsDocTag(text: string): JsDocNumberType | undefined {
  if (!(text.endsWith("}") && text.startsWith("{"))) {
    return;
  }
  const insideBrackets = text.substring(1, text.length - 1);
  if (isCSharpNumericType(insideBrackets)) {
    return insideBrackets;
  }
  return;
}

function getTypeFromTag(tag: JSDocTagInfo): JsDocNumberType | undefined {
  const textInfos = tag.getText();
  for (const textInfo of textInfos) {
    const { text } = textInfo;
    const extracted = extractTextFromJsDocTag(text);
    if (extracted) {
      return extracted;
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
  if (
    apparentType.isNumber() ||
    apparentType.isNumberLiteral() ||
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
    apparentType.isBooleanLiteral() ||
    baseTypeName === "boolean" ||
    apparentTypeName === "boolean"
  ) {
    return "boolean";
  }
  if (baseTypeName === "object" || apparentTypeName === "object" || t.getText() === "object") {
    return "object";
  }
  if (baseTypeName === "symbol" || apparentTypeName === "symbol" || t.getText() === "symbol") {
    return "symbol";
  }
  if (apparentType.isAny()) {
    return "any";
  }
  return;
}

export function hashPropertyStringArgs(
  registry: TypeRegistry,
  args: PropertyStringArgs | undefined,
  baseNames: Set<string>
) {
  if (!args || args.length === 0) return "_";
  const hashFn = (g: PropertyStringArg) =>
    typeof g === "string" ? g : hashRef(registry, g, baseNames);
  return args.map(hashFn).join(",");
}
export function hashRef(
  registry: TypeRegistry,
  ref: TypeReference<BaseTypeReference> | undefined,
  baseNames: Set<string>
) {
  if (!ref) {
    return "_";
  }
  const { arrayDepth, isArray, ref: typeRef, genericParameters } = ref;
  let baseTypeHash: string;
  if (isGenericReference(typeRef)) {
    baseTypeHash = typeRef.genericParamName;
  } else {
    const fromRegistry = registry.getType(typeRef);
    let prefix = "_";
    if (fromRegistry) {
      if (
        baseNames.has(fromRegistry.getStructure().name) ||
        baseNames.has(fromRegistry.getOriginalName())
      ) {
        prefix = fromRegistry.getOriginalName() + "(this)";
      } else {
        prefix = fromRegistry.getHash(baseNames);
      }
    }
    baseTypeHash =
      prefix +
      `a:${isArray};d:${arrayDepth ?? 0}.${hashPropertyStringArgs(
        registry,
        genericParameters,
        baseNames
      )}`;
  }
  return createHash("md5").update(baseTypeHash).digest().toString("hex");
}

export function literalValueToCSharpLiteralValue(
  v: LiteralValue,
  registry: TypeRegistry,
  mapper: NameMapper
): string | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    const values = v.map(val => literalValueToCSharpLiteralValue(val, registry, mapper));
    return `{ ${values.join(", ")} }`;
  }
  if (isUnionTypeValueReference(v)) {
    const { ref, propertyName } = v;
    const fromReg = registry.getType(ref);
    if (!fromReg) {
      throw new Error(`Couldn't find ${ref} in registry`);
    }
    return `${mapper.transform(
      fromReg.getStructure().name,
      NameType.DeclarationName
    )}.${mapper.transform(propertyName, NameType.EnumMember)}`;
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

export function getGenericParametersFromType(
  registry: TypeRegistry,
  type: Type,
  parent: IRegistryType,
  typeName?: string
): PropertyStringArgs {
  const logger = LoggerFactory.getLogger("generic-resolver");
  const params: PropertyStringArgs = [];
  const parentGenericParameters = parent.getStructure().genericParameters ?? [];
  const genericParameters = type.getAliasTypeArguments();
  if (!typeName) {
    typeName = (type.getAliasSymbol() ?? type.getSymbol())?.getName() ?? "<anonymous>";
  }
  genericParameters.forEach((param, i) => {
    const symName = param.getSymbol()?.getName();
    if (symName) {
      const inParentParams = parentGenericParameters.find(p => p.name === symName);
      if (inParentParams) {
        if (parent.isGeneric() && !parent.genericParamShouldBeRendered(inParentParams)) {
          return;
        }
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
      const genericParamGenericParameters = getGenericParameters(registry, fromRegistry, parent);
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
  parent: IRegistryType
): PropertyStringArgs {
  const t = registryType.getType()?.getApparentType();
  if (!t) {
    return [];
  }
  const typeName = registryType.getStructure().name;
  return getGenericParametersFromType(registry, t, parent, typeName);
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
