import { Symbol, Type } from "ts-morph";
import { v4 } from "uuid";
import { ISyntheticSymbol } from "../types";

export class SyntheticSymbol implements ISyntheticSymbol {
  public readonly id: string;
  constructor(
    private name: string,
    private type: Type,
    private readonly underlyingSymbol?: Symbol
  ) {
    this.id = v4();
  }
  isAlias(): false {
    return false;
  }
  isSynthetic = true as const;
  getName() {
    return this.name;
  }
  getUnderlyingSymbol() {
    return this.underlyingSymbol;
  }
  getDeclaredType() {
    return this.type;
  }
  getSourceFilePath(): string | undefined {
    if (!this.underlyingSymbol) {
      return;
    }
    const declarations = this.underlyingSymbol.getDeclarations();
    const declaration = declarations[0];
    if (!declaration) {
      return;
    }
    return declaration.getSourceFile().getFilePath();
  }
}
