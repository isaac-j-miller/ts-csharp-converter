import {
  CSharpClass,
  CSharpGenericClass,
  GenericParam,
} from "src/csharp/elements";
import { Symbol, Node, Type } from "ts-morph";
import { TypeRegistry } from "../registry";
import {
  ISyntheticSymbol,
  TypeReferenceWithGenericParameters,
  PropertyStringArg,
  TypeReference,
} from "../types";
import { getGenericTypeName } from "../util";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";

export class TypeRegistryDictType extends TypeRegistryPossiblyGenericType<"Dictionary"> {
  private baseName: string;
  constructor(
    registry: TypeRegistry,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    public readonly indexType: TypeReferenceWithGenericParameters,
    public readonly valueType: TypeReferenceWithGenericParameters,
    internal: boolean,
    node: Node,
    type: Type,
    level: number,
    commentString?: string,
    genericParameters?: string[]
  ) {
    super(
      registry,
      "Dictionary",
      name,
      sym,
      internal,
      !internal,
      node,
      type,
      level,
      true
    );
    this.structure.genericParameters = genericParameters?.map((g) => ({
      name: g,
    }));
    this.structure.mappedIndexType = indexType;
    this.structure.mappedValueType = valueType;
    this.structure.commentString = commentString;
    this.baseName = "System.Collections.Generic.Dictionary";
  }
  private getBaseClassName(): string {
    if (this.structure.name === "ZZZxClass") {
      console.debug();
    }
    const indexTypeName = this.resolveAndFormatTypeName(
      this.indexType.ref,
      this.indexType.genericParameters
    );
    const valueTypeName = this.resolveAndFormatTypeName(
      this.valueType.ref,
      this.valueType.genericParameters
    );
    return getGenericTypeName(this.baseName, [indexTypeName, valueTypeName]);
  }
  private addGenericParameterToIndexOrValue(
    key: "mappedIndexType" | "mappedValueType",
    parameter: PropertyStringArg
  ) {
    this.structure[key]!.genericParameters = [
      ...(this.structure[key]!.genericParameters ?? []),
      parameter,
    ];
  }
  addGenericParameterToIndex(parameter: PropertyStringArg) {
    this.addGenericParameterToIndexOrValue("mappedIndexType", parameter);
  }
  addGenericParameterToValue(parameter: PropertyStringArg) {
    this.addGenericParameterToIndexOrValue("mappedValueType", parameter);
  }
  getPropertyString(genericParameterValues?: TypeReference[]): string {
    if (this.internal) {
      return this.getBaseClassName();
    }
    const { name } = this.structure;
    const namesToUse = this.getGenericParametersForPropertyString(
      genericParameterValues ?? []
    );
    return getGenericTypeName(name, namesToUse);
  }
  getCSharpElement(): CSharpClass {
    if (!this.shouldBeRendered) {
      throw new Error("Should not render dictionary");
    }
    const genericParams = (this.structure.genericParameters ?? []).reduce(
      (acc, curr) => {
        acc[curr.name] = {};
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
        this.internal,
        this.structure.commentString
      );
    }
    return new CSharpClass(
      this.structure.name,
      false,
      [],
      false,
      baseClassName,
      this.internal,
      this.structure.commentString
    );
  }
}
