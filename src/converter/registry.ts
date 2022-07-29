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
  private textCache: Record<string, string | undefined>;
  constructor() {
    this.symbolMap = {};
    this.redirects = {};
    this.textCache = {};
  }
  private symbolToIndex<T extends Symbol | ISyntheticSymbol>(
    sym: T
  ): string | undefined {
    const finalSym = getFinalSymbol(sym);
    const name = sym.getName();
    if (isSyntheticSymbol(finalSym)) {
      return name + finalSym.id;
    } else {
      let id = (finalSym.compilerSymbol as any)?.id;
      if (!id) {
        return;
      }
      return name + id;
    }
  }
  private getWithKey(key: string): IRegistryType | undefined {
    const redirect = this.redirects[key];
    if (redirect) {
      return this.symbolMap[redirect];
    }
    return this.symbolMap[key];
  }
  addType(type: IRegistryType) {
    const sym = type.getSymbol();
    const idx = isPrimitiveType(sym)
      ? sym.primitiveType
      : this.symbolToIndex(sym);

    if (!idx) {
      throw new Error(
        `Unable to construct unique identifier for type ${
          type.getStructure().name
        }`
      );
    }
    if (this.symbolMap[idx]) {
      return;
    }
    this.symbolMap[idx] = type;
    const underlyingSym = isSyntheticSymbol(sym)
      ? sym.getUnderlyingSymbol()
      : undefined;
    if (underlyingSym) {
      const symIdx = this.symbolToIndex(underlyingSym);
      if (symIdx) {
        this.redirects[symIdx] = idx;
      }
    }
  }
  has(sym: RegistryKey): boolean {
    return !!this.getType(sym);
  }
  findTypeBySymbolText(text: string): IRegistryType | undefined {
    if (text === "__type") {
      console.warn("Not returning __type");
      return;
    }
    const keyFromCache = this.textCache[text];
    if (keyFromCache) {
      return this.getWithKey(keyFromCache);
    }
    console.debug(`Attempting to find type by symbol text: ${text}`);
    for (const [key, value] of Object.entries(this.symbolMap)) {
      if (!value) {
        continue;
      }
      const sym = value.getSymbol();
      if (isPrimitiveType(sym)) {
        if (text === sym.primitiveType) {
          this.textCache[text] = key;
          return value;
        }
        continue;
      }
      const final = getFinalSymbol(sym);
      const symText = final.getDeclaredType().getText();
      if (symText === text) {
        this.textCache[text] = key;
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
        const primitiveType = new TypeRegistryPrimitiveType(this, primIdx);
        this.addType(primitiveType);
      }
      return this.symbolMap[primIdx];
    }
    const idx = this.symbolToIndex(sym);
    if (!idx) {
      return;
    }
    const fromMap = this.getWithKey(idx);
    if (fromMap) {
      return fromMap;
    }
    const underlyingSym = isSyntheticSymbol(sym)
      ? sym.getUnderlyingSymbol()
      : undefined;
    if (underlyingSym) {
      return this.getType(underlyingSym);
    }
    return;
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
      this.redirects = { ...this.redirects, ...replacementMap };
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
