import { CSharpElement } from "src/csharp/elements";
import { TypeRegistry } from "../registry";
import { PrimitiveType, PrimitiveTypeName, TypeStructure } from "../types";
import { toCSharpPrimitive } from "../util";
import { RegistryType } from "./base";

export class TypeRegistryPrimitiveType extends RegistryType<"Primitive"> {
  constructor(registry: TypeRegistry, name: PrimitiveTypeName) {
    const structure: TypeStructure<"Primitive"> = {
      tokenType: "Primitive",
      name,
    };
    super(
      registry,
      structure,
      {
        isPrimitiveType: true,
        primitiveType: name,
      },
      false,
      true,
      undefined,
      0
    );
  }
  getPropertyString(): string {
    return toCSharpPrimitive(this.structure.name as PrimitiveTypeName);
  }
  getSymbol(): PrimitiveType {
    return super.getSymbol() as PrimitiveType;
  }
  getCSharpElement(): CSharpElement {
    throw new Error("Should not render primitive");
  }
}
