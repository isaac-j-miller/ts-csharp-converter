import { NameType } from "src/converter/name-mapper";
import { NameMapper } from "src/converter/name-mapper/mapper";
import { getGenericTypeName } from "src/converter/util";
import { isCSharpPrimitive } from "src/converter/name-mapper/util";
import { getIndentString } from "../util";
import { CSharpClass } from "./class";
import { ConstructorParam, CSharpProperty, GenericParam } from "../types";

export class CSharpGenericClass extends CSharpClass {
  constructor(
    name: string,
    isPartial: boolean,
    properties: CSharpProperty[],
    public readonly genericOptions: Record<string, GenericParam>,
    inheritsFrom?: string,
    baseClassArgs?: string[],
    constructorArgs?: ConstructorParam[],
    isInternal?: boolean,
    commentString?: string
  ) {
    super(
      name,
      isPartial,
      properties,
      false,
      inheritsFrom,
      baseClassArgs,
      constructorArgs,
      isInternal,
      commentString
    );
  }
  private getConstraints(mapper: NameMapper): string {
    let constraintsString = "";
    Object.entries(this.genericOptions).forEach(([key, value]) => {
      const { constraint } = value;
      if (constraint && !isCSharpPrimitive(constraint)) {
        constraintsString += `where ${mapper.transform(
          key,
          NameType.DeclarationName
        )}: ${mapper.transform(constraint, NameType.DeclarationName)} `;
      }
    });
    return constraintsString;
  }
  protected override serializeDeclaration(
    mapper: NameMapper,
    indentation: number,
    addNewline: boolean
  ): string {
    const indentString = getIndentString(indentation);
    let serialized = indentString + "public ";
    // if (this.isPublic) {
    //   serialized += "public ";
    // } else {
    //   serialized += "internal ";
    // }
    if (this.isPartial) {
      serialized += "partial ";
    }
    const genericArgs = Object.keys(this.genericOptions);
    const constraints = this.getConstraints(mapper);
    serialized += `class ${getGenericTypeName(
      mapper.transform(this.name, NameType.DeclarationName),
      genericArgs.map(g => mapper.transform(g, NameType.DeclarationName))
    )} ${
      this.inheritsFrom ? `: ${mapper.transform(this.inheritsFrom, NameType.DeclarationName)} ` : ""
    }${constraints}{${addNewline ? "\n" : ""}`;
    return serialized;
  }
}
