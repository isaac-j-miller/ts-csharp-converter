import { UnionMember } from "src/converter/types";
import { CSharpElement } from "./base";
import { TAB_WIDTH } from "./types";

export class CSharpEnum extends CSharpElement {
  constructor(
    name: string,
    public readonly items: UnionMember[],
    isInternal?: boolean
  ) {
    super("enum", name, isInternal);
  }
  private serializeUnionMembers(): string[] {
    return this.items.map(({ name, value }) => {
      const shouldShowValue = value !== undefined;
      let str = name;
      if (shouldShowValue) {
        str += ` = ${value}`;
      }
      return str;
    });
  }
  serialize(indentation?: number): string {
    const indentString = " ".repeat((indentation ?? 0) * TAB_WIDTH);
    const bodyIndent = " ".repeat(((indentation ?? 0) + 1) * TAB_WIDTH);
    let serialized = indentString;
    if (this.isPublic) {
      serialized += "public ";
    } else {
      serialized += "internal ";
    }
    serialized += `enum ${this.name} {\n`;
    serialized += this.serializeUnionMembers()
      .map(
        (item, i) =>
          `${bodyIndent}${item}${i === this.items.length - 1 ? "" : ","}`
      )
      .join("\n");
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
