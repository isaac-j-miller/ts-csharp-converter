import { CSharpElement } from "./base";
import { CSharpProperty, TAB_WIDTH } from "./types";

export class CSharpClass extends CSharpElement {
  constructor(
    name: string,
    private _isPartial: boolean,
    public readonly properties: CSharpProperty[],
    protected inheritsFrom?: string,
    isInternal?: boolean
  ) {
    super("class", name, isInternal);
  }
  public get isPartial() {
    return !!this._isPartial;
  }
  protected serializeProperty(property: CSharpProperty): string {
    const { name, accessLevel, getter, setter, optional, kind } = property;
    let serialized = `    ${accessLevel} ${kind}`;
    if (optional) {
      serialized += "?";
    }
    serialized += ` ${name}`;
    if (getter || setter) {
      serialized += " {";
      if (getter) {
        serialized += " get;";
      }
      if (setter) {
        serialized += " set;";
      }
      serialized += " }";
    }
    return serialized;
  }
  protected serializeDeclaration() {
    let serialized = "";
    if (this.isPublic) {
      serialized += "public ";
    } else {
      serialized += "internal ";
    }
    if (this.isPartial) {
      serialized += "partial ";
    }
    serialized += `class ${this.name} ${
      this.inheritsFrom ? `: ${this.inheritsFrom} ` : ""
    }{\n`;
    return serialized;
  }
  protected serializeBody(indentation?: number) {
    const indentString = " ".repeat((indentation ?? 0) * TAB_WIDTH);
    return this.properties
      .map((property) => indentString + this.serializeProperty(property))
      .join("\n");
  }
  serialize(indentation?: number): string {
    const indentString = " ".repeat((indentation ?? 0) * TAB_WIDTH);
    let serialized = indentString + this.serializeDeclaration();
    serialized += this.serializeBody(indentation ?? 0 + 1);
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
