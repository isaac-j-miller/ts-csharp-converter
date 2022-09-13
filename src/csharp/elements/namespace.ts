import { NameMapper } from "src/converter/name-mapper/mapper";
import { CSharpElement } from "./base";
import { TAB_WIDTH } from "../types";
import { ICSharpElement } from "./types";

export class CSharpNamespace extends CSharpElement {
  constructor(name: string, public readonly elements: ICSharpElement[], commentString?: string) {
    super("namespace", name, commentString, false);
  }
  serialize(mapper: NameMapper): string {
    const indent = " ".repeat(TAB_WIDTH);
    let serialized = `namespace ${this.name} {\n`;
    serialized += indent + "using System;\n";
    serialized += indent + "using System.Collections.Generic;\n";
    serialized += indent + "using System.Runtime.Serialization;\n";
    serialized += indent + "using Newtonsoft.Json;\n";
    serialized += indent + "using Serialization;\n";
    serialized += this.elements.map(element => element.serialize(mapper, 1)).join("\n");
    serialized += "\n}";
    return serialized;
  }
}
