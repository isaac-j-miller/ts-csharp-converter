import { Symbol } from "ts-morph";
import { CSharpElement, CSharpNamespace } from "src/csharp/elements";
import { TypeRegistryPrimitiveType } from "./registry-types/primitive";
import {
  IRegistryType,
  isPrimitiveType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  PrimitiveTypeName,
  RegistryKey,
} from "./types";

export class TypeRegistry {
  private symbolMap: Record<string, IRegistryType | undefined>;
  constructor() {
    this.symbolMap = {};
  }
  private symbolToIndex<T extends Symbol | ISyntheticSymbol>(sym: T): string {
    const finalSym = this.getFinalSymbol(sym);
    const name = sym.getName();
    if (isSyntheticSymbol(finalSym)) {
      return name + finalSym.id;
    } else {
      return name + (finalSym.compilerSymbol as any)?.id;
    }
  }
  private getFinalSymbol<T extends Symbol | ISyntheticSymbol>(sym: T): T {
    if (!isSyntheticSymbol(sym) && sym.isAlias()) {
      return this.getFinalSymbol(sym.getAliasedSymbolOrThrow()) as T;
    }
    return sym;
  }
  addType(type: IRegistryType) {
    const sym = type.getSymbol();
    const idx = isPrimitiveType(sym)
      ? sym.primitiveType
      : this.symbolToIndex(sym);
    if (this.symbolMap[idx]) {
      return;
    }
    this.symbolMap[idx] = type;
  }
  has(sym: RegistryKey): boolean {
    return !!this.getType(sym);
  }
  findTypeBySymbolText(text: string): IRegistryType | undefined {
    for (const value of Object.values(this.symbolMap)) {
      if (!value) {
        continue;
      }
      const sym = value.getSymbol();
      if (isPrimitiveType(sym)) {
        if (text === sym.primitiveType) {
          return value;
        }
        continue;
      }
      const final = this.getFinalSymbol(sym);
      const symText = final.getDeclaredType().getText();
      if (symText === text) {
        return value;
      }
    }
    return;
  }
  getType(sym: RegistryKey | PrimitiveTypeName): IRegistryType | undefined {
    if (typeof sym === "string") {
      const prim = this.symbolMap[sym];
      if (!prim) {
        const primitiveType = new TypeRegistryPrimitiveType(sym);
        this.addType(primitiveType);
      }
      return this.symbolMap[sym];
    }
    const idx = this.symbolToIndex(sym);
    return this.symbolMap[idx];
  }
  private consolidate() {
    // Go through each type and hash them, replacing duplicates
  }
  private getElements(): CSharpElement[] {
    const elements: CSharpElement[] = [];
    Object.values(this.symbolMap).forEach((elem) => {
      if (elem && elem.shouldBeRendered) {
        elements.push(elem.getCSharpElement());
      }
    });
    return elements;
  }
  toNamespace(name: string): CSharpNamespace {
    this.consolidate();
    return new CSharpNamespace(name, this.getElements(), true);
  }
}
