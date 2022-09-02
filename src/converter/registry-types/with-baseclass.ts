import { Node, Symbol, Type } from "ts-morph";
import { CSharpClass, CSharpGenericClass } from "src/csharp/elements";
import { ConstructorParam } from "src/csharp/types";
import {
  ISyntheticSymbol,
  TypeReference,
  TypeStructure,
  TokenType,
  UnderlyingType,
  PropertyStringArgs,
  PropertyStringArg,
  MemberType,
} from "../types";
import { TypeRegistry } from "../registry";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { getGenericTypeName } from "../util";

export abstract class TypeRegistryWithBaseClassType<
  T extends Exclude<TokenType, "Const" | "Primitive" | "ClassUnion" | "StringUnion">
> extends TypeRegistryPossiblyGenericType<T> {
  protected baseName!: string;
  constructor(
    registry: TypeRegistry,
    tokenType: T,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    internal: boolean,
    isDescendantOfPublic: boolean,
    type: Type,
    level: number,
    node: Node,
    isMappedType: boolean,
    commentString?: string
  ) {
    const structure: TypeStructure<T> = {
      tokenType,
      name,
      members: [],
      commentString,
    };
    super(
      registry,
      tokenType,
      name,
      symbol,
      internal,
      isDescendantOfPublic,
      !(internal || isDescendantOfPublic),
      node as T extends "ClassUnion" ? undefined : Node,
      type as UnderlyingType<T>,
      level,
      isMappedType
    );
    this.structure = structure;
  }

  addMember(member: MemberType<T>) {
    if (!this.structure.members) {
      this.structure.members = [member];
    } else {
      this.structure.members?.push(member);
    }
  }

  addGenericParameterToMember(memberIdx: number, parameter: PropertyStringArg) {
    if (!this.structure.members || !this.structure.members[memberIdx]) {
      throw new Error(`No member at index ${memberIdx} on type ${this.structure.name}`);
    }

    this.structure.members[memberIdx].genericParameters = [
      ...(this.structure.members[memberIdx].genericParameters ?? []),
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
    const typeNames = (this.structure.members ?? []).map(m => this.resolveAndFormatTypeName(m));
    return typeNames.map((tname, i) => ({
      name: `arg${i}`,
      type: tname,
    }));
  }
  protected getGenericParamName(defaultRef: TypeReference, override?: PropertyStringArg): string {
    if (!override) {
      return this.resolveAndFormatTypeName(defaultRef);
    }
    if (typeof override === "string") {
      return override;
    }
    return this.resolveAndFormatTypeName(override);
  }
  protected getBaseClassName(genericParameters?: PropertyStringArgs): string {
    const g = genericParameters ?? [];
    const paramNames = (this.structure.members ?? []).map((m, i) =>
      this.getGenericParamName(m as TypeReference, g[i])
    );
    return getGenericTypeName(this.baseName, paramNames);
  }
  getCSharpElement(): CSharpClass {
    if (!this.shouldBeRendered) {
      throw new Error(`Should not render ${this.tokenType}.${this.structure.name}`);
    }
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
