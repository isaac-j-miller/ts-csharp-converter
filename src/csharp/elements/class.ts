import { CSharpElement } from "./base";
import { CSharpProperty, TAB_WIDTH } from "./types";

export class CSharpClass extends CSharpElement {
  constructor(
    name: string,
    private _isPartial: boolean,
    public readonly properties: CSharpProperty[],
    private _isStatic: boolean,
    protected inheritsFrom?: string,
    isInternal?: boolean
  ) {
    super("class", name, isInternal);
  }
  public get isPartial() {
    return !!this._isPartial;
  }
  public get isStatic() {
    return !!this._isStatic;
  }
  protected serializeProperty(
    property: CSharpProperty,
    indent: number
  ): string {
    const {
      name,
      accessLevel,
      getter,
      setter,
      optional,
      kind,
      isConst,
      defaultValue,
    } = property;
    let serialized = `${" ".repeat(indent * TAB_WIDTH)}${accessLevel} `;
    if (isConst) {
      serialized += "const ";
    }
    serialized += `${kind}`;
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
    if (defaultValue) {
      serialized += ` = ${defaultValue};`;
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
    if (this.isStatic) {
      serialized += "static ";
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
    const propertyIndent = indentation ?? 0;
    return this.properties
      .map((property) => this.serializeProperty(property, propertyIndent))
      .join("\n");
  }
  serialize(indentation?: number): string {
    const indentString = " ".repeat((indentation ?? 0) * TAB_WIDTH);
    let serialized = indentString + this.serializeDeclaration();
    serialized += this.serializeBody((indentation ?? 0) + 1);
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
