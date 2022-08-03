import { Symbol, Node, Type } from "ts-morph";
import {
  CSharpProperty,
  CSharpClass,
  CSharpGenericClass,
} from "src/csharp/elements";
import { TypeRegistry } from "../registry";
import {
  BaseTypeReference,
  isGenericReference,
  ISyntheticSymbol,
  PropertyStructure,
  TypeReference,
} from "../types";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { formatCsharpArrayString, getGenericTypeName } from "../util";

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
    type: Type,
    level: number
  ) {
    super(registry, "Type", name, symbol, internal, true, node, type, level);
    this.structure.properties = {};
    this.structure.genericParameters = [];
  }
  addProperty(
    propertyName: string,
    baseType: BaseTypeReference,
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
      const genericParameterNames = (genericParameters ?? []).map(
        (g) => g.name
      );
      if (!genericParameters?.find((p) => p.name === paramName)) {
        if (!genericParameters || genericParameters.length === 0) {
          this.structure.genericParameters = [{ name: paramName }];
        } else if (genericParameterNames.includes("__type")) {
          const idx = genericParameters.findIndex(
            (item) => item.name === "__type"
          );
          this.structure.genericParameters![idx] = {
            ...(this.structure.genericParameters![idx] ?? {}),
            name: paramName,
          };
        } else {
          this.structure.genericParameters!.push({
            name: paramName,
          });
        }
      }
    }
  }
  private generateCSharpProperty(
    propName: string,
    struct: PropertyStructure
  ): CSharpProperty {
    const { baseType, isOptional, isArray, arrayDepth } = struct;
    const kindType = this.propertySymbolToString(propName, baseType);
    const prop: CSharpProperty = {
      name: propName,
      accessLevel: "public",
      getter: true,
      setter: true,
      isConst: false,
      optional: isOptional,
      kind: formatCsharpArrayString(kindType, isArray, arrayDepth ?? 0),
    };
    return prop;
  }

  private generateCSharpProperties(): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(
      ([propName, struct]) => this.generateCSharpProperty(propName, struct)
    );
  }

  getCSharpElement(): CSharpClass {
    const props = this.generateCSharpProperties();
    const genericParams = this.getUsedGenericParams();
    const partial = this.isMappedType;
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        partial,
        props,
        this.generateCSharpGenericParams(genericParams),
        undefined,
        this.internal
      );
    }
    return new CSharpClass(
      this.structure.name,
      partial,
      props,
      false,
      undefined,
      this.internal
    );
  }
  getPropertyString(genericParameterValues?: string[]): string {
    const { name } = this.structure;
    return getGenericTypeName(name, genericParameterValues);
  }
}
