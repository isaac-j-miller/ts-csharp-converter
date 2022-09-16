import { Node, Symbol, Type } from "ts-morph";
import { ISyntheticSymbol, TypeStructure } from "../types";
import { TypeRegistry } from "../registry";
import { TypeRegistryWithBaseClassType } from "./with-baseclass";
import { ConfigDependentUtils } from "../util";

export class TypeRegistryTupleType extends TypeRegistryWithBaseClassType<"Tuple"> {
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
    const structure: TypeStructure<"Tuple"> = {
      tokenType: "Tuple",
      name,
      members: [],
      commentString,
    };
    super(
      utils,
      registry,
      "Tuple",
      name,
      symbol,
      internal,
      isDescendantOfPublic,
      type,
      level,
      node,
      false
    );
    this.structure = structure;
    this.baseName = "System.Tuple";
  }
}
