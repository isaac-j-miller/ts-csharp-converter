import { Symbol } from "ts-morph";
import {
  CSharpProperty,
  GenericParam,
  CSharpClass,
  CSharpGenericClass,
} from "src/csharp/elements";
import { TypeRegistry } from "../registry";
import {
  GenericReference,
  isGenericReference,
  isPrimitiveType,
  ISyntheticSymbol,
  PrimitiveType,
  PropertyStructure,
  TypeStructure,
} from "../types";
import { RegistryType } from "./base";
import { toCSharpPrimitive } from "../util";

export type PropertyOptions = Omit<
  PropertyStructure,
  "propertyName" | "baseType"
>;

export class TypeRegistryType extends RegistryType<"Type"> {
  constructor(
    private registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    internal: boolean
  ) {
    const structure: TypeStructure<"Type"> = {
      tokenType: "Type",
      name,
      properties: {},
      genericParameters: [],
    };
    super(structure, symbol, true, internal);
  }
  addProperty(
    propertyName: string,
    baseType: Symbol | PrimitiveType | GenericReference | ISyntheticSymbol,
    options: PropertyOptions
  ) {
    const propertyStructure: PropertyStructure = {
      ...options,
      propertyName,
      baseType,
    };
    this.structure.properties![propertyName] = propertyStructure;
  }
  addGenericParameter(param: string) {
    this.structure.genericParameters!.push(param);
  }
  private generateCSharpProperties(): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(
      ([propName, struct]) => {
        let kindType = "object";
        const { baseType } = struct;
        if (isPrimitiveType(baseType)) {
          kindType = toCSharpPrimitive(baseType.primitiveType);
        } else if (isGenericReference(baseType)) {
          kindType = baseType.genericParamName;
        } else {
          const fromRegistry = this.registry.getType(baseType);
          if (fromRegistry) {
            kindType = fromRegistry.getStructure().name;
          } else {
            const name = baseType.getDeclaredType().getSymbol()?.getName();
            if (name) {
              kindType = name;
            } else {
              console.warn(
                `Could not find type name for property ${this.structure.name}.${propName}`
              );
            }
          }
        }

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
}
