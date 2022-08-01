import { Node, Symbol, Type } from "ts-morph";
import { TypeRegistry } from "./registry";
import {
  PropertyOptions,
  TypeRegistryDictType,
  TypeRegistryType,
  TypeRegistryUnionType,
} from "./registry-types";
import { TypeRegistryPossiblyGenericType } from "./registry-types/possibly-generic";
import {
  GenericParameter,
  IRegistryType,
  PrimitiveTypeName,
  TokenType,
  UnionMember,
} from "./types";
import {
  asPrimitiveTypeName,
  createSymbol,
  getArrayDepth,
  getFinalArrayType,
  getFinalSymbolOfType,
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

function getPropertyOptions(
  parentNode: Node,
  propertySymbol: Symbol
): PropertyInfo {
  const propertyName = propertySymbol.getName();
  const isOptional = propertySymbol.isOptional();
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
  const primitiveType = asPrimitiveTypeName(baseType);
  const options = { isArray, isOptional, genericParameters, arrayDepth };
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
        options.level
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
      return this.registry.getType("number");
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
    const { name, type, internal, level } = options;
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
      level
    );
  }
  private createMappedType(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal, level } = options;
    const symbolToUse = createSymbol(name, type);
    const stringIndexType = type.getStringIndexType();
    if (!stringIndexType) {
      return;
    }
    const valueType = stringIndexType.getApparentType();
    const indexType = this.registry.getType("string").getSymbol();
    const valueTypeName = `${name}Value`;
    console.debug(`Creating internal type ${valueTypeName}`);
    const vType = this.createType({
      name: valueTypeName,
      node,
      type: valueType,
      internal: true,
      level: level + 1,
    });

    const mappedType = new TypeRegistryDictType(
      this.registry,
      name,
      symbolToUse,
      indexType,
      vType.getSymbol(),
      internal,
      node,
      type,
      level
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
  ): IRegistryType {
    const { node, name, level } = parentOptions;
    const { baseType, symbol } = constraintOptions;
    const internalClassName = `${name}${paramName}ConstraintClass`;
    return this.getFromRegistryOrCreateAnon(
      node,
      baseType,
      internalClassName,
      level + 1,
      symbol
    );
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
    const constraint = parameterType.getConstraint();
    const typeFromRegistry = constraint
      ? this.getGenericTypeConstraintFromRegistry(
          parentOptions,
          v,
          getGenericConstraintOptions(constraint)
        )
      : undefined;
    const p: GenericParameter = {
      name: v,
      constraint: typeFromRegistry?.getSymbol(),
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
      level
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
