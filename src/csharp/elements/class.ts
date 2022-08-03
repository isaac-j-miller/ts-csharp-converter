import { formatCommentString, getIndentString } from "../util";
import { CSharpElement } from "./base";
import { CSharpProperty } from "./types";

export class CSharpClass extends CSharpElement {
  constructor(
    name: string,
    private _isPartial: boolean,
    public readonly properties: CSharpProperty[],
    private _isStatic: boolean,
    protected inheritsFrom?: string,
    isInternal?: boolean,
    commentString?: string
  ) {
    super("class", name, commentString, isInternal);
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
      commentString,
    } = property;
    let serialized = formatCommentString(commentString, indent);
    serialized += `${getIndentString(indent)}${accessLevel} `;
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
  protected serializeDeclaration(indentation: number) {
    const indentString = getIndentString(indentation);
    let serialized = indentString;
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
  serialize(indentation: number = 0): string {
    const indentString = getIndentString(indentation);
    let serialized = formatCommentString(this.commentString, indentation);
    serialized += this.serializeDeclaration(indentation);
    serialized += this.serializeBody(indentation + 1);
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
