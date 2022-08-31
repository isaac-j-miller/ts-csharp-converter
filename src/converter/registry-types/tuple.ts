import { Node, Symbol, Type } from "ts-morph";
import { CSharpClass, CSharpGenericClass } from "src/csharp/elements";
import { ConstructorParam } from "src/csharp/types";
import { ISyntheticSymbol, TypeReference, TypeStructure, PropertyStringArg } from "../types";
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
    isDescendantOfPublic: boolean,
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
      isDescendantOfPublic,
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
      throw new Error(`No tuple member at index ${memberIdx} on type ${this.structure.name}`);
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
      genericParameterValues?.map(t => this.resolveAndFormatTypeName(t))
    );
  }
  private getConstructorParams(): ConstructorParam[] {
    const typeNames = (this.structure.tupleMembers ?? []).map(m =>
      this.resolveAndFormatTypeName(m)
    );
    return typeNames.map((tname, i) => ({
      name: `arg${i}`,
      type: tname,
    }));
  }
  private getBaseClassName(): string {
    const typeNames = (this.structure.tupleMembers ?? []).map(m =>
      this.resolveAndFormatTypeName(m)
    );
    return getGenericTypeName(this.baseName, typeNames);
  }
  getCSharpElement(): CSharpClass {
    const baseClass = this.getBaseClassName();
    const constructorArgs = this.getConstructorParams();
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        [],
        this.generateCSharpGenericParams(),
        baseClass,
        constructorArgs.map(c => c.name),
        constructorArgs,
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
      constructorArgs.map(c => c.name),
      constructorArgs,
      this.internal,
      this.structure.commentString
    );
  }
}
