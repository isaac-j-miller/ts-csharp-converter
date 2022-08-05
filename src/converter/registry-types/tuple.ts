import { Node, Symbol, Type } from "ts-morph";
import { CSharpClass, CSharpGenericClass } from "src/csharp/elements";
import {
  ISyntheticSymbol,
  TypeReferenceWithGenericParameters,
  TypeReference,
  TypeStructure,
  PropertyStringArg,
} from "../types";
import { TypeRegistry } from "../registry";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { getGenericTypeName } from "../util";
import { NameMapper } from "../name-mapper/mapper";

export class TypeRegistryTupleType extends TypeRegistryPossiblyGenericType<"Tuple"> {
  private baseName: string;
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    members: TypeReferenceWithGenericParameters[],
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
  addGenericParameterToMember(memberIdx: number, parameter: PropertyStringArg) {
    if (!this.structure.tupleMembers ?? {}[memberIdx]) {
      throw new Error(
        `No tuple member at index ${memberIdx} on type ${this.structure.name}`
      );
    }
    this.structure.tupleMembers![memberIdx].genericParameters = [
      ...(this.structure.tupleMembers![memberIdx].genericParameters ?? []),
      parameter,
    ];
  }
  getPropertyString(genericParameterValues?: TypeReference[]): string {
    if (this.internal) {
      return this.getBaseClassName();
    }
    const { name } = this.structure;
    return getGenericTypeName(
      name,
      genericParameterValues?.map((t) => this.resolveAndFormatTypeName(t))
    );
  }
  private getBaseClassName(): string {
    const typeNames = (this.structure.tupleMembers ?? []).map((m) =>
      this.resolveAndFormatTypeName(m.ref, m.genericParameters)
    );
    return getGenericTypeName(this.baseName, typeNames);
  }
  getCSharpElement(): CSharpClass {
    const baseClass = this.getBaseClassName();
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        [],
        this.generateCSharpGenericParams(),
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
