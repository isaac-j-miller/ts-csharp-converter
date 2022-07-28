import { CSharpElement } from "src/csharp/elements";
import { PrimitiveTypeName, TypeStructure } from "../types";
import { toCSharpPrimitive } from "../util";
import { RegistryType } from "./base";

export class TypeRegistryPrimitiveType extends RegistryType<"Primitive"> {
  constructor(name: PrimitiveTypeName) {
    const structure: TypeStructure<"Primitive"> = {
      tokenType: "Primitive",
      name,
    };
    super(
      structure,
      {
        isPrimitiveType: true,
        primitiveType: name,
      },
      false,
      true,
      undefined
    );
  }
  getPropertyString(): string {
    return toCSharpPrimitive(this.structure.name as PrimitiveTypeName);
  }
  getCSharpElement(): CSharpElement {
    throw new Error("Should not render primitive");
  }
}
