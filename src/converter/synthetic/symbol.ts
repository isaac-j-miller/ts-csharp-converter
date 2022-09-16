import { Symbol, Type } from "ts-morph";
import { v4 } from "uuid";
import { ISyntheticSymbol } from "../types";

export class SyntheticSymbol implements ISyntheticSymbol {
  public readonly id: string;
  public readonly isClassUnionBase: boolean;
  constructor(
    private name: string,
    private type: Type | undefined,
    private readonly underlyingSymbol?: Symbol
  ) {
    this.id = v4();
    this.isClassUnionBase = false;
  }
  isAlias(): false {
    return false;
  }
  isSynthetic = true as const;
  getName(): string {
    return this.name;
  }
  getUnderlyingSymbol(): Symbol | undefined {
    return this.underlyingSymbol;
  }
  getDeclaredType(): Type | undefined {
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
