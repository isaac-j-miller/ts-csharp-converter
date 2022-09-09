import { createHash } from "crypto";
import { MappedTypeNode, Symbol } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";
import { LoggerFactory } from "src/common/logging/factory";
import { ILogger } from "src/common/logging/types";
import {
  BaseTypeReference,
  ConstType,
  GenericParameter,
  GenericReference,
  IRegistryType,
  isConstType,
  isGenericReference,
  isPrimitiveType,
  isUnionTypeValueReference,
  ISyntheticSymbol,
  MemberType,
  NonPrimitiveType,
  PrimitiveType,
  PropertyStructure,
  RegistryKey,
  TokenType,
  TypeReference,
  TypeStructure,
  UnderlyingType,
  UnionEnumMember,
} from "../types";
import type { TypeRegistry } from "../registry";
import type { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { NameMapper } from "../name-mapper";
import { hashPropertyStringArgs, hashRef } from "../util";

export abstract class RegistryType<T extends TokenType> implements IRegistryType<T> {
  protected refs: Set<string>;
  protected _hash?: string;
  private readonly originalName: string;
  public readonly tokenType: T;
  protected logger: ILogger;
  protected mappedTypeNode?: MappedTypeNode;
  constructor(
    protected registry: TypeRegistry,
    protected structure: TypeStructure<T>,
    private readonly symbol: Symbol | PrimitiveType | ISyntheticSymbol | ConstType,
    private readonly _shouldBeRendered: boolean,
    protected readonly internal: boolean,
    public readonly isDescendantOfPublic: boolean,
    protected readonly type: UnderlyingType<T>,
    private readonly level: number,
    protected isMappedType: boolean
  ) {
    this.tokenType = structure.tokenType;
    this.originalName = structure.name;
    this.logger = LoggerFactory.getLogger("registry-type");
    this.refs = new Set<string>();
  }
  addCommentString(commentString: string) {
    if (this.structure.commentString) {
      this.structure.commentString += "\n" + commentString;
    } else {
      this.structure.commentString = commentString;
    }
  }
  getLevel(): number {
    return this.level;
  }
  get isPublic(): boolean {
    return !this.internal;
  }
  get shouldBeRendered() {
    return !this.isAnonymous && (this.isDescendantOfPublic || this.isPublic);
  }
  get isAnonymous(): boolean {
    return !this._shouldBeRendered;
  }
  rename(newName: string) {
    this.structure.name = newName;
  }
  getOriginalName(): string {
    return this.originalName;
  }
  getType(): UnderlyingType<T> {
    return this.type;
  }
  getStructure(): TypeStructure<T> {
    return this.structure;
  }
  private hash(obj: object | undefined) {
    let cache: any[] | null = [];
    const circularReplacer = (key: any, value: any) => {
      if (typeof value === "object" && value !== null) {
        // Duplicate reference found, discard key
        if (cache?.includes(value)) return;
        // Store value in our collection
        cache?.push(value);
      }
      return value;
    };
    if (obj === undefined) {
      return "";
    }
    const stringified = JSON.stringify(obj, circularReplacer);
    cache = null;
    return createHash("md5").update(stringified).digest().toString("hex");
  }
  private hashGenericParameters(property: PropertyStructure): string {
    const hashes: string[] = [];
    property.genericParameters?.forEach(g => {
      let gName: string;
      if (isGenericReference(g.ref)) {
        gName = g.ref.genericParamName;
      } else if (isConstType(g.ref)) {
        throw new Error("__const__ should not be referenced");
      } else if (isPrimitiveType(g.ref)) {
        gName = g.ref.primitiveType;
      } else {
        const fromRegistry = this.registry.getType(g.ref);
        if (!fromRegistry) {
          throw new Error("Type not found in registry");
        }
        gName = fromRegistry.getStructure().name;
      }
      const foundGenericParam = this.structure.genericParameters?.find(p => p.name === gName);
      hashes.push(g + "." + this.hash(foundGenericParam));
    });
    return hashes.join(":");
  }
  private hashProperty(namesToIgnore: Set<string>, property: PropertyStructure): string {
    const { baseType, isArray, isOptional, arrayDepth, defaultLiteralValue } = property;
    const typeRef = {
      ref: baseType,
      isArray,
      arrayDepth: arrayDepth ?? 0,
    };
    const baseTypeHash = hashRef(this.registry, typeRef, namesToIgnore);
    return `${baseTypeHash}#${isOptional}#${isArray}#${this.hashGenericParameters(
      property
    )}#${defaultLiteralValue}`;
  }
  private hashProperties(
    namesToIgnore: Set<string>,
    properties: Record<string, PropertyStructure>
  ): string {
    const indices = Object.keys(properties).sort();
    const hashedArray = indices.map(
      key => `${key}:${this.hashProperty(namesToIgnore, properties[key])}`
    );
    return this.hash(hashedArray);
  }
  private hashGenericParams(namesToIgnore: Set<string>, params: GenericParameter[] | undefined) {
    if (!params || params.length === 0) return "_";
    const hashFn = (g: GenericParameter) =>
      `${hashRef(this.registry, g.constraint, namesToIgnore)},${hashRef(
        this.registry,
        g.default,
        namesToIgnore
      )},${hashRef(this.registry, g.apparent, namesToIgnore)}`;
    return params.map(hashFn).join(",");
  }
  private hashMembers(namesToIgnore: Set<string>, members?: Array<MemberType<T>>) {
    const hashed = members?.map(m => {
      if ((m as UnionEnumMember).name) {
        const asUnionEnumMember = m as UnionEnumMember;
        return `${asUnionEnumMember.name}#${asUnionEnumMember.value ?? "_"}`;
      }
      const asRef = m as TypeReference<BaseTypeReference>;
      return hashRef(this.registry, asRef, namesToIgnore);
    });
    if (this.structure.tokenType !== "Tuple") {
      hashed?.sort((a, b) => {
        if (a > b) {
          return 1;
        }
        if (b > a) {
          return -1;
        }
        return 0;
      });
    }
    return (hashed ?? []).join(",") ?? "_";
  }
  getHash(namesToIgnore?: Set<string>) {
    if (this._hash) return this._hash;
    const {
      name,
      tokenType,
      members,
      properties,
      mappedIndexType,
      mappedValueType,
      genericParameters,
    } = this.structure;
    namesToIgnore = namesToIgnore ?? new Set();
    namesToIgnore.add(this.getOriginalName());
    namesToIgnore.add(this.structure.name);
    const propertiesHash = properties ? this.hashProperties(namesToIgnore, properties) : "_";
    const hash = `${tokenType}#${
      tokenType === "Primitive" || tokenType === "Instance" ? `${name}#` : ""
    }#${propertiesHash}#${this.hashGenericParams(namesToIgnore, genericParameters)}#Index${hashRef(
      this.registry,
      mappedIndexType,
      namesToIgnore
    )}#${hashPropertyStringArgs(
      this.registry,
      mappedIndexType?.genericParameters,
      namesToIgnore
    )}#Value${hashRef(this.registry, mappedValueType, namesToIgnore)}#${hashPropertyStringArgs(
      this.registry,
      mappedIndexType?.genericParameters,
      namesToIgnore
    )}#M${this.hashMembers(namesToIgnore, members)}`;
    this._hash = hash;
    return this._hash;
  }
  getSymbol(): Exclude<BaseTypeReference, GenericReference> {
    return this.symbol;
  }
  abstract getPropertyString(genericParameterValues?: TypeReference[]): string;
  abstract getCSharpElement(mapper: NameMapper): CSharpElement;
  isGeneric(): this is TypeRegistryPossiblyGenericType<Exclude<T, "Primitive" | "Const">> {
    return false;
  }
  isNonPrimitive(): this is IRegistryType<NonPrimitiveType> {
    return true;
  }
  equals(refFromRegistry: IRegistryType) {
    if (refFromRegistry.getStructure().tokenType !== this.structure.tokenType) return false;
    return this.getHash() === refFromRegistry.getHash();
  }
  usesType(type: IRegistryType): boolean {
    const hash = type.getHash();
    return this.refs.has(hash);
  }
  usesRef(ref: RegistryKey): boolean {
    const fromRegistry = this.registry.getType(ref);
    if (!fromRegistry) return false;
    return this.usesType(fromRegistry);
  }
  private extractRefs(ref: TypeReference<BaseTypeReference> | undefined): BaseTypeReference[] {
    if (!ref) return [];
    const refs: BaseTypeReference[] = [ref.ref];
    ref.genericParameters?.forEach(g => {
      if (typeof g !== "string") {
        const refsFromGenericParams = this.extractRefs(g);
        refs.push(...refsFromGenericParams);
      }
      // TODO: figure out what to do if string
    });
    if (!isGenericReference(ref.ref)) {
      const fromReg = this.registry.getType(ref.ref);
      if (fromReg?.getStructure().tokenType === "ClassUnionInstance") {
        const relevantUnionBaseType = fromReg.getBaseTypeRef();
        if (relevantUnionBaseType) {
          refs.push(relevantUnionBaseType);
        }
      }
    }
    return refs;
  }
  getBaseTypeRef(): Symbol | ISyntheticSymbol | undefined {
    return;
  }
  getRefHashes(): string[] {
    return Array.from(this.refs);
  }
  registerRefs(): void {
    const { properties, genericParameters, mappedValueType, mappedIndexType, members } =
      this.getStructure();
    const refsFromProperties = Object.values(properties ?? {}).flatMap(p => [
      ...(p.genericParameters ?? []).flatMap(g => this.extractRefs(g)),
      p.baseType,
      isUnionTypeValueReference(p.defaultLiteralValue) ? p.defaultLiteralValue.ref : undefined,
    ]);
    const refsFromGenericParams = (genericParameters ?? []).flatMap(g => [
      ...this.extractRefs(g.constraint),
      ...this.extractRefs(g.default),
    ]);
    const refs = [
      ...this.extractRefs(mappedIndexType),
      ...this.extractRefs(mappedValueType),
      ...(members ?? []).flatMap(m =>
        this.tokenType === "ClassUnionInstance" ? this.extractRefs(m as TypeReference) : []
      ),
      ...refsFromProperties,
      ...refsFromGenericParams,
    ];
    refs.forEach(ref => {
      if (!ref) return;
      const shouldIgnore = isGenericReference(ref) || isConstType(ref) || isPrimitiveType(ref);
      if (shouldIgnore) {
        return;
      }
      const fromRegistry = this.registry.getType(ref);
      if (!fromRegistry) {
        return;
      }
      const hash = fromRegistry.getHash();
      this.refs.add(hash);
      fromRegistry.getRefHashes().forEach(h => this.refs.add(h));
    });
  }
  updateDefaultValues() {
    //
  }
  resetHash(): void {
    delete this._hash;
  }
}
