import { CSharpClass, CSharpGenericClass } from "src/csharp/elements";
import { Symbol, Node, Type } from "ts-morph";
import { TypeRegistry } from "../registry";
import { ISyntheticSymbol, PropertyStringArg, PropertyStringArgs, TypeReference } from "../types";
import { getGenericTypeName } from "../util";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";

export class TypeRegistryDictType extends TypeRegistryPossiblyGenericType<"Dictionary"> {
  private baseName: string;
  constructor(
    registry: TypeRegistry,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    public readonly indexType: TypeReference,
    public readonly valueType: TypeReference,
    internal: boolean,
    isDescendantOfPublic: boolean,
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
      isDescendantOfPublic,
      !(internal || isDescendantOfPublic),
      node,
      type,
      level,
      true
    );
    this.structure.genericParameters = genericParameters?.map(g => ({
      name: g,
    }));
    this.structure.mappedIndexType = indexType;
    this.structure.mappedValueType = valueType;
    this.structure.commentString = commentString;
    this.baseName = "System.Collections.Generic.Dictionary";
  }
  private getGenericParamName(defaultRef: TypeReference, override?: PropertyStringArg): string {
    if (!override) {
      return this.resolveAndFormatTypeName(defaultRef);
    }
    if (typeof override === "string") {
      return override;
    }
    return this.resolveAndFormatTypeName(override);
  }
  private getBaseClassName(genericParameters?: PropertyStringArgs): string {
    const g = genericParameters ?? [];
    const indexTypeName = this.getGenericParamName(this.indexType, g[0]);
    const valueTypeName = this.getGenericParamName(this.valueType, g[1]);
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
  getPropertyString(genericParameterValues?: PropertyStringArgs): string {
    if (this.internal) {
      return this.getBaseClassName(genericParameterValues);
    }
    const { name } = this.structure;
    const namesToUse = this.getGenericParametersForPropertyString(genericParameterValues ?? []);
    return getGenericTypeName(name, namesToUse);
  }
  getCSharpElement(): CSharpClass {
    if (!this.shouldBeRendered) {
      throw new Error("Should not render dictionary");
    }
    const genericParams = this.generateCSharpGenericParams();
    const baseClassName = this.getBaseClassName();
    if (Object.keys(genericParams).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        [],
        genericParams,
        baseClassName,
        [],
        [],
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
      [],
      [],
      this.internal,
      this.structure.commentString
    );
  }
}
