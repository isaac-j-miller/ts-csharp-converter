import { UnionMember } from "src/converter/types";
import { formatCommentString, getIndentString } from "../util";
import { CSharpElement } from "./base";

export class CSharpEnum extends CSharpElement {
  constructor(
    name: string,
    public readonly items: UnionMember[],
    isInternal?: boolean,
    commentString?: string
  ) {
    super("enum", name, commentString, isInternal);
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
  serialize(indentation: number = 0): string {
    const indentString = getIndentString(indentation);
    const bodyIndent = getIndentString(indentation + 1);
    const formattedCommentString = formatCommentString(
      this.commentString,
      indentation
    );
    let serialized = formattedCommentString + indentString;
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
