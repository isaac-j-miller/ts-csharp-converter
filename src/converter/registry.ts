import { Symbol } from "ts-morph";
import { CSharpElement, CSharpNamespace } from "src/csharp/elements";
import { TypeRegistryPrimitiveType } from "./registry-types/primitive";
import {
  ConstType,
  IRegistryType,
  isConstType,
  isPrimitiveType,
  isPrimitiveTypeName,
  isSyntheticSymbol,
  ISyntheticSymbol,
  PrimitiveType,
  PrimitiveTypeName,
  RegistryKey,
} from "./types";
import { getFinalSymbol } from "./util";
import { TypeRegistryConstType } from "./registry-types/consts";

export const CONSTS_KEYWORD = "__consts__" as const;
export type ConstKeyword = typeof CONSTS_KEYWORD;

type GetTypeReturn<
  T extends
    | RegistryKey
    | PrimitiveTypeName
    | PrimitiveType
    | ConstKeyword
    | ConstType
> = T extends PrimitiveType | PrimitiveTypeName
  ? TypeRegistryPrimitiveType
  : T extends ConstType | ConstKeyword
  ? TypeRegistryConstType
  : IRegistryType | undefined;
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
  getConstValueType(): TypeRegistryConstType {
    const v = this.symbolMap[CONSTS_KEYWORD];
    if (!v) {
      const constType = new TypeRegistryConstType(this);
      this.symbolMap[CONSTS_KEYWORD] = constType;
    }
    return this.symbolMap[CONSTS_KEYWORD] as TypeRegistryConstType;
  }

  addType(type: IRegistryType) {
    const sym = type.getSymbol();
    const typeIsPrimitive = isPrimitiveType(sym);
    const typeIsConst = isConstType(sym);
    let idx: string | undefined;
    if (typeIsConst) {
      idx = "consts";
    } else if (typeIsPrimitive) {
      idx = sym.primitiveType;
    } else {
      idx = this.symbolToIndex(sym);
    }
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
    console.debug(
      `Adding ${type.tokenType} type ${type.getStructure().name} to registry`
    );
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
      if (isConstType(sym)) {
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
  getType<
    T extends
      | RegistryKey
      | PrimitiveTypeName
      | PrimitiveType
      | ConstType
      | ConstKeyword
  >(sym: T): GetTypeReturn<T> {
    const symIsPrimitiveName = isPrimitiveTypeName(sym);
    const symIsPrimitiveType = isPrimitiveType(sym);
    if (symIsPrimitiveName || symIsPrimitiveType) {
      const primIdx: PrimitiveTypeName = symIsPrimitiveName
        ? sym
        : sym.primitiveType;
      const prim = this.symbolMap[primIdx];
      if (!prim) {
        const primitiveType = new TypeRegistryPrimitiveType(this, primIdx);
        this.addType(primitiveType);
      }
      return this.symbolMap[primIdx] as GetTypeReturn<T>;
    }
    const symIsConstKeyword = sym === "__consts__";
    const symIsConstType = isConstType(sym);
    if (symIsConstKeyword || symIsConstType) {
      return this.getConstValueType() as GetTypeReturn<T>;
    }
    // need this really dumb type guard because typescript can't tell that sym does not extend PrimitiveType | PrimitiveTypeName at this point
    const emptyReturnValue = undefined as GetTypeReturn<T>;
    const idx = this.symbolToIndex(sym);
    if (!idx) {
      return emptyReturnValue;
    }
    const fromMap = this.getWithKey(idx);
    if (fromMap) {
      return fromMap as GetTypeReturn<T>;
    }
    const underlyingSym = isSyntheticSymbol(sym)
      ? sym.getUnderlyingSymbol()
      : undefined;
    if (underlyingSym) {
      return this.getType(underlyingSym) as GetTypeReturn<T>;
    }
    return emptyReturnValue;
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
      const [firstIdx, ...rest] = indices;
      rest.forEach((idx) => {
        replacementMap[idx] = firstIdx;
        delete this.symbolMap[idx];
      });
      console.debug(
        `Stripped ${rest.length} duplicate types with hash ${hash}...`
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
    return new CSharpNamespace(name, this.getElements());
  }
}
