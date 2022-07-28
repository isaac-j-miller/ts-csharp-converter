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
  private symbolToString(propName: string, baseType: TypeReference): string {
    if (isGenericReference(baseType)) {
      return baseType.genericParamName;
    }
    const fromRegistry = this.registry.getType(baseType);
    if (fromRegistry) {
      return fromRegistry.getPropertyString();
    }
    const nonPrimitive = baseType as Symbol | ISyntheticSymbol;
    const name = nonPrimitive.getDeclaredType().getSymbol()?.getName();
    if (name) {
      return name;
    }
    console.warn(
      `Could not find type name for property ${this.structure.name}.${propName}`
    );
    return "object";
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
    if (genericParameterValues && genericParameterValues.length > 0) {
      return `${name}<${genericParameterValues.join(", ")}>`;
    }
    return name;
  }
}
