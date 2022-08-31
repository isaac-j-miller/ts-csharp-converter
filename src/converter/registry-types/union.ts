import { Symbol, Type } from "ts-morph";
import { CSharpEnum } from "src/csharp/elements";
import { ISyntheticSymbol, TypeStructure, UnionMember } from "../types";
import { RegistryType } from "./base";
import { TypeRegistry } from "../registry";

export class TypeRegistryUnionType extends RegistryType<"StringUnion"> {
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    members: UnionMember[],
    internal: boolean,
    isDescendantOfPublic: boolean,
    type: Type,
    level: number,
    private readonly isStringEnum: boolean,
    commentString?: string
  ) {
    const structure: TypeStructure<"StringUnion"> = {
      tokenType: "StringUnion",
      name,
      unionMembers: members,
      commentString,
    };
    super(registry, structure, symbol, true, internal, isDescendantOfPublic, type, level, false);
  }
  usesRef(): boolean {
    return false;
  }
  getPropertyString(): string {
    return this.structure.name;
  }
  getCSharpElement(): CSharpEnum {
    return new CSharpEnum(
      this.structure.name!,
      this.structure.unionMembers!,
      this.isStringEnum,
      this.internal
    );
  }
}
