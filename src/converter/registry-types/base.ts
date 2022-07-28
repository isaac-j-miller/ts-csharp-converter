import { createHash } from "crypto";
import { Node, Symbol, Type } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";
import {
  IRegistryType,
  ISyntheticSymbol,
  PrimitiveType,
  TokenType,
  TypeStructure,
} from "../types";

export abstract class RegistryType<T extends TokenType>
  implements IRegistryType<T>
{
  public readonly tokenType: T;
  constructor(
    protected structure: TypeStructure<T>,
    private readonly symbol: Symbol | PrimitiveType | ISyntheticSymbol,
    public readonly shouldBeRendered: boolean,
    protected readonly internal: boolean,
    protected readonly type: Type | undefined
  ) {
    this.tokenType = structure.tokenType;
  }
  getType() {
    return this.type;
  }
  getStructure(): TypeStructure<T> {
    return this.structure;
  }
  private hash(obj: object | undefined) {
    let cache: any[] | null = [];
    const circularReplacer = (key: any, value: any) => {
      if (typeof value === "object" && value !== null) {
        // Duplicate reference found, discard key
        if (cache?.includes(value)) return;

        // Store value in our collection
        cache?.push(value);
      }
      return value;
    };
    if (obj === undefined) {
      return "";
    }
    const stringified = JSON.stringify(obj, circularReplacer);
    cache = null;
    return createHash("md5").update(stringified).digest().toString("hex");
  }
  getHash() {
    const {
      tokenType,
      unionMembers,
      properties,
      mappedIndexType,
      mappedValueType,
      name,
    } = this.structure;
    const unionHash = this.hash(unionMembers);
    const propertiesHash = this.hash(properties);
    const hash = `${tokenType}#${name}#${unionHash}#${propertiesHash}#${mappedIndexType}#${mappedValueType}`;
    return hash;
  }
  getSymbol(): Symbol | PrimitiveType | ISyntheticSymbol {
    return this.symbol;
  }
  abstract getPropertyString(genericParameterValues?: string[]): string;
  abstract getCSharpElement(): CSharpElement;
}
