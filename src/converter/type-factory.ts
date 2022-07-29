import { Node, Symbol, Type } from "ts-morph";
import { TypeRegistry } from "./registry";
import {
  PropertyOptions,
  TypeRegistryDictType,
  TypeRegistryType,
  TypeRegistryUnionType,
} from "./registry-types";
import { IRegistryType, PrimitiveTypeName, UnionMember } from "./types";
import {
  asPrimitiveTypeName,
  createSymbol,
  getFinalSymbolOfType,
} from "./util";

type TypeOptions = {
  name: string;
  node: Node;
  type: Type;
  internal: boolean;
};
type PropertyInfo = {
  propertyName: string;
  type: Type;
  symbol?: Symbol;
  arrayElemType?: Type;
  primitiveType?: PrimitiveTypeName;
  options: PropertyOptions;
};

function getPropertyOptions(
  parentNode: Node,
  propertySymbol: Symbol
): PropertyInfo {
  const propertyName = propertySymbol.getName();
  const isOptional = propertySymbol.isOptional();
  const type = propertySymbol.getTypeAtLocation(parentNode);
  const isArray = type.isArray();
  const typeArgs = type.getAliasTypeArguments();
  const genericParameters = typeArgs.map(
    (t) =>
      t.getAliasSymbol()?.getName() ?? t.getSymbol()?.getName() ?? t.getText()
  );
  const symbol = type.getSymbol();
  const arrayElemType = type.getArrayElementType();
  const primitiveType = asPrimitiveTypeName(type);
  const options = { isArray, isOptional, genericParameters };
  return {
    propertyName,
    type,
    symbol,
    arrayElemType,
    primitiveType,
    options,
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
        type
      );
      return unionRegType;
    }
    if (nonUndefinedUnionTypes.length === 1) {
      return this.createType({
        name,
        node,
        type: nonUndefinedUnionTypes[0],
        internal,
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
    const { name, type, internal } = options;
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
      type
    );
  }
  private createMappedType(options: TypeOptions): IRegistryType | undefined {
    const { name, node, type, internal } = options;
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
    });

    const mappedType = new TypeRegistryDictType(
      this.registry,
      name,
      symbolToUse,
      indexType,
      vType.getSymbol(),
      internal,
      node,
      type
    );
    mappedType.addGenericParameters(type);
    console.debug(`Adding mapped type ${name} to registry`);
    return mappedType;
  }
  private getFromRegistryOrCreateAnon(
    node: Node,
    type: Type,
    name: string,
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
    });
    return anon;
  }
  private getPropertyTypeFromRegistry(
    parentOptions: TypeOptions,
    propertyInfo: PropertyInfo
  ): IRegistryType {
    const { node, name } = parentOptions;
    const {
      propertyName,
      options,
      type: propertyType,
      symbol: propertyTypeSymbol,
      arrayElemType,
    } = propertyInfo;
    const { isArray } = options;
    const internalClassName = `${name}${propertyName}Class`;
    if (isArray) {
      const arrayElemTypeSymbol = getFinalSymbolOfType(
        arrayElemType!.getApparentType()
      )!;
      return this.getFromRegistryOrCreateAnon(
        node,
        arrayElemType!,
        internalClassName,
        arrayElemTypeSymbol
      );
    }
    return this.getFromRegistryOrCreateAnon(
      node,
      propertyType,
      internalClassName,
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
    const {
      propertyName,
      options,
      type: propertyType,
      primitiveType,
    } = propertyOptions;
    if (propertyType.isTypeParameter()) {
      const genericParamName = propertyType.getSymbolOrThrow().getName();
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

  private createTypeOrInterfaceType(options: TypeOptions): IRegistryType {
    const { name, node, type, internal } = options;
    const symbolToUse = createSymbol(name, type);
    const regType = new TypeRegistryType(
      this.registry,
      name,
      symbolToUse,
      internal,
      node,
      type
    );
    if (name === "IndexTypeaClass") {
      console.debug("here");
    }
    regType.addGenericParameters(type);
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
    const { tokenType, name } = regType.getStructure();
    console.debug(`Adding ${tokenType} type ${name} to registry`);
    this.registry.addType(regType);
    return regType;
  }
}
