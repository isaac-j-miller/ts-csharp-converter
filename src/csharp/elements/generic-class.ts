import { getGenericTypeName } from "src/converter/util";
import { CSharpClass } from "./class";
import { CSharpProperty, GenericParam } from "./types";

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
  private getConstraints(): string {
    let constraintsString = "";
    Object.entries(this.genericOptions).forEach(([key, value]) => {
      const { constraint } = value;
      if (constraint) {
        constraintsString += `where ${key}: ${constraint} `;
      }
    });
    return constraintsString;
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
    const constraints = this.getConstraints();
    serialized += `class ${getGenericTypeName(
      this.name,
      genericArgs
    )} ${constraints}${this.inheritsFrom ? `: ${this.inheritsFrom} ` : ""}{\n`;
    return serialized;
  }
}
