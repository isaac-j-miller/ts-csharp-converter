import { Symbol } from "ts-morph";
import { CSharpEnum } from "src/csharp/elements";
import { ISyntheticSymbol, TypeStructure } from "../types";
import { RegistryType } from "./base";

export class TypeRegistryUnionType extends RegistryType<"StringUnion"> {
  constructor(
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    members: string[],
    internal: boolean
  ) {
    const structure: TypeStructure<"StringUnion"> = {
      tokenType: "StringUnion",
      name,
      unionMembers: members,
    };
    super(structure, symbol, true, internal);
  }
  getCSharpElement(): CSharpEnum {
    return new CSharpEnum(
      this.structure.name!,
      this.structure.unionMembers!,
      this.internal
    );
  }
}
