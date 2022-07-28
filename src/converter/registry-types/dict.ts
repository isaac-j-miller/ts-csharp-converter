import {
  CSharpClass,
  CSharpGenericClass,
  GenericParam,
} from "src/csharp/elements";
import { Symbol, Node, Type } from "ts-morph";
import { TypeRegistry } from "../registry";
import { ISyntheticSymbol, TypeReference } from "../types";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";

export class TypeRegistryDictType extends TypeRegistryPossiblyGenericType<"Dictionary"> {
  constructor(
    registry: TypeRegistry,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    public readonly indexType: TypeReference,
    public readonly valueType: TypeReference,
    internal: boolean,
    node: Node,
    type: Type,
    genericParameters?: string[]
  ) {
    super(registry, "Dictionary", name, sym, internal, !internal, node, type);
    this.structure.genericParameters = genericParameters;
  }
  private getBaseClassName(): string {
    const indexTypeName = this.resolveTypeName(this.indexType);
    const valueTypeName = this.resolveTypeName(this.valueType);
    return `System.Collections.Generic.Dictionary<${indexTypeName}, ${valueTypeName}>`;
  }
  getPropertyString(genericParameterValues?: string[]): string {
    if (this.internal) {
      return this.getBaseClassName();
    }
    const { name } = this.structure;
    if (genericParameterValues && genericParameterValues.length > 0) {
      return `${name}<${genericParameterValues.join(", ")}>`;
    }
    return name;
  }
  getCSharpElement(): CSharpClass {
    if (!this.shouldBeRendered) {
      throw new Error("Should not render dictionary");
    }
    const genericParams = (this.structure.genericParameters ?? []).reduce(
      (acc, curr) => {
        acc[curr] = { apparent: curr };
        return acc;
      },
      {} as Record<string, GenericParam>
    );
    const baseClassName = this.getBaseClassName();
    if (Object.keys(genericParams).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        [],
        genericParams,
        baseClassName,
        this.internal
      );
    }
    return new CSharpClass(this.structure.name, false, [], baseClassName);
  }
}
