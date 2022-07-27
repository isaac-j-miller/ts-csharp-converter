import { CSharpElement } from "src/csharp/elements";
import { PrimitiveTypeName, TypeStructure } from "../types";
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
      true
    );
  }
  getCSharpElement(): CSharpElement {
    throw new Error("Should not render primitive");
  }
}
