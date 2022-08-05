import { NameType } from "src/converter/name-mapper";
import { NameMapper } from "src/converter/name-mapper/mapper";
import { formatCommentString, getIndentString } from "../util";
import { CSharpElement } from "./base";
import { CSharpProperty } from "../types";

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
    mapper: NameMapper,
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
    serialized += `${mapper.transform(kind, NameType.DeclarationName)}`;
    if (optional) {
      serialized += "?";
    }
    serialized += ` ${mapper.transform(name, NameType.PropertyName)}`;
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
  protected serializeDeclaration(
    mapper: NameMapper,
    indentation: number,
    addNewline: boolean
  ) {
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
    const name = mapper.transform(this.name, NameType.DeclarationName);
    serialized += `class ${name} ${
      this.inheritsFrom
        ? `: ${mapper.transform(this.inheritsFrom, NameType.DeclarationName)} `
        : ""
    }{${addNewline ? "\n" : ""}`;
    return serialized;
  }
  protected serializeBody(mapper: NameMapper, indentation?: number) {
    const propertyIndent = indentation ?? 0;
    return this.properties
      .map((property) =>
        this.serializeProperty(mapper, property, propertyIndent)
      )
      .join("\n");
  }
  serialize(mapper: NameMapper, indentation: number = 0): string {
    const indentString = getIndentString(indentation);
    let serialized = formatCommentString(this.commentString, indentation);
    const hasProperties = this.properties.length > 0;
    serialized += this.serializeDeclaration(mapper, indentation, hasProperties);
    serialized += this.serializeBody(mapper, indentation + 1);
    serialized += (hasProperties ? "\n" + indentString : "    ") + "}";
    return serialized;
  }
}
