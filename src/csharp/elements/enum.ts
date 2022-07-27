import { CSharpElement } from "./base";
import { TAB_WIDTH } from "./types";

export class CSharpEnum extends CSharpElement {
  constructor(
    name: string,
    public readonly items: string[],
    isInternal?: boolean
  ) {
    super("enum", name, isInternal);
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
    serialized += this.items
      .map(
        (item, i) =>
          `${bodyIndent}${item}${i === this.items.length - 1 ? "" : ","}`
      )
      .join("\n");
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
