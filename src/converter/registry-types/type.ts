import { Symbol, Node, Type } from "ts-morph";
import {
  CSharpProperty,
  GenericParam,
  CSharpClass,
  CSharpGenericClass,
} from "src/csharp/elements";
import { TypeRegistry } from "../registry";
import {
  isGenericReference,
  ISyntheticSymbol,
  PropertyStructure,
  TypeReference,
} from "../types";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { getFinalSymbolOfType, getGenericTypeName } from "../util";

export type PropertyOptions = Omit<
  PropertyStructure,
  "propertyName" | "baseType"
>;

export class TypeRegistryType extends TypeRegistryPossiblyGenericType<"Type"> {
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    internal: boolean,
    node: Node,
    type: Type
  ) {
    super(registry, "Type", name, symbol, internal, true, node, type);
    this.structure.properties = {};
    this.structure.genericParameters = [];
  }
  addProperty(
    propertyName: string,
    baseType: TypeReference,
    options: PropertyOptions
  ) {
    const propertyStructure: PropertyStructure = {
      ...options,
      propertyName,
      baseType,
    };
    this.structure.properties![propertyName] = propertyStructure;
    if (isGenericReference(baseType)) {
      const paramName = baseType.genericParamName;
      const { genericParameters } = this.structure;
      if (!genericParameters?.find((p) => p === paramName)) {
        if (!genericParameters || genericParameters.length === 0) {
          this.structure.genericParameters = [paramName];
        } else if (genericParameters.includes("__type")) {
          const idx = genericParameters.findIndex((item) => item === "__type");
          this.structure.genericParameters![idx] = paramName;
        } else {
          this.structure.genericParameters!.push(paramName);
        }
      }
    }
  }
  private getArgString(t: Type): string | undefined {
    const name = (t.getAliasSymbol() ?? t.getSymbol())?.getName();
    if (!name) {
      return;
    }
    const aliasArgs = t.getAliasTypeArguments();
    const argsList = aliasArgs
      .map((a) => this.getArgString(a))
      .filter((a) => a !== undefined) as string[];
    return getGenericTypeName(name, argsList);
  }
  private getGenericParametersOfProperty(
    propName: string
  ): string[] | undefined {
    const property = (this.structure.properties ?? {})[propName];
    if (!property) {
      return;
    }
    const thisType = this.getType();
    if (!thisType) {
      return;
    }
    const matchingProperty = thisType.getApparentProperty(propName);
    if (!matchingProperty) {
      throw new Error(
        `Property ${propName} declared but not found on type ${this.structure.name}`
      );
    }
    const valueDec = matchingProperty.getValueDeclaration();
    if (!valueDec) {
      console.warn(
        `Property ${propName} declared on type ${this.structure.name} but no value declaration found`
      );
      return;
    }
    const valueDecType = valueDec.getType();
    let elemToUse = valueDecType;
    if (property.isArray) {
      elemToUse = valueDecType.getArrayElementType()!;
      if (!elemToUse) {
        throw new Error(
          `Property ${propName} on type ${this.structure.name} is supposed to be an array but the underlying declaration contradicts`
        );
      }
    }
    const args = elemToUse
      .getAliasTypeArguments()
      .map((a) => this.getArgString(a))
      .filter((arg) => arg !== undefined) as string[];
    return args;
  }
  private symbolToString(propName: string, baseType: TypeReference): string {
    if (isGenericReference(baseType)) {
      return baseType.genericParamName;
    }
    const fromRegistry = this.registry.getType(baseType);
    if (fromRegistry) {
      const genericParameters = this.getGenericParametersOfProperty(propName);
      return fromRegistry.getPropertyString(genericParameters);
    }
    return this.resolveTypeName(baseType);
  }
  private generateCSharpProperty(
    propName: string,
    struct: PropertyStructure
  ): CSharpProperty {
    const { baseType } = struct;
    const kindType = this.symbolToString(propName, baseType);
    const prop: CSharpProperty = {
      name: propName,
      accessLevel: "public",
      getter: true,
      setter: true,
      optional: struct.isOptional,
      kind: struct.isArray ? kindType + "[]" : kindType,
    };
    return prop;
  }

  private generateCSharpProperties(): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(
      ([propName, struct]) => this.generateCSharpProperty(propName, struct)
    );
  }
  private generateCSharpGenericParams(): Record<string, GenericParam> {
    return this.structure.genericParameters!.reduce((acc, curr) => {
      acc[curr] = {};
      return acc;
    }, {} as Record<string, GenericParam>);
  }
  getCSharpElement(): CSharpClass {
    const props = this.generateCSharpProperties();
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        props,
        this.generateCSharpGenericParams(),
        undefined,
        this.internal
      );
    }
    return new CSharpClass(
      this.structure.name,
      false,
      props,
      undefined,
      this.internal
    );
  }
  getPropertyString(genericParameterValues?: string[]): string {
    const { name } = this.structure;
    return getGenericTypeName(name, genericParameterValues);
  }
}
