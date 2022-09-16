import { Node, Symbol, Type } from "ts-morph";
import { CSharpClass } from "src/csharp";
import { BaseTypeReference, ISyntheticSymbol, TypeReference, TypeStructure } from "../types";
import { TypeRegistry } from "../registry";
import { UnionSymbol } from "./class-union";
import { TypeRegistryWithBaseClassType } from "./with-baseclass";
import { ConfigDependentUtils } from "../util";

export class TypeRegistryClassUnionInstanceType extends TypeRegistryWithBaseClassType<"ClassUnionInstance"> {
  constructor(
    utils: ConfigDependentUtils,
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    internal: boolean,
    isDescendantOfPublic: boolean,
    type: Type,
    level: number,
    node: Node,
    commentString?: string
  ) {
    const structure: TypeStructure<"ClassUnionInstance"> = {
      tokenType: "ClassUnionInstance",
      name,
      members: [],
      commentString,
    };
    super(
      utils,
      registry,
      "ClassUnionInstance",
      name,
      symbol,
      internal,
      isDescendantOfPublic,
      type,
      level,
      node,
      false,
      undefined,
      false
    );
    this.structure = structure;
  }
  override addMember(member: TypeReference<BaseTypeReference>): void {
    super.addMember(member);
    this.baseName = `Union${this.structure.members!.length}`;
  }
  override getBaseTypeRef(): UnionSymbol {
    const baseSym = new UnionSymbol(this.structure.members?.length ?? 0);
    return baseSym;
  }
  override registerRefs(): void {
    super.registerRefs();
    const baseSym = this.getBaseTypeRef();
    const baseUnionFromReg = this.registry.getType(baseSym);
    if (!baseUnionFromReg) {
      throw new Error(`Missing ${baseSym.getName()}`);
    }
    this.refs.add(baseUnionFromReg.getHash());
  }
  override getCSharpElement(): CSharpClass {
    throw new Error("Should not render UnionClassInstance");
  }
}
