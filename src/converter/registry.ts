import { Symbol } from "ts-morph";
import { CSharpElement, CSharpNamespace } from "src/csharp/elements";
import { TypeRegistryPrimitiveType } from "./registry-types/primitive";
import {
  IRegistryType,
  isPrimitiveType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  PrimitiveType,
  PrimitiveTypeName,
  RegistryKey,
} from "./types";
import { getFinalSymbol } from "./util";

export class TypeRegistry {
  private symbolMap: Record<string, IRegistryType | undefined>;
  private redirects: Record<string, string | undefined>;
  constructor() {
    this.symbolMap = {};
    this.redirects = {};
  }
  private symbolToIndex<T extends Symbol | ISyntheticSymbol>(sym: T): string {
    const finalSym = getFinalSymbol(sym);
    const name = sym.getName();
    if (isSyntheticSymbol(finalSym)) {
      return name + finalSym.id;
    } else {
      let id = (finalSym.compilerSymbol as any)?.id;
      if (!id) {
        console.warn(`No id found for symbol ${name}`);
      }
      return name + id;
    }
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
    if (text === "__type" || text === "__typeundefined") {
      console.warn("Not returning __type");
      return;
    }
    console.debug(`Attempting to find type by symbol text: ${text}`);
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
      const final = getFinalSymbol(sym);
      const symText = final.getDeclaredType().getText();
      if (symText === text) {
        return value;
      }
    }
    return;
  }
  getType(
    sym: RegistryKey | PrimitiveTypeName | PrimitiveType
  ): IRegistryType | undefined {
    if (typeof sym === "string" || isPrimitiveType(sym)) {
      const primIdx = typeof sym === "string" ? sym : sym.primitiveType;
      const prim = this.symbolMap[primIdx];
      if (!prim) {
        const primitiveType = new TypeRegistryPrimitiveType(primIdx);
        this.addType(primitiveType);
      }
      return this.symbolMap[primIdx];
    }
    const idx = this.symbolToIndex(sym);
    const redirect = this.redirects[idx];
    if (redirect) {
      return this.symbolMap[redirect];
    }
    return this.symbolMap[idx];
  }
  private consolidate() {
    const hashMap: Record<string, string[]> = {};
    const replacementMap: Record<string, string> = {};
    // Go through each type and hash them, replacing duplicates
    Object.entries(this.symbolMap).forEach(([idx, regType]) => {
      if (!regType) {
        delete this.symbolMap[idx];
        return;
      }
      if (!regType.shouldBeRendered) {
        return;
      }
      const hash = regType.getHash();
      if (!hashMap[hash]) {
        hashMap[hash] = [idx];
      } else {
        hashMap[hash].push(idx);
      }
    });
    Object.entries(hashMap).forEach(([hash, indices]) => {
      if (indices.length === 1) {
        return;
      }
      console.debug(
        `Found ${indices.length} renderable types with same hash: ${hash}`
      );
      const [firstIdx, ...rest] = indices;
      rest.forEach((idx) => {
        replacementMap[idx] = firstIdx;
        delete this.symbolMap[idx];
      });
      console.debug(
        `Stripped ${Object.keys(replacementMap).length} duplicate types`
      );
      this.redirects = replacementMap;
    });
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
