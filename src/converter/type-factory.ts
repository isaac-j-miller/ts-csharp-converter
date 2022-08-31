import { LoggerFactory } from "src/common/logging/factory";
import { ILogger } from "src/common/logging/types";
import { capitalize } from "src/common/util";
import { Node, Symbol, Type, SyntaxKind } from "ts-morph";
import { getIndexAndValueType } from "./mapped-type";
import { TypeRegistry } from "./registry";
import {
  PropertyOptions,
  TypeRegistryDictType,
  TypeRegistryType,
  TypeRegistryUnionType,
} from "./registry-types";
import { TypeRegistryPossiblyGenericType } from "./registry-types/possibly-generic";
import { TypeRegistryTupleType } from "./registry-types/tuple";
import {
  GenericParameter,
  GenericReference,
  IRegistryType,
  isGenericReference,
  isPrimitiveTypeName,
  PrimitiveTypeName,
  TokenType,
  TypeReference,
  UnionMember,
} from "./types";
import {
  asPrimitiveTypeName,
  createSymbol,
  getArrayDepth,
  getComments,
  getFinalArrayType,
  getFinalSymbolOfType,
  getGenericParametersFromType,
  getJsDocNumberType,
} from "./util";

type TypeOptions = {
  name: string;
  node: Node;
  type: Type;
  internal: boolean;
  descendsFromPublic: boolean;
  level: number;
};
type PropertyInfo = {
  propertyName: string;
  baseType: Type;
  symbol?: Symbol;
  primitiveType?: PrimitiveTypeName;
  options: PropertyOptions;
};
type GenericConstraintOrDefaultOptions = {
  baseType: Type;
  symbol?: Symbol;
  primitiveType?: PrimitiveTypeName;
  genericParameters?: string[];
};

const MAX_DEPTH = 50;

function getNonNullableType(type: Type) {
  if (!type.isNullable()) {
    return type;
  }
  if (type.isUnion()) {
    const unionTypes = type.getUnionTypes();
    const nonUndefinedTypes = unionTypes.filter(u => !u.isUndefined());
    if (nonUndefinedTypes.length === 1) {
      return nonUndefinedTypes[0];
    }
  }
  const nonNullable = type.getNonNullableType();
  if (
    nonNullable.getSymbol()?.getName() === "NonNullable" &&
    nonNullable.getAliasTypeArguments().length === 1
  ) {
    return nonNullable.getAliasTypeArguments()[0];
  }
  return type.getNonNullableType();
}

function getPropertyOptions(parentNode: Node, propertySymbol: Symbol): PropertyInfo {
  const propertyName = propertySymbol.getName();
  const isOptional = propertySymbol.isOptional();
  const dec = propertySymbol.getDeclarations()[0];
  const commentString = getComments(dec);
  const type = propertySymbol.getTypeAtLocation(parentNode);
  const nonNullable = getNonNullableType(type);
  const isArray = nonNullable.isArray();
  const baseType = getFinalArrayType(nonNullable);
  const symbol = nonNullable.getSymbol();
  const arrayDepth = isArray ? getArrayDepth(nonNullable) : 0;
  const tags = propertySymbol.getJsDocTags();
  const primitiveType = asPrimitiveTypeName(baseType, [...(symbol?.getJsDocTags() ?? []), ...tags]);
  let literalValue: string | number | boolean | undefined;
  if (type.isLiteral()) {
    literalValue = type.getLiteralValue() as string | number | boolean | undefined;
  }
  const options: PropertyOptions = {
    isArray,
    isOptional,
    arrayDepth,
    commentString,
    defaultLiteralValue: literalValue,
  };
  return {
    propertyName,
    baseType,
    symbol: getFinalSymbolOfType(type),
    primitiveType,
    options,
  };
}
function getGenericConstraintOrDefaultOptions(type: Type): GenericConstraintOrDefaultOptions {
  const baseType = getFinalArrayType(type);
  const symbol = getFinalSymbolOfType(type);
  const primitiveType = asPrimitiveTypeName(baseType);
  return {
    baseType,
    symbol,
    primitiveType,
  };
}

