import { NameType } from "src/converter/name-mapper";
import { NameMapper } from "src/converter/name-mapper/mapper";
import { formatCommentString, getIndentString } from "../util";
import { CSharpElement } from "./base";
import { ConstructorParam, CSharpProperty } from "../types";

const wrapInNullableContext = (str: string, indent: number): string => {
  const indentString = getIndentString(indent);
  return `${indentString}#nullable enable\n${str}\n${indentString}#nullable disable`;
};
export class CSharpClass extends CSharpElement {
  constructor(
    name: string,
    private _isPartial: boolean,
    public readonly properties: CSharpProperty[],
    private _isStatic: boolean,
    protected inheritsFrom?: string,
    private baseClassArgs?: string[],
    private constructorArgs?: ConstructorParam[],
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
    if (!isConst) {
      const serializationPropertyName = `${getIndentString(indent)}[JsonPropertyName("${name}")]\n`;
      serialized += serializationPropertyName;
    }
    serialized += `${getIndentString(indent)}${accessLevel} `;
    if (defaultValue) {
      serialized += "readonly ";
    }
    if (isConst) {
      serialized += "static ";
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
    if (optional) {
      return wrapInNullableContext(serialized, indent);
    }
    return serialized;
  }
  protected serializeDeclaration(mapper: NameMapper, indentation: number, addNewline: boolean) {
    const indentString = getIndentString(indentation);
    let serialized = indentString + "public ";
    // if (this.isPublic) {
    //   serialized += "public ";
    // } else {
    //   serialized += "internal ";
    // }
    if (this.isStatic) {
      serialized += "static ";
    }
    if (this.isPartial) {
      serialized += "partial ";
    }
    const name = mapper.transform(this.name, NameType.DeclarationName);
    serialized += `class ${name} ${
      this.inheritsFrom ? `: ${mapper.transform(this.inheritsFrom, NameType.DeclarationName)} ` : ""
    }{${addNewline ? "\n" : ""}`;
    return serialized;
  }
  protected serializeBody(mapper: NameMapper, indentation?: number) {
    const propertyIndent = indentation ?? 0;
    let serialized = "";
    const properties = this.properties
      .map(property => this.serializeProperty(mapper, property, propertyIndent))
      .join("\n");
    // chain nullable annotations contexts
    const propertyLines = properties.split("\n");
    const propertyLinesToKeep: string[] = [];
    propertyLines.forEach((line, i) => {
      const previousLine = propertyLines[i - 1];
      const trimmed = line.trim();
      const nextLineTrimmed = propertyLines[i + 1]?.trim();
      const previousLineTrimmed = previousLine?.trim();
      if (
        (trimmed === "#nullable disable" && nextLineTrimmed === "#nullable enable") ||
        (previousLineTrimmed === "#nullable disable" && trimmed === "#nullable enable")
      ) {
        return;
      }
      propertyLinesToKeep.push(line);
    });
    serialized += propertyLinesToKeep.join("\n");
    return serialized;
  }
  protected serializeConstructor(mapper: NameMapper, indentation: number) {
    if (!this.baseClassArgs?.length || !this.constructorArgs?.length) return "";
    const indentString = getIndentString(indentation);
    const serialized = `\n${indentString}public ${mapper.transform(
      this.name,
      NameType.DeclarationName
    )}(${this.constructorArgs
      .map(
        a =>
          `${mapper.transform(a.type, NameType.DeclarationName)} ${mapper.transform(
            a.name,
            NameType.PropertyName
          )}`
      )
      .join(", ")}) : base(${this.baseClassArgs
      .map(a => mapper.transform(a, NameType.PropertyName))
      .join(", ")}) { }\n`;
    return serialized;
  }
  serialize(mapper: NameMapper, indentation: number = 0): string {
    const indentString = getIndentString(indentation);
    let serialized = formatCommentString(this.commentString, indentation);
    const hasProperties = this.properties.length > 0;
    serialized += this.serializeDeclaration(mapper, indentation, hasProperties);
    serialized += this.serializeConstructor(mapper, indentation + 1);
    serialized += this.serializeBody(mapper, indentation + 1);
    serialized += (hasProperties ? "\n" + indentString : " ") + "}";
    return serialized;
  }
}
