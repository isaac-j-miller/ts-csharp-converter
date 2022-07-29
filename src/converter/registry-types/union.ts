import { Symbol, Type } from "ts-morph";
import { CSharpEnum } from "src/csharp/elements";
import { ISyntheticSymbol, TypeStructure } from "../types";
import { RegistryType } from "./base";
import { TypeRegistry } from "../registry";

export class TypeRegistryUnionType extends RegistryType<"StringUnion"> {
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    members: string[],
    internal: boolean,
    type: Type
  ) {
    const structure: TypeStructure<"StringUnion"> = {
      tokenType: "StringUnion",
      name,
      unionMembers: members,
    };
    super(registry, structure, symbol, true, internal, type);
  }
  getPropertyString(): string {
    return this.structure.name;
  }
  getCSharpElement(): CSharpEnum {
    return new CSharpEnum(
      this.structure.name!,
      this.structure.unionMembers!,
      this.internal
    );
  }
}
