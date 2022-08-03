import { Node, Symbol, Type } from "ts-morph";
import { CSharpClass, CSharpGenericClass } from "src/csharp/elements";
import { ISyntheticSymbol, TypeReference, TypeStructure } from "../types";
import { TypeRegistry } from "../registry";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { getGenericTypeName } from "../util";

export class TypeRegistryTupleType extends TypeRegistryPossiblyGenericType<"Tuple"> {
  private baseName: string;
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    members: TypeReference[],
    internal: boolean,
    type: Type,
    level: number,
    node: Node,
    commentString?: string
  ) {
    const structure: TypeStructure<"Tuple"> = {
      tokenType: "Tuple",
      name,
      tupleMembers: members,
      commentString,
    };
    super(
      registry,
      "Tuple",
      name,
      symbol,
      internal,
      true,
      node,
      type,
      level,
      false
    );
    this.structure = structure;
    this.baseName = "System.Tuple";
  }
  getPropertyString(genericParameterValues?: string[]): string {
    if (this.internal) {
      return this.getBaseClassName();
    }
    const { name } = this.structure;
    return getGenericTypeName(name, genericParameterValues);
  }
  private getBaseClassName(): string {
    const typeNames = (this.structure.tupleMembers ?? []).map((m) =>
      this.resolveAndFormatTypeName(m)
    );
    return getGenericTypeName(this.baseName, typeNames);
  }
  getCSharpElement(): CSharpClass {
    const genericParams = this.getUsedGenericParams();
    const baseClass = this.getBaseClassName();
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        [],
        this.generateCSharpGenericParams(genericParams),
        baseClass,
        this.internal,
        this.structure.commentString
      );
    }
    return new CSharpClass(
      this.structure.name,
      false,
      [],
      false,
      baseClass,
      this.internal,
      this.structure.commentString
    );
  }
}