export class TypeFactory {
  private logger: ILogger;
  constructor(private registry: TypeRegistry, private ignoreClasses: Set<string>) {
    this.logger = LoggerFactory.getLogger("type-factory");
  }
  private createPrimitiveType(options: TypeOptions): IRegistryType | undefined {
    const { type } = options;
    const typeAsPrimitive = asPrimitiveTypeName(type);
    if (typeAsPrimitive) {
      return this.registry.getType(typeAsPrimitive);
    }
    return;
  }
  private createUnionTypeFromUnion(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal, descendsFromPublic } = options;
    if (type.isEnum() || !type.isUnion()) {
      return;
    }
    const symbolToUse = createSymbol(name, type);
    const unionTypes = type.getUnionTypes();
    const nonUndefinedUnionTypes = unionTypes.filter(u => !u.isUndefined() && !u.isNull());
    if (nonUndefinedUnionTypes.every(unionType => unionType.isStringLiteral())) {
      const members = nonUndefinedUnionTypes.map(
        member => member.getLiteralValue() ?? member.getApparentType().getLiteralValueOrThrow()
      );
      const unionRegType = new TypeRegistryUnionType(
        this.registry,
        name,
        symbolToUse,
        members.map(member => ({ name: member.toString() })),
        internal,
        descendsFromPublic,
        type,
        options.level,
        true,
        getComments(node)
      );
      return unionRegType;
    }
    if (nonUndefinedUnionTypes.length === 1) {
      return this.createType({
        name,
        node,
        type: nonUndefinedUnionTypes[0],
        internal,
        descendsFromPublic,
        level: options.level,
      });
    }
    if (nonUndefinedUnionTypes.every(unionType => unionType.isEnumLiteral())) {
      return this.createUnionTypeFromEnum(options, true);
    }
    if (
      nonUndefinedUnionTypes.every(unionType => unionType.isNumberLiteral() || unionType.isNumber())
    ) {
      const tags = symbolToUse.getUnderlyingSymbol()?.getJsDocTags();
      const apparentNumberType = getJsDocNumberType(tags);
      return this.registry.getType(apparentNumberType ?? "number");
    }
    if (
      nonUndefinedUnionTypes.every(
        unionType => unionType.isString() || asPrimitiveTypeName(unionType) === "string"
      )
    ) {
      return this.registry.getType("string");
    }
    return this.registry.getType("object");
  }
  private createUnionTypeFromEnum(
    options: TypeOptions,
    overrideEnumCheck: boolean = false
  ): IRegistryType | undefined {
    const { name, type, node, internal, level, descendsFromPublic } = options;
    const symbolToUse = createSymbol(name, type);
    if (!overrideEnumCheck && !type.isEnum()) {
      return;
    }
    const unionTypes = type.getUnionTypes();
    let previousValue = -1;
    const members = unionTypes
      .map((u): UnionMember | undefined => {
        const memberName = u.getSymbol()?.getName() ?? u.getAliasSymbol()?.getName();
        if (!memberName) {
          previousValue++;
          return;
        }
        const value = u.getLiteralValue() as number | undefined;
        const valueToUse = value === previousValue + 1 ? undefined : value;
        if (value !== undefined && Number.isFinite(value)) {
          previousValue = value;
        }
        return {
          name: memberName,
          value: valueToUse,
        };
      })
      .filter(u => u !== undefined) as UnionMember[];
    return new TypeRegistryUnionType(
      this.registry,
      name,
      symbolToUse,
      members,
      internal,
      descendsFromPublic,
      type,
      level,
      false,
      getComments(node)
    );
  }
  private createTupleType(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal, level, descendsFromPublic } = options;
    if (!type.isTuple()) {
      return;
    }
    const symbolToUse = createSymbol(name, type);
    const tupleElements = type.getTupleElements();
    const members = tupleElements.map((t, i) =>
      this.getReferenceOrGetFromRegistry(
        node,
        t,
        `${name}Member${i}`,
        level,
        descendsFromPublic || !internal
      )
    );
    const tuple = new TypeRegistryTupleType(
      this.registry,
      name,
      symbolToUse,
      members,
      internal,
      descendsFromPublic,
      type,
      level,
      node,
      getComments(node)
    );
    tupleElements.forEach((elem, i) => {
      const member = members[i];
      if (!isGenericReference(member.ref)) {
        const genericParams = getGenericParametersFromType(
          this.registry,
          elem,
          tuple.getStructure().genericParameters ?? []
        );
        genericParams.forEach(g => tuple.addGenericParameterToMember(i, g));
      }
    });
    type.getAliasTypeArguments().forEach(alias => {
      this.addGenericParameter(tuple, options, alias);
    });
    return tuple;
  }
  private getReferenceOrGetFromRegistry(
    node: Node,
    type: Type | PrimitiveTypeName,
    name: string,
    level: number,
    descendsFromPublic: boolean,
    symbol?: Symbol
  ): TypeReference {
    if (isPrimitiveTypeName(type)) {
      const asPrimitive = this.registry.getType(type).getSymbol();
      return {
        ref: asPrimitive,
        isArray: false,
        arrayDepth: 0,
      };
    }
    const isArray = type.isArray();
    const typeToUse = getFinalArrayType(type);
    const arrayDepth = getArrayDepth(type);
    const symbolToUse = symbol ?? typeToUse.getSymbol() ?? typeToUse.getAliasSymbol();
    const tags = symbolToUse?.getJsDocTags();
    const asPrimitive = asPrimitiveTypeName(typeToUse, tags);
    if (asPrimitive) {
      const sym = this.registry.getType(asPrimitive).getSymbol();
      return {
        ref: sym,
        isArray,
        arrayDepth,
      };
    }
    if (!symbolToUse) {
      const objectRegistryType = this.registry.getType("object").getSymbol();
      return {
        ref: objectRegistryType,
        isArray,
        arrayDepth,
      };
    }
    if (typeToUse.isTypeParameter()) {
      return {
        ref: {
          isGenericReference: true,
          genericParamName: symbolToUse.getName(),
        },
        isArray,
        arrayDepth,
      };
    }
    const regType = this.getFromRegistryOrCreateAnon(
      node,
      typeToUse,
      name,
      level,
      descendsFromPublic,
      symbolToUse
    );
    // TODO: figure out how to get parent generic params
    const genericParameters = getGenericParametersFromType(this.registry, typeToUse, [], name);
    const sym = regType.getSymbol();
    return {
      ref: sym,
      isArray,
      arrayDepth,
      genericParameters,
    };
  }
  private createMappedType(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal, level, descendsFromPublic } = options;
    const asMappedType = node.asKind(SyntaxKind.MappedType);
    let originalValueType: Type | undefined;
    let originalIndexType: Type | undefined;

    const getIndexAndValueTypeRefs = (): [TypeReference, TypeReference] | undefined => {
      const stringIndexType = type.getStringIndexType();
      const numberIndexType = type.getNumberIndexType();
      if ((!stringIndexType && !numberIndexType) || asMappedType) {
        const { index, value } = getIndexAndValueType(node) ?? {};
        if (index?.type && value?.type && index?.node && value?.node) {
          const indexTypeRef = this.getReferenceOrGetFromRegistry(
            index.node,
            index.type,
            `${capitalize(name)}Index`,
            level,
            descendsFromPublic || !internal
          );
          if (!isPrimitiveTypeName(index.type)) {
            originalIndexType = index.type;
          }
          const valueTypeRef = this.getReferenceOrGetFromRegistry(
            value.node,
            value.type,
            `${capitalize(name)}Value`,
            level,
            descendsFromPublic || !internal
          );
          if (!isPrimitiveTypeName(value.type)) {
            originalValueType = value.type;
          }
          return [indexTypeRef, valueTypeRef];
        }
      }
      let indexTypeString: "string" | "number" | "float" | "int";
      let valueTypeToUse: Type;
      if (stringIndexType) {
        indexTypeString = "string";
        valueTypeToUse = stringIndexType;
      } else if (numberIndexType) {
        indexTypeString = "number";
        valueTypeToUse = numberIndexType;
      } else {
        return;
      }
      const valueToUse = getFinalArrayType(valueTypeToUse);
      const indexType = this.registry.getType(indexTypeString).getSymbol();
      const valueTypeName = `${capitalize(name)}Value`;
      const vType = this.getReferenceOrGetFromRegistry(
        node,
        valueTypeToUse,
        valueTypeName,
        level,
        descendsFromPublic || !internal,
        valueTypeToUse.getSymbol()
      );
      originalValueType = valueToUse;
      return [{ ref: indexType, isArray: false, arrayDepth: 0 }, vType];
    };

    const indexAndValueTypes = getIndexAndValueTypeRefs();
    if (!indexAndValueTypes) {
      return;
    }
    const [indexType, valueType] = indexAndValueTypes;
    const symbolToUse = createSymbol(name, type);
    const mappedType = new TypeRegistryDictType(
      this.registry,
      name,
      symbolToUse,
      indexType,
      valueType,
      internal,
      descendsFromPublic,
      node,
      type,
      level,
      getComments(node)
    );
    const typeArgs =
      type.getAliasSymbol()?.getDeclarations()[0]?.getType().getAliasTypeArguments() ??
      type.getAliasTypeArguments();
    typeArgs.forEach(alias => {
      this.addGenericParameter(mappedType, options, alias);
    });
    // TODO: fix inline property like x: Record<x, y<T,V>>
    if (!isGenericReference(indexType.ref) && originalIndexType) {
      const genericParams = getGenericParametersFromType(
        this.registry,
        originalIndexType,
        mappedType.getStructure().genericParameters ?? []
      );
      genericParams.forEach(g => mappedType.addGenericParameterToIndex(g));
    }
    if (!isGenericReference(valueType.ref) && originalValueType) {
      const genericParams = getGenericParametersFromType(
        this.registry,
        originalValueType,
        mappedType.getStructure().genericParameters ?? []
      );
      genericParams.forEach(g => mappedType.addGenericParameterToValue(g));
    }
    return mappedType;
  }
  private getFromRegistryOrCreateAnon(
    node: Node,
    type: Type,
    name: string,
    level: number,
    descendsFromPublic: boolean,
    symbol?: Symbol
  ): IRegistryType {
    const getType = () => {
      const fromRegistry = symbol && this.registry.getType(symbol);
      if (fromRegistry) {
        return fromRegistry;
      }
      const nonNullable = getNonNullableType(type);
      const propertyText = nonNullable.getText();
      const fromText = this.registry.findTypeBySymbolText(propertyText);
      if (fromText) {
        return fromText;
      }
      if (isPrimitiveTypeName(propertyText)) {
        return this.registry.getType(propertyText);
      }
      this.logger.debug(`Creating internal type ${name}`);
      const newNode = symbol?.getDeclarations()[0];
      return this.createType({
        name,
        node: newNode ?? node,
        type: nonNullable,
        internal: true,
        descendsFromPublic,
        level: level + 1,
      });
    };
    if (level === MAX_DEPTH - 1) {
      this.logger.warn("will fail on next iteration if recursion continues");
    }
    if (level >= MAX_DEPTH) {
      throw new Error("Recursion depth exceeded.");
    }

    const fromRegistry = getType();
    return fromRegistry;
  }
  private getPropertyTypeFromRegistry(
    parentType: TypeRegistryType,
    parentOptions: TypeOptions,
    propertyInfo: PropertyInfo
  ): IRegistryType {
    const { node, name, level, descendsFromPublic, internal } = parentOptions;
    const { propertyName, options, baseType, symbol: propertyTypeSymbol } = propertyInfo;
    const { isArray } = options;
    const internalClassName = `${name}${capitalize(propertyName)}`;
    const nodeToUse = (
      propertyTypeSymbol ??
      baseType.getSymbol() ??
      baseType.getAliasSymbol()
    )?.getDeclarations()[0];
    const getType = () => {
      if (isArray || baseType.isArray()) {
        return this.getFromRegistryOrCreateAnon(
          nodeToUse ?? node,
          baseType,
          internalClassName,
          level,
          descendsFromPublic || !internal,
          getFinalSymbolOfType(getFinalArrayType(baseType))
        );
      }
      return this.getFromRegistryOrCreateAnon(
        nodeToUse ?? node,
        baseType,
        internalClassName,
        level,
        descendsFromPublic || !internal,
        propertyTypeSymbol
      );
    };
    const regType = getType();

    const genericParameters: TypeReference[] = [];
    if (parentType.tokenType === "Type") {
      if (regType.getLevel() <= level) {
        const baseTypeSym = getFinalSymbolOfType(baseType);
        if (baseTypeSym && this.registry.has(baseTypeSym)) {
          baseType.getAliasTypeArguments().forEach(t => {
            const param = this.getGenericParameter(parentType, parentOptions, t);
            if (!param) {
              return;
            }
            const paramToUse = param.apparent ?? param.default;
            if (paramToUse) {
              genericParameters.push(paramToUse);
            }
          });
        }
      } else {
        regType.getStructure().genericParameters?.forEach(g => {
          const fromParent = parentType
            .getStructure()
            .genericParameters?.find(p => p.name === g.name);
          if (fromParent) {
            const { isArray: paramIsArray = false, arrayDepth: paramArrayDepth = 0 } =
              g.apparent ?? g.default ?? {};
            genericParameters.push({
              ref: {
                isGenericReference: true,
                genericParamName: fromParent.name,
              },
              isArray: paramIsArray,
              arrayDepth: paramArrayDepth,
            });
          }
        });
      }
      const opts: PropertyOptions = {
        ...options,
        genericParameters,
      };
      parentType.addProperty(propertyName, regType.getSymbol(), opts);
    }

    return regType;
  }
  private handlePropertySignature(
    registryType: TypeRegistryType,
    parentOptions: TypeOptions,
    property: Symbol
  ) {
    const {
      node,
      type: parentType,
      name: parentName,
      internal,
      descendsFromPublic,
    } = parentOptions;
    const propertyOptions = getPropertyOptions(node, property);
    const { propertyName, options, baseType, primitiveType } = propertyOptions;
    const handle = () => {
      const isFnSignature = baseType.getCallSignatures().length > 0;
      const isRecursive =
        getNonNullableType(baseType.getApparentType()).getText() ===
        getNonNullableType(parentType.getApparentType()).getText();

      if (isRecursive) {
        registryType.addProperty(propertyName, registryType.getSymbol(), options);
        return;
      }
      if (baseType.isTypeParameter()) {
        const genericParamName = baseType.getSymbolOrThrow().getName();
        return registryType.addProperty(
          propertyName,
          {
            genericParamName,
            isGenericReference: true,
          },
          options
        );
      }
      if (primitiveType) {
        const primitiveSymbol = this.registry.getType(primitiveType).getSymbol();
        return registryType.addProperty(propertyName, primitiveSymbol, options);
      }
      const propertyTypeFromRegistry = this.getPropertyTypeFromRegistry(
        registryType,
        parentOptions,
        propertyOptions
      );
      if (isFnSignature) {
        options.isOptional = true;
      }
      registryType.addProperty(propertyName, propertyTypeFromRegistry.getSymbol(), options);
      if (isFnSignature) {
        registryType.addCommentStringToProperty(
          propertyName,
          "This property is a function, and it was unable to be translated at this time"
        );
      }
    };
    handle();
    baseType.getAliasTypeArguments().forEach((type, i) => {
      const ref = this.getReferenceOrGetFromRegistry(
        node,
        type,
        `${parentName}${propertyName}Arg${i}`,
        parentOptions.level,
        descendsFromPublic || !internal,
        type.getSymbol()
      );
      registryType.addGenericParameterToProperty(propertyName, ref);
    });
  }
  private getGenericTypeConstraintOrDefaultFromRegistry(
    parentOptions: TypeOptions,
    paramName: string,
    constraintOptions: GenericConstraintOrDefaultOptions,
    type: "Constraint" | "Default"
  ): TypeReference {
    const { node, name, level, internal, descendsFromPublic } = parentOptions;
    const { baseType, symbol } = constraintOptions;
    const internalClassName = `${name}${capitalize(paramName)}${type}`;
    const isArray = baseType.isArray();
    const arrayDepth = getArrayDepth(baseType);
    const typeToUse = getFinalArrayType(baseType);
    const fromRegOrAnon = this.getFromRegistryOrCreateAnon(
      node,
      typeToUse,
      internalClassName,
      level,
      descendsFromPublic || !internal,
      symbol
    );
    return {
      ref: fromRegOrAnon.getSymbol(),
      isArray,
      arrayDepth,
    };
  }
  private getGenericParameter<T extends TokenType>(
    parentRegistryType: TypeRegistryPossiblyGenericType<T>,
    parentOptions: TypeOptions,
    parameterType: Type
  ): GenericParameter | undefined {
    const v = getFinalSymbolOfType(parameterType)?.getName();
    if (!v) {
      return;
    }
    const isArray = parameterType.isArray();
    const arrayDepth = getArrayDepth(parameterType);
    if (arrayDepth > 0) {
      this.logger.warn("too deep getting generic params");
    }
    let apparent: TypeReference | undefined;
    const sym = parameterType.getSymbol();
    const fromParentGenericParams =
      sym &&
      parentRegistryType.getStructure().genericParameters?.find(p => p.name === sym.getName());
    if (fromParentGenericParams) {
      const genericRef: GenericReference = {
        isGenericReference: true,
        genericParamName: fromParentGenericParams.name,
      };
      apparent = {
        ref: genericRef,
        isArray,
        arrayDepth,
      };
    } else {
      const apparentType = parameterType.getApparentType();
      const apparentSym = getFinalSymbolOfType(apparentType);
      const typeFromRegistry = apparentSym && this.registry.getType(apparentSym);
      if (typeFromRegistry) {
        apparent = {
          ref: typeFromRegistry.getSymbol(),
          isArray,
          arrayDepth,
        };
      }
    }
    const constraintType = parameterType.getConstraint();
    const constraint = constraintType
      ? this.getGenericTypeConstraintOrDefaultFromRegistry(
          parentOptions,
          v,
          getGenericConstraintOrDefaultOptions(constraintType),
          "Constraint"
        )
      : undefined;
    const defaultType = parameterType.getDefault();
    const defaultValue = defaultType
      ? this.getGenericTypeConstraintOrDefaultFromRegistry(
          parentOptions,
          v,
          getGenericConstraintOrDefaultOptions(defaultType),
          "Default"
        )
      : undefined;
    const p: GenericParameter = {
      name: v,
      constraint,
      apparent,
      default: defaultValue,
    };
    return p;
  }
  private addGenericParameter<T extends TokenType>(
    registryType: TypeRegistryPossiblyGenericType<T>,
    parentOptions: TypeOptions,
    parameterType: Type
  ) {
    const p = this.getGenericParameter(registryType, parentOptions, parameterType);
    if (p && p.name !== "__type") {
      registryType.addGenericParameter(p);
    }
  }
  private handleFunction(options: TypeOptions): IRegistryType | undefined {
    const { name, type } = options;
    if (type.getCallSignatures().length || type.getConstructSignatures().length) {
      this.logger.warn(
        `Type ${name} has call signatures. I can't handle function types at the moment, so "any" will be used instead`
      );
      return this.registry.getType("any");
    }
    return;
  }
  private createTypeOrInterfaceType(options: TypeOptions): IRegistryType {
    const { name, node, type, internal, level, descendsFromPublic } = options;
    const symbolToUse = createSymbol(name, type);
    if (type.getCallSignatures().length) {
      this.logger.warn(`Type ${name} has call signatures`);
    }
    const regType = new TypeRegistryType(
      this.registry,
      name,
      symbolToUse,
      internal,
      descendsFromPublic,
      node,
      type,
      level,
      getComments(node)
    );
    type.getAliasTypeArguments().forEach(alias => {
      this.addGenericParameter(regType, options, alias);
    });
    const propertySignatures = type.getApparentProperties();
    propertySignatures.forEach(property =>
      this.handlePropertySignature(regType, options, property)
    );
    return regType;
  }
  private createTypeInternal(options: TypeOptions): IRegistryType {
    const apparentType = options.type.getApparentType();
    const symbol = apparentType.getAliasSymbol() ?? apparentType.getSymbol();
    const symName = symbol?.getName();
    const nameToCheck = !!symName && symName !== "__type" ? symName : options.name;
    if (this.ignoreClasses.has(nameToCheck)) {
      this.logger.debug(
        `type ${nameToCheck} (given name: ${options.name} is in the list of classes to ignore, returning an object type`
      );
      return this.registry.getType("any");
    }
    const asPrimitive = this.createPrimitiveType(options);
    if (asPrimitive) {
      return asPrimitive;
    }
    if (options.type.isArray()) {
      this.logger.warn(
        `Unable to process plain array type: ${options.name} is being returned as a object for now`
      );
      return this.registry.getType("any");
    }
    const asUnionFromUnion = this.createUnionTypeFromUnion(options);
    if (asUnionFromUnion) {
      return asUnionFromUnion;
    }
    const asUnionFromEnum = this.createUnionTypeFromEnum(options);
    if (asUnionFromEnum) {
      return asUnionFromEnum;
    }
    const asTuple = this.createTupleType(options);
    if (asTuple) {
      return asTuple;
    }
    const asMappedType = this.createMappedType(options);
    if (asMappedType) {
      return asMappedType;
    }
    const asFnType = this.handleFunction(options);
    if (asFnType) {
      return asFnType;
    }
    const regType = this.createTypeOrInterfaceType(options);
    return regType;
  }
  createType(options: TypeOptions): IRegistryType {
    try {
      this.logger.trace(
        `Creating ${options.internal ? "internal" : "public"} type ${options.name}`
      );
      const regType = this.createTypeInternal(options);
      this.registry.addType(regType);
      return regType;
    } catch (e) {
      const error = e as Error;
      this.logger.error(
        `Error creating type ${options.name}, returning any. Error: ${error.name}: ${error.message}`
      );
      return this.registry.getType("any");
    }
  }
}
