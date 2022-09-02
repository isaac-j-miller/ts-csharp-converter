import { Node, Symbol, Type } from "ts-morph";
import { ISyntheticSymbol, TypeStructure } from "../types";
import { TypeRegistry } from "../registry";
import { TypeRegistryWithBaseClassType } from "./with-baseclass";

export class TypeRegistryTupleType extends TypeRegistryWithBaseClassType<"Tuple"> {
  constructor(
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
