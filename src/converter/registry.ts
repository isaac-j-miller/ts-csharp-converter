import { Symbol } from "ts-morph";
import { CSharpNamespace } from "src/csharp/elements";
import { ICSharpElement } from "src/csharp/elements/types";
import { LoggerFactory } from "src/common/logging/factory";
import { ILogger } from "src/common/logging/types";
import {
  ConstKeyword,
  ConstType,
  IRegistryType,
  isConstType,
  isPrimitiveType,
  isPrimitiveTypeName,
  isSyntheticSymbol,
  ISyntheticSymbol,
  NonPrimitiveType,
  PrimitiveType,
  PrimitiveTypeName,
  RegistryKey,
} from "./types";
import { asPrimitiveTypeName, getFinalSymbol, getRefactorName } from "./util";
import { TypeRegistryPrimitiveType } from "./registry-types/primitive";
import { TypeRegistryConstType } from "./registry-types/consts";
import { CONSTS_KEYWORD } from "./consts";

type GetTypeReturn<
  T extends RegistryKey | PrimitiveTypeName | PrimitiveType | ConstKeyword | ConstType
> = T extends PrimitiveType | PrimitiveTypeName
  ? TypeRegistryPrimitiveType
  : T extends ConstType | ConstKeyword
  ? TypeRegistryConstType
  : IRegistryType<NonPrimitiveType> | undefined;
