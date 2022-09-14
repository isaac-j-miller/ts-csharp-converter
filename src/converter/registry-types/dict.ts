import { Symbol, Node, Type } from "ts-morph";
import { TypeRegistry } from "../registry";
import { ISyntheticSymbol, PropertyStringArg, PropertyStringArgs, TypeReference } from "../types";
import { ConfigDependentUtils, getGenericTypeName } from "../util";
import { TypeRegistryWithBaseClassType } from "./with-baseclass";

export class TypeRegistryDictType extends TypeRegistryWithBaseClassType<"Dictionary"> {
  constructor(
    utils: ConfigDependentUtils,
    registry: TypeRegistry,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    internal: boolean,
    isDescendantOfPublic: boolean,
    node: Node,
    type: Type,
    level: number,
    commentString?: string,
    genericParameters?: string[]
  ) {
    super(
      utils,
      registry,
      "Dictionary",
      name,
      sym,
      internal,
      isDescendantOfPublic,
      type,
      level,
      node,
      true
    );
    this.structure.genericParameters = genericParameters?.map(g => ({
      name: g,
    }));
    this.structure.commentString = commentString;
    this.baseName = "System.Collections.Generic.Dictionary";
  }
  addIndex(index: TypeReference) {
    this.structure.mappedIndexType = index;
  }
  addValue(value: TypeReference) {
    this.structure.mappedValueType = value;
  }
  protected override getBaseClassName(genericParameters?: PropertyStringArgs): string {
    const g = genericParameters ?? [];
    const indexTypeName = this.getGenericParamName(this.structure.mappedIndexType!, g[0]);
    const valueTypeName = this.getGenericParamName(this.structure.mappedValueType!, g[1]);
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
}
