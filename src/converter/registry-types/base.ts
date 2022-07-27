import { createHash } from "crypto";
import { Symbol } from "ts-morph";
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
    protected readonly internal: boolean
  ) {
    this.tokenType = structure.tokenType;
  }
  getStructure(): TypeStructure<T> {
    return this.structure;
  }
  private hash(obj: object | undefined) {
    if (obj === undefined) {
      return "";
    }
    return createHash("md5")
      .update(JSON.stringify(obj))
      .digest()
      .toString("hex");
  }
  getHash() {
    const {
      tokenType,
      unionMembers,
      properties,
      mappedIndexType,
      mappedValueType,
    } = this.structure;
    const unionHash = this.hash(unionMembers);
    const propertiesHash = this.hash(properties);
    const hash = `${tokenType}#${unionHash}#${propertiesHash}#${mappedIndexType}#${mappedValueType}`;
    return hash;
  }
  getSymbol(): Symbol | PrimitiveType | ISyntheticSymbol {
    return this.symbol;
  }
  abstract getCSharpElement(): CSharpElement;
}
