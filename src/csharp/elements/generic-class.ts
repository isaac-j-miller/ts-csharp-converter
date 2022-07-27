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
    super(name, isPartial, properties, inheritsFrom, isInternal);
  }
  protected serializeDeclaration(): string {
    let serialized = "";
    if (this.isPublic) {
      serialized += "public ";
    } else {
      serialized += "internal ";
    }
    if (this.isPartial) {
      serialized += "partial ";
    }
    serialized += `class ${this.name}<${Object.keys(this.genericOptions).join(
      ", "
    )}> ${this.inheritsFrom ? `: ${this.inheritsFrom} ` : ""}{\n`;
    return serialized;
  }
  serialize(indentation?: number): string {
    const indentString = " ".repeat((indentation ?? 0) * TAB_WIDTH);
    let serialized = indentString + this.serializeDeclaration();
    serialized += this.serializeBody(indentation ?? 0 + 1);
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
