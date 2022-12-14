import { Symbol, Type } from "ts-morph";
import { CSharpNamespace } from "src/csharp/elements";
import type { ICSharpElement } from "src/csharp/elements/types";
import { LoggerFactory } from "src/common/logging/factory";
import type { ILogger } from "src/common/logging/types";
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
  UnionEnumMember,
  UnionTypeValueReference,
} from "./types";
import { asPrimitiveTypeName, ConfigDependentUtils, getFinalSymbol, getRefactorName } from "./util";
import { TypeRegistryPrimitiveType } from "./registry-types/primitive";
import { TypeRegistryConstType } from "./registry-types/consts";
import { CONSTS_KEYWORD } from "./consts";
import { NameMapper } from "./name-mapper";

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
  constructor(private utils: ConfigDependentUtils, private ignoreClasses: Set<string>) {
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
      const constType = new TypeRegistryConstType(this.utils, this);
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
    const isClassUnionBase = isSyntheticSymbol(sym) && sym.isClassUnionBase;
    const { name } = type.getStructure();
    const namespaceAlreadyHasTypeWithName = this.declarations.has(name);
    if (namespaceAlreadyHasTypeWithName) {
      const refactoredName = getRefactorName(name);
      if (type.isNonPrimitive() && isSyntheticSymbol(sym) && !sym.isClassUnionBase) {
        const fpath = (sym as ISyntheticSymbol).getSourceFilePath();
        if (!this.declarations.has(refactoredName)) {
          this.logger.debug(
            `Conflict encountered: Namespace already has declaration for ${type.getOriginalName()}${
              fpath ? ` (${fpath})` : ""
            }, refactoring output to rename new type as ${refactoredName}`
          );
        }
        type.rename(refactoredName);
        return this.addType(type);
      }
    }
    if (!typeIsPrimitive && !isClassUnionBase) {
      this.logger.debug(`Adding ${type.tokenType} type ${name} to registry`);
    }
    if (isClassUnionBase && this.symbolMap[idx]) {
      const existing = this.symbolMap[idx];
      const relativeValue = calculateValue(type) - calculateValue(existing);
      if (relativeValue < 0) {
        return;
      }
    }
    this.declarations.add(name);
    this.symbolMap[idx] = type;
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
      const symText = final.getDeclaredType()?.getText();
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
  findUnionTypesWithMember(member: string, hint?: Type): UnionTypeValueReference | undefined {
    if (hint) {
      const text = hint.getApparentType().getText();
      const fromText = this.findTypeBySymbolText(text);
      if (fromText) {
        const { members: unionMembers, tokenType } = fromText.getStructure();
        if (
          tokenType === "StringUnion" &&
          unionMembers &&
          unionMembers.some(u => (u as UnionEnumMember).name === member)
        ) {
          return {
            propertyName: member,
            ref: fromText.getSymbol() as Symbol | ISyntheticSymbol,
            isUnionTypeValueReference: true,
          };
        }
      }
    }
    const getUnion = (): IRegistryType | undefined => {
      const matchingUnions = Object.values(this.symbolMap).filter(type => {
        if (!type) return false;
        const { tokenType, members: unionMembers } = type.getStructure();
        if (tokenType !== "StringUnion") return false;
        return !!unionMembers && unionMembers.some(u => (u as UnionEnumMember).name === member);
      });
      if (matchingUnions.length === 0) return;
      if (matchingUnions.length > 1) {
        const hashMap: Record<string, IRegistryType> = {};
        matchingUnions.forEach(union => {
          if (!union) return;
          hashMap[union.getHash()] = union;
        });
        const remainingUnions = Object.values(hashMap);
        if (remainingUnions.length > 1) {
          this.logger.warn(
            `Multiple union types with member ${member} found and no matching type found from type hint ${hint?.getText()}`
          );
          return;
        }
        const remainingUnion = remainingUnions[0];
        return remainingUnion;
      }
      const matchingUnion = matchingUnions[0]!;
      return matchingUnion;
    };
    const matchingUnion = getUnion();
    if (!matchingUnion) return;
    return {
      propertyName: member,
      ref: matchingUnion.getSymbol() as Symbol | ISyntheticSymbol,
      isUnionTypeValueReference: true,
    };
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
        const primitiveType = new TypeRegistryPrimitiveType(this.utils, this, primIdx);
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
    Object.values(this.symbolMap).forEach(regType => regType?.resetHash());
    // Go through each type and hash them, replacing duplicates
    Object.entries(this.symbolMap).forEach(([idx, regType]) => {
      if (!regType) {
        delete this.symbolMap[idx];
        return;
      }
      this.logger.trace(`Registering references of ${regType.getStructure().name}`);
      regType.updateDefaultValues();
      regType.registerRefs();
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
      const sortedIndices = indices.sort((a, b) => {
        const aEntry = this.getWithKey(a);
        const bEntry = this.getWithKey(b);
        const aValue = calculateValue(aEntry);
        const bValue = calculateValue(bEntry);
        return bValue - aValue;
      });
      const [firstIdx, ...rest] = sortedIndices;

      const names: Array<string | undefined> = [];
      rest.forEach(idx => {
        const str = this.symbolMap[idx];
        names.push(str?.getStructure().name);
        replacementMap[idx] = firstIdx;
        delete this.symbolMap[idx];
      });
      const kept = this.symbolMap[firstIdx]?.getStructure().name;
      this.logger.trace(
        `Stripped ${rest.length} (${names} -> ${kept}), duplicate types with hash ${hash}`
      );
      this.redirects = { ...this.redirects, ...replacementMap };
    });
  }
  private getElements(mapper: NameMapper): ICSharpElement[] {
    const symbolMapValues = Object.values(this.symbolMap);
    const elemsToKeep: IRegistryType[] = [];
    const allNames = new Set<string>();
    symbolMapValues.forEach((elem, i) => {
      if (!elem || elem.isAnonymous) return;
      const { name } = elem.getStructure();
      if (this.ignoreClasses.has(name)) {
        this.logger.trace(`Filtering out ${name} because it is marked to be ignored`);
        return;
      }
      const elementIsUsed =
        elem.shouldBeRendered ||
        symbolMapValues.some(
          (e, j) => e && i !== j && (e.isDescendantOfPublic || e.isPublic) && e.usesType(elem)
        );
      if (elementIsUsed) {
        let reason = elem.isPublic ? "is public" : "";
        if (!reason && elem.isDescendantOfPublic) {
          reason = "is descendant of public";
        }
        if (!reason) {
          reason = "is referenced by another public or publicly-descended type";
        }
        this.logger.trace(`Including ${name} because it ${reason}`);
        elemsToKeep.push(elem);
        allNames.add(name);
      } else {
        this.logger.trace(`Filtering out ${name} because it is unused`);
      }
    });
    elemsToKeep.forEach(value => {
      if (!value) {
        return;
      }
      const { name } = value.getStructure();
      const match = name.match(/\d+$/);
      if (!match) return;
      const numStr = match[0];
      const idx = name.lastIndexOf(numStr);
      if (idx === -1) return;
      if (name === value.getOriginalName()) return;
      if (!value.isPublic && name.endsWith(`Member${numStr}`)) return;
      const newName = name.slice(0, idx);
      if (!newName) return;
      if (allNames.has(newName)) return;
      this.logger.trace(`Renaming ${name}->${newName}`);
      value.rename(newName);
      allNames.add(newName);
    });
    const cSharpElems = elemsToKeep.map(e => e.getCSharpElement(mapper));
    return cSharpElems;
  }
  toNamespace(name: string, mapper: NameMapper): CSharpNamespace {
    this.logger.info("Preparing to create namespace...");
    this.consolidate();
    this.logger.info("Creating namespace...");
    const elements = this.getElements(mapper);
    elements.sort((a, b) => {
      if (a.kind > b.kind) {
        return 1;
      }
      if (b.kind > a.kind) {
        return -1;
      }
      return a.name > b.name ? 1 : -1;
    });
    const ns = new CSharpNamespace(name, elements);
    this.logger.info(`Created namespace ${name}`);
    return ns;
  }
}

function calculateValue(t: IRegistryType | undefined): number {
  if (!t) {
    return -1000;
  }
  let v = 0;
  if (t.shouldBeRendered) {
    v += 100;
  }
  if (t.isPublic) {
    v += 100;
  }
  v -= t.getLevel();
  return v;
}
