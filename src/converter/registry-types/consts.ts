import { CSharpClass, CSharpProperty } from "src/csharp/elements";
import { TypeRegistry } from "../registry";
import {
  isPrimitiveType,
  LiteralValue,
  PrimitiveType,
  PrimitiveTypeName,
  PropertyStructure,
  TypeStructure,
} from "../types";
import { literalValueToCSharpLiteralValue, toCSharpPrimitive } from "../util";
import { RegistryType } from "./base";

export class TypeRegistryConstType extends RegistryType<"Const"> {
  constructor(registry: TypeRegistry) {
    const structure: TypeStructure<"Const"> = {
      tokenType: "Const",
      name: "GlobalVars",
      properties: {},
    };
    super(
      registry,
      structure,
      {
        isConstType: true,
      },
      true,
      true,
      undefined,
      0
    );
  }
  private generateCSharpProperty(
    propName: string,
    struct: PropertyStructure
  ): CSharpProperty {
    const { baseType, defaultLiteralValue, isArray, arrayDepth, isOptional } =
      struct;
    if (!isPrimitiveType(baseType)) {
      throw new Error(
        `Const property ${this.structure.name}.${propName} is not a primitive type`
      );
    }
    const kindType = toCSharpPrimitive(baseType.primitiveType);
    const prop: CSharpProperty = {
      name: propName,
      accessLevel: "public",
      getter: false,
      setter: false,
      isConst: true,
      defaultValue: literalValueToCSharpLiteralValue(defaultLiteralValue),
      optional: isOptional,
      kind: isArray
        ? kindType + `[${",".repeat(arrayDepth ? arrayDepth - 1 : 0)}]`
        : kindType,
    };
    return prop;
  }
  addConst(
    name: string,
    type: PrimitiveType | PrimitiveTypeName,
    isArray: boolean,
    arrayDepth: number,
    value: LiteralValue
  ) {
    const baseType = isPrimitiveType(type)
      ? type
      : this.registry.getType(type).getSymbol();
    this.structure.properties![name] = {
      baseType,
      propertyName: name,
      isArray,
      arrayDepth,
      isOptional: false,
      defaultLiteralValue: value,
    };
  }
  getPropertyString(): string {
    return toCSharpPrimitive(this.structure.name as PrimitiveTypeName);
  }

  private generateCSharpProperties(): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(
      ([propName, struct]) => this.generateCSharpProperty(propName, struct)
    );
  }
  getCSharpElement(): CSharpClass {
    const properties = this.generateCSharpProperties();
    return new CSharpClass(this.structure.name, false, properties, true);
  }
}
