import { Type } from "ts-morph";
import { v4 } from "uuid";
import { ISyntheticSymbol } from "../types";

export class SyntheticSymbol implements ISyntheticSymbol {
  public readonly id: string;
  constructor(private name: string, private type: Type) {
    this.id = v4();
  }
  isAlias(): false {
    return false;
  }
  isSynthetic = true as const;
  getName() {
    return this.name;
  }
  getDeclaredType() {
    return this.type;
  }
}
