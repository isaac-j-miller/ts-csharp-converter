import { Node, Symbol, Type } from "ts-morph";
import { SyntaxKind } from "typescript";
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
  IRegistryType,
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
  getFinalArrayType,
  getFinalSymbolOfType,
  getJsDocNumberType,
} from "./util";

type TypeOptions = {
  name: string;
  node: Node;
  type: Type;
  internal: boolean;
  level: number;
};
type PropertyInfo = {
  propertyName: string;
  baseType: Type;
  symbol?: Symbol;
  primitiveType?: PrimitiveTypeName;
  options: PropertyOptions;
};
type GenericConstraintOptions = {
  baseType: Type;
  symbol?: Symbol;
  primitiveType?: PrimitiveTypeName;
  genericParameters?: string[];
};

const MAX_DEPTH = 50;

function getPropertyOptions(
  parentNode: Node,
  propertySymbol: Symbol
): PropertyInfo {
  const propertyName = propertySymbol.getName();
  const isOptional = propertySymbol.isOptional();
  const dec = propertySymbol.getDeclarations()[0];
  const commentString = getComments(dec);
  const type = propertySymbol.getTypeAtLocation(parentNode);
  const isArray = type.isArray();
  const baseType = getFinalArrayType(type);
  const typeArgs = baseType.getAliasTypeArguments();
  const genericParameters = typeArgs.map(
    (t) =>
      t.getAliasSymbol()?.getName() ?? t.getSymbol()?.getName() ?? t.getText()
  );
  const symbol = baseType.getSymbol();
  const arrayDepth = isArray ? getArrayDepth(type) : 0;
  const tags = propertySymbol.getJsDocTags();
  const primitiveType = asPrimitiveTypeName(baseType, tags);
  const options = {
    isArray,
    isOptional,
    genericParameters,
    arrayDepth,
    commentString,
  };
  return {
    propertyName,
    baseType,
    symbol,
    primitiveType,
    options,
  };
}
function getGenericConstraintOptions(type: Type): GenericConstraintOptions {
  const baseType = getFinalArrayType(type);
  const typeArgs = baseType.getAliasTypeArguments();
  const genericParameters = typeArgs.map(
    (t) =>
      t.getAliasSymbol()?.getName() ?? t.getSymbol()?.getName() ?? t.getText()
  );
  const symbol = getFinalSymbolOfType(type);
  const primitiveType = asPrimitiveTypeName(baseType);
  return {
    baseType,
    symbol,
    primitiveType,
    genericParameters,
  };
}

