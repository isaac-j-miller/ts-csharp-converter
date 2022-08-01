import { getGenericTypeName } from "src/converter/util";
import { CSharpClass } from "./class";
import { CSharpProperty, GenericParam, TAB_WIDTH } from "./types";

export class CSharpGenericClass extends CSharpClass {
  constructor(
    name: string,
    isPartial: boolean,
    properties: CSharpProperty[],
    public readonly genericOptions: Record<string, GenericParam>,
    inheritsFrom?: string,
    isInternal?: boolean
  ) {
    super(name, isPartial, properties, false, inheritsFrom, isInternal);
  }
  protected override serializeDeclaration(): string {
    let serialized = "";
    if (this.isPublic) {
      serialized += "public ";
    } else {
      serialized += "internal ";
    }
    if (this.isPartial) {
      serialized += "partial ";
    }
    const genericArgs = Object.keys(this.genericOptions);
    serialized += `class ${getGenericTypeName(this.name, genericArgs)} ${
      this.inheritsFrom ? `: ${this.inheritsFrom} ` : ""
    }{\n`;
    return serialized;
  }
}