export class TypeRegistry {
  private symbolMap: Record<string, IRegistryType | undefined>;
  private redirects: Record<string, string | undefined>;
  private textCache: Record<string, string | undefined>;
  private declarations: Set<string>;
  private hashes: Record<string, string | undefined>;
  private logger: ILogger;
  constructor(private ignoreClasses: Set<string>) {
    this.symbolMap = {};
    this.redirects = {};
    this.textCache = {};
    this.declarations = new Set<string>();
    this.hashes = {};
    this.logger = LoggerFactory.getLogger("registry");
  }
  private symbolToIndex<T extends Symbol | ISyntheticSymbol>(sym: T): string | undefined {
    const finalSym = getFinalSymbol(sym);
    const name = sym.getName();
    if (isSyntheticSymbol(finalSym)) {
      return name + finalSym.id;
    }
    const id = (finalSym.compilerSymbol as any)?.id;
    if (!id) {
      return;
    }
    return name + id;
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
  addType(type: IRegistryType): void {
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
      throw new Error(`Unable to construct unique identifier for type ${type.getStructure().name}`);
    }
    const { name } = type.getStructure();
    const namespaceAlreadyHasTypeWithName = this.declarations.has(name);
    if (namespaceAlreadyHasTypeWithName) {
      const refactoredName = getRefactorName(name);
      if(type.isNonPrimitive() && isSyntheticSymbol(sym)) {
        const fpath = (sym as ISyntheticSymbol).getSourceFilePath();
        if (!this.declarations.has(refactoredName)) {
          this.logger.warn(
            `Conflict encountered: Namespace already has declaration for ${type.getOriginalName()}${
              fpath ? ` (${fpath})` : ""
            }, refactoring output to rename new type as ${refactoredName}`
          );
        }
        type.rename(refactoredName);
        return this.addType(type);
      }
    }
    this.logger.debug(`Adding ${type.tokenType} type ${name} to registry`);
    this.declarations.add(name);
    this.symbolMap[idx] = type;
    const underlyingSym = isSyntheticSymbol(sym) ? sym.getUnderlyingSymbol() : undefined;
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
      this.logger.warn("Not returning __type");
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
  replace(old: ISyntheticSymbol, newType: IRegistryType) {
    const newSym = newType.getSymbol();
    if (isPrimitiveType(newSym) || isConstType(newSym)) {
      throw new Error("Cannot replace old type with primitive or const");
    }
    const oldSymIdx = this.symbolToIndex(old);
    const newSymIdx = this.symbolToIndex(newSym);
    if (!oldSymIdx || !newSymIdx) {
      throw new Error("Cannot construct index");
    }
    const oldValue = this.getType(old);
    if (!oldValue) {
      throw new Error("Old symbol not found, cannot replace");
    }
    const name = oldValue.getStructure().name;
    this.declarations.delete(name);
    const hash = oldValue.getHash();
    if (this.hashes[hash]) {
      delete this.hashes[hash];
    }
    this.addType(newType);
    const resolvedOldSymbol = oldValue.getSymbol();
    if (!isPrimitiveType(resolvedOldSymbol) && !isConstType(resolvedOldSymbol)) {
      const resolvedOldSymIdx = this.symbolToIndex(resolvedOldSymbol);
      if (resolvedOldSymIdx) {
        this.redirects[resolvedOldSymIdx] = newSymIdx;
        delete this.symbolMap[resolvedOldSymIdx];
      }
    }
    this.redirects[oldSymIdx] = newSymIdx;
  }
  findTypeByName<T extends string>(
    name: T
  ): T extends PrimitiveTypeName ? TypeRegistryPrimitiveType : IRegistryType | undefined {
    if (isPrimitiveTypeName(name)) {
      return this.getType(name);
    }
    for (const [key, value] of Object.entries(this.symbolMap)) {
      const { name: typeName } = value!.getStructure();
      if (name === typeName) {
        return this.getWithKey(key) as T extends PrimitiveTypeName
          ? TypeRegistryPrimitiveType
          : IRegistryType | undefined;
      }
    }
    return undefined as T extends PrimitiveTypeName
      ? TypeRegistryPrimitiveType
      : IRegistryType | undefined;
  }
  getType<T extends RegistryKey | PrimitiveTypeName | PrimitiveType | ConstType | ConstKeyword>(
    sym: T
  ): GetTypeReturn<T> {
    const symIsPrimitiveName = isPrimitiveTypeName(sym);
    const symIsPrimitiveType = isPrimitiveType(sym);
    if (symIsPrimitiveName || symIsPrimitiveType) {
      const primIdx: PrimitiveTypeName = symIsPrimitiveName ? sym : sym.primitiveType;
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
    if (!isSyntheticSymbol(sym)) {
      const primitiveTypeName = asPrimitiveTypeName(sym.getDeclarations()[0]?.getType());
      if (primitiveTypeName) {
        return this.getType(primitiveTypeName) as GetTypeReturn<T>;
      }
    }
    const underlyingSym = isSyntheticSymbol(sym) ? sym.getUnderlyingSymbol() : undefined;
    if (underlyingSym) {
      const fromSym = this.getType(underlyingSym) as GetTypeReturn<T>;
      if (fromSym) {
        return fromSym;
      }
    }
    const redirectedIdx = this.redirects[idx];
    if (redirectedIdx) {
      const fromKey = this.getWithKey(redirectedIdx) as GetTypeReturn<T>;
      if (fromKey) {
        return fromKey;
      }
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
      regType.registerRefs()
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
      const sortedIndices = indices.filter(v => {
        const entry = this.getWithKey(v);
        return !!entry?.shouldBeRendered;
      })
      .sort((a, b) => {
        const aEntry = this.getWithKey(a);
        const bEntry = this.getWithKey(b);
        const aValue = calculateValue(aEntry);
        const bValue = calculateValue(bEntry);
        return bValue - aValue;
      });
      const [firstIdx, ...rest] = sortedIndices
        
      const names: Array<string|undefined> = []
      rest.forEach(idx => {
        const str = this.symbolMap[idx]
        names.push(str?.getStructure().name)
        replacementMap[idx] = firstIdx;
        delete this.symbolMap[idx];
      });
      const kept = this.symbolMap[firstIdx]?.getStructure().name
      this.logger.debug(`Stripped ${rest.length} (${names} -> ${kept}), duplicate types with hash ${hash}`);
      this.redirects = { ...this.redirects, ...replacementMap };
      
    });
  }
  private getElements(): ICSharpElement[] {
    const symbolMapValues = Object.values(this.symbolMap)
    const elemsToKeep: IRegistryType[] = []
    const allNames = new Set<string>()
    symbolMapValues.forEach((elem, i) => {
      if(!elem || !elem.shouldBeRendered) return;
      const { name } = elem.getStructure()
      if(this.ignoreClasses.has(name)) {
        this.logger.trace(`Filtering out ${name} because it is marked to be ignored`)
        return 
      }
      if (elem.shouldBeRendered) {
        elemsToKeep.push(elem)
        allNames.add(name)
      }
    });
    elemsToKeep.forEach(value => {
      if(!value) {
        return
      }
      const {name} =value.getStructure()
      const match = name.match(/\d+$/);
      if(!match) return
        const numStr = match[0];
        const idx = name.lastIndexOf(numStr);
        if(idx === -1) return;
        const newName = name.slice(0, idx)
        if(!newName) return
        if(allNames.has(newName)) return;
        this.logger.debug(`Renaming ${name}->${newName}`)
        value.rename(newName)
    })
    const cSharpElems = elemsToKeep.map(e=>e.getCSharpElement())
    return cSharpElems;
  }
  toNamespace(name: string): CSharpNamespace {
    this.logger.info("Preparing to create namespace...");
    this.consolidate();
    this.logger.info("Creating namespace...");
    const ns = new CSharpNamespace(name, this.getElements());
    this.logger.info(`Created namespace ${name}`);
    return ns;
  }
}

function calculateValue(t: IRegistryType | undefined): number {
  if (!t) {
    return -1000;
  }
  let v = 0;
  if (t.isPublic()) {
    v += 100;
  }
  v -= t.getLevel();
  const match = t.getStructure().name.match(/\d+$/);
  if (match) {
    const numStr = match[0];
    const numParsed = Number.parseInt(numStr, 10);
    v-=numParsed;
  }
  return v;
}
