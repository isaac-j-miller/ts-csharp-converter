import { CSharpClass } from "src/csharp/elements";
import { CSharpProperty } from "src/csharp/types";
import { NameMapper } from "../name-mapper";
import type { TypeRegistry } from "../registry";
import {
  IRegistryType,
  isPrimitiveType,
  LiteralValue,
  NonPrimitiveType,
  PrimitiveType,
  PrimitiveTypeName,
  PropertyStructure,
  TypeStructure,
} from "../types";
import {
  formatCSharpArrayString,
  literalValueToCSharpLiteralValue,
  toCSharpPrimitive,
} from "../util";
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
      false,
      false,
      undefined,
      0,
      false
    );
  }
  private generateCSharpProperty(
    propName: string,
    struct: PropertyStructure,
    mapper: NameMapper
  ): CSharpProperty {
    const { baseType, defaultLiteralValue, isArray, arrayDepth, isOptional, commentString } =
      struct;
    if (!isPrimitiveType(baseType)) {
      throw new Error(`Const property ${this.structure.name}.${propName} is not a primitive type`);
    }
    const kindType = toCSharpPrimitive(baseType.primitiveType);
    const literalValue = literalValueToCSharpLiteralValue(
      defaultLiteralValue,
      this.registry,
      mapper
    );
    const prop: CSharpProperty = {
      name: propName,
      accessLevel: "public",
      getter: false,
      setter: false,
      isConst: true,
      defaultValue: literalValue,
      isClassUnion: false,
      optional: isOptional || literalValue === "null",
      commentString,
      kind: formatCSharpArrayString(kindType, isArray, arrayDepth ?? 0),
    };
    return prop;
  }
  addConst(
    name: string,
    type: PrimitiveType | PrimitiveTypeName,
    isArray: boolean,
    arrayDepth: number,
    value: LiteralValue,
    commentString?: string
  ) {
    const baseType = isPrimitiveType(type) ? type : this.registry.getType(type).getSymbol();
    this.structure.properties![name] = {
      baseType,
      propertyName: name,
      isArray,
      arrayDepth,
      isOptional: false,
      defaultLiteralValue: value,
      commentString,
    };
  }
  getPropertyString(): string {
    return toCSharpPrimitive(this.structure.name as PrimitiveTypeName);
  }

  private generateCSharpProperties(mapper: NameMapper): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(([propName, struct]) =>
      this.generateCSharpProperty(propName, struct, mapper)
    );
  }
  getCSharpElement(mapper: NameMapper): CSharpClass {
    const properties = this.generateCSharpProperties(mapper);
    return new CSharpClass(this.structure.name, false, properties, true);
  }
  isNonPrimitive(): this is IRegistryType<NonPrimitiveType> {
    return false;
  }
  usesRef(): boolean {
    return false;
  }
}
