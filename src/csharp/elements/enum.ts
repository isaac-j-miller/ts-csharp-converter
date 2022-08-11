import { NameType } from "src/converter/name-mapper";
import { NameMapper } from "src/converter/name-mapper/mapper";
import { UnionMember } from "src/converter/types";
import { formatCommentString, getIndentString } from "../util";
import { CSharpElement } from "./base";

export class CSharpEnum extends CSharpElement {
  constructor(
    name: string,
    public readonly items: UnionMember[],
    private readonly isStringEnum: boolean,
    isInternal?: boolean,
    commentString?: string
  ) {
    super("enum", name, commentString, isInternal);
  }
  private serializeUnionMembers(mapper: NameMapper, indent: number): string[] {
    return this.items.map(({ name, value }) => {
      const shouldShowValue = value !== undefined;
      let str = mapper.transform(name, NameType.EnumMember);

      if (shouldShowValue) {
        str += ` = ${value}`;
      } else if (this.isStringEnum) {
        str = `[EnumMember(Value = "${name}")]\n${getIndentString(
          indent
        )}${str}`;
      }
      return str;
    });
  }
  serialize(mapper: NameMapper, indentation: number = 0): string {
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
    const name = mapper.transform(this.name, NameType.DeclarationName);
    serialized += `enum ${name} {\n`;
    serialized += this.serializeUnionMembers(mapper, indentation + 1)
      .map(
        (item, i) =>
          `${bodyIndent}${item}${i === this.items.length - 1 ? "" : ","}`
      )
      .join("\n");
    serialized += "\n" + indentString + "}";
    return serialized;
  }
}