function getComments(node: Node): string | undefined {
  const commentString = node
    ?.getLeadingCommentRanges()
    .map((c) => c.getText())
    .join("\n");
  return commentString;
}
export class TypeFactory {
  constructor(private registry: TypeRegistry) {}
  private createPrimitiveType(options: TypeOptions): IRegistryType | undefined {
    const { type } = options;
    const typeAsPrimitive = asPrimitiveTypeName(type);
    if (typeAsPrimitive) {
      return this.registry.getType(typeAsPrimitive);
    }
    return;
  }
  private createUnionTypeFromUnion(
    options: TypeOptions
  ): IRegistryType | undefined {
    const { name, node, type, internal } = options;
    if (type.isEnum() || !type.isUnion()) {
      return;
    }
    const symbolToUse = createSymbol(name, type);
    const unionTypes = type.getUnionTypes();
    const nonUndefinedUnionTypes = unionTypes.filter(
      (u) => !u.isUndefined() && !u.isNull()
    );
    if (
      nonUndefinedUnionTypes.every((unionType) => unionType.isStringLiteral())
    ) {
      const members = unionTypes.map((member) =>
        member.getLiteralValueOrThrow()
      );
      const unionRegType = new TypeRegistryUnionType(
        this.registry,
        name,
        symbolToUse,
        members.map((member) => ({ name: member.toString() })),
        internal,
        type,
        options.level,
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
        level: options.level,
      });
    }
    if (
      nonUndefinedUnionTypes.every((unionType) => unionType.isEnumLiteral())
    ) {
      return this.createUnionTypeFromEnum(options, true);
    }
    if (
      nonUndefinedUnionTypes.every(
        (unionType) => unionType.isNumberLiteral() || unionType.isNumber()
      )
    ) {
      const tags = symbolToUse.getUnderlyingSymbol()?.getJsDocTags();
      const apparentNumberType = getJsDocNumberType(tags);
      return this.registry.getType(apparentNumberType ?? "number");
    }
    if (nonUndefinedUnionTypes.every((unionType) => unionType.isString())) {
      return this.registry.getType("string");
    }
    return this.registry.getType("object");
  }
  private createUnionTypeFromEnum(
    options: TypeOptions,
    overrideEnumCheck: boolean = false
  ): IRegistryType | undefined {
    const { name, type, node, internal, level } = options;
    const symbolToUse = createSymbol(name, type);
    if (!overrideEnumCheck && !type.isEnum()) {
      return;
    }
    const unionTypes = type.getUnionTypes();
    let previousValue = -1;
    const members = unionTypes
      .map((u): UnionMember | undefined => {
        const memberName =
          u.getSymbol()?.getName() ?? u.getAliasSymbol()?.getName();
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
      .filter((u) => u !== undefined) as UnionMember[];
    return new TypeRegistryUnionType(
      this.registry,
      name,
      symbolToUse,
      members,
      internal,
      type,
      level,
      getComments(node)
    );
  }
  private createTupleType(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal, level } = options;
    if (!type.isTuple()) {
      return;
    }
    const symbolToUse = createSymbol(name, type);
    const tupleElements = type.getTupleElements();
    const members = tupleElements.map((t, i) =>
      this.getReferenceOrGetFromRegistry(node, t, `${name}Member${i}`, level)
    );
    const tuple = new TypeRegistryTupleType(
      this.registry,
      name,
      symbolToUse,
      members,
      internal,
      type,
      level,
      node,
      getComments(node)
    );

    type.getAliasTypeArguments().forEach((alias) => {
      this.addGenericParameter(tuple, options, alias);
    });
    return tuple;
  }
  private getReferenceOrGetFromRegistry(
    node: Node,
    type: Type | PrimitiveTypeName,
    name: string,
    level: number,
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
    const symbolToUse =
      symbol ?? typeToUse.getSymbol() ?? typeToUse.getAliasSymbol();
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
      const asPrimitive = this.registry.getType("object").getSymbol();
      return {
        ref: asPrimitive,
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
      symbolToUse
    );
    const sym = regType.getSymbol();
    return {
      ref: sym,
      isArray,
      arrayDepth,
    };
  }
  private createMappedType(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal, level } = options;
    const asMappedType = node.asKind(SyntaxKind.MappedType);
    const getIndexAndValueTypeRefs = ():
      | [TypeReference, TypeReference]
      | undefined => {
      const stringIndexType = type.getStringIndexType();
      const numberIndexType = type.getNumberIndexType();
      if ((!stringIndexType && !numberIndexType) || asMappedType) {
        const [[index, indexNode], [value, valueNode]] =
          getIndexAndValueType(node);
        if (index && value && indexNode && valueNode) {
          const indexTypeRef = this.getReferenceOrGetFromRegistry(
            indexNode,
            index,
            `${name}IndexType`,
            level
          );
          const valueTypeRef = this.getReferenceOrGetFromRegistry(
            valueNode,
            value,
            `${name}ValueType`,
            level
          );
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
      const valueType = valueTypeToUse.getApparentType();
      const isArray = valueType.isArray();
      const arrayDepth = getArrayDepth(valueType);
      const valueToUse = getFinalArrayType(valueType);
      const indexType = this.registry.getType(indexTypeString).getSymbol();
      const valueTypeName = `${name}Value`;
      const vType = this.getFromRegistryOrCreateAnon(
        node,
        valueToUse,
        valueTypeName,
        level,
        valueType.getSymbol()
      );
      return [
        { ref: indexType, isArray: false, arrayDepth: 0 },
        { ref: vType.getSymbol(), isArray, arrayDepth },
      ];
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
      node,
      type,
      level,
      getComments(node)
    );
    type.getAliasTypeArguments().forEach((alias) => {
      this.addGenericParameter(mappedType, options, alias);
    });
    return mappedType;
  }
  private getFromRegistryOrCreateAnon(
    node: Node,
    type: Type,
    name: string,
    level: number,
    symbol?: Symbol
  ): IRegistryType {
    const fromRegistry = symbol && this.registry.getType(symbol);
    if (fromRegistry) {
      return fromRegistry;
    }
    const propertyText = type.getText();
    const fromText = this.registry.findTypeBySymbolText(propertyText);
    if (fromText) {
      return fromText;
    }
    if (level === MAX_DEPTH - 1) {
      console.warn("will fail on next iteration if recursion continues");
    }
    if (level >= MAX_DEPTH) {
      throw new Error(`Recursion depth exceeded.`);
    }
    console.debug(`Creating internal type ${name}`);
    const anon = this.createType({
      name,
      node,
      type,
      internal: true,
      level: level + 1,
    });
    return anon;
  }
  private getPropertyTypeFromRegistry(
    parentOptions: TypeOptions,
    propertyInfo: PropertyInfo
  ): IRegistryType {
    const { node, name, level } = parentOptions;
    const {
      propertyName,
      options,
      baseType,
      symbol: propertyTypeSymbol,
    } = propertyInfo;
    const { isArray } = options;
    const internalClassName = `${name}${propertyName}Class`;
    const apparentType = baseType.getApparentType();
    if (isArray) {
      const arrayElemTypeSymbol = getFinalSymbolOfType(apparentType)!;
      return this.getFromRegistryOrCreateAnon(
        node,
        baseType,
        internalClassName,
        level,
        arrayElemTypeSymbol
      );
    }
    return this.getFromRegistryOrCreateAnon(
      node,
      baseType,
      internalClassName,
      level,
      propertyTypeSymbol
    );
  }
  private handlePropertySignature(
    registryType: TypeRegistryType,
    parentOptions: TypeOptions,
    property: Symbol
  ) {
    const { node } = parentOptions;
    const propertyOptions = getPropertyOptions(node, property);
    const { propertyName, options, baseType, primitiveType } = propertyOptions;
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
      parentOptions,
      propertyOptions
    );
    return registryType.addProperty(
      propertyName,
      propertyTypeFromRegistry.getSymbol(),
      options
    );
  }
  private getGenericTypeConstraintFromRegistry(
    parentOptions: TypeOptions,
    paramName: string,
    constraintOptions: GenericConstraintOptions
  ): TypeReference {
    const { node, name, level } = parentOptions;
    const { baseType, symbol } = constraintOptions;
    const internalClassName = `${name}${paramName}ConstraintClass`;
    const isArray = baseType.isArray();
    const arrayDepth = getArrayDepth(baseType);
    const typeToUse = getFinalArrayType(baseType);
    const fromRegOrAnon = this.getFromRegistryOrCreateAnon(
      node,
      typeToUse,
      internalClassName,
      level,
      symbol
    );
    return {
      ref: fromRegOrAnon.getSymbol(),
      isArray,
      arrayDepth,
    };
  }
  private addGenericParameter<T extends TokenType>(
    registryType: TypeRegistryPossiblyGenericType<T>,
    parentOptions: TypeOptions,
    parameterType: Type
  ) {
    const v = (
      parameterType.getSymbol() ?? parameterType.getAliasSymbol()
    )?.getName();
    if (!v) {
      return;
    }
    const constraintType = parameterType.getConstraint();
    const constraint = constraintType
      ? this.getGenericTypeConstraintFromRegistry(
          parentOptions,
          v,
          getGenericConstraintOptions(constraintType)
        )
      : undefined;
    const p: GenericParameter = {
      name: v,
      constraint,
    };
    registryType.addGenericParameter(p);
  }
  private createTypeOrInterfaceType(options: TypeOptions): IRegistryType {
    const { name, node, type, internal, level } = options;
    const symbolToUse = createSymbol(name, type);
    const regType = new TypeRegistryType(
      this.registry,
      name,
      symbolToUse,
      internal,
      node,
      type,
      level,
      getComments(node)
    );
    type.getAliasTypeArguments().forEach((alias) => {
      this.addGenericParameter(regType, options, alias);
    });
    const propertySignatures = type.getApparentProperties();
    propertySignatures.forEach((property) =>
      this.handlePropertySignature(regType, options, property)
    );
    return regType;
  }
  private createTypeInternal(options: TypeOptions): IRegistryType {
    const asPrimitive = this.createPrimitiveType(options);
    if (asPrimitive) {
      return asPrimitive;
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
    const regType = this.createTypeOrInterfaceType(options);
    return regType;
  }
  createType(options: TypeOptions): IRegistryType {
    const regType = this.createTypeInternal(options);
    this.registry.addType(regType);
    return regType;
  }
}
