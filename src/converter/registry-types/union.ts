import { Symbol, Type } from "ts-morph";
import { CSharpEnum } from "src/csharp/elements";
import { ISyntheticSymbol, TypeStructure, UnionEnumMember } from "../types";
import { RegistryType } from "./base";
import { TypeRegistry } from "../registry";
import { ConfigDependentUtils } from "../util";

export class TypeRegistryUnionType extends RegistryType<"StringUnion"> {
  constructor(
    utils: ConfigDependentUtils,
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    members: UnionEnumMember[],
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
      members,
      commentString,
    };
    super(
      utils,
      registry,
      structure,
      symbol,
      true,
      internal,
      isDescendantOfPublic,
      type,
      level,
      false
    );
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
      this.structure.members!,
      this.isStringEnum,
      this.internal
    );
  }
}
