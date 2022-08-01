import { CSharpElement } from "./base";
import { TAB_WIDTH } from "./types";

export class CSharpNamespace extends CSharpElement {
  constructor(name: string, public readonly elements: CSharpElement[]) {
    super("namespace", name, false);
  }
  serialize(): string {
    const indent = " ".repeat(TAB_WIDTH);
    let serialized = "";
    if (this.isPublic) {
      serialized += "public ";
    } else {
      serialized += "internal ";
    }
    serialized += `namespace ${this.name} {\n`;
    serialized += indent + "using System;\n";
    serialized += indent + "using System.Collections.Generic;\n";
    serialized += this.elements
      .map((element) => element.serialize(1))
      .join("\n");
    serialized += "\n}";
    return serialized;
  }
}
