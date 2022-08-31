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
  ISyntheticSymbol,
  NonPrimitiveType,
  PrimitiveType,
  PropertyStringArg,
  PropertyStringArgs,
  PropertyStructure,
  RegistryKey,
  TokenType,
  TypeReference,
  TypeStructure,
  UnderlyingType,
} from "../types";
import type { TypeRegistry } from "../registry";
import type { TypeRegistryPossiblyGenericType } from "./possibly-generic";

export abstract class RegistryType<T extends TokenType> implements IRegistryType<T> {
  protected refs: Set<string>;
  private _hash?: string;
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
  private hashProperty(property: PropertyStructure): string {
    const { baseType, isArray, isOptional, arrayDepth, defaultLiteralValue } = property;
    const typeRef = {
      ref: baseType,
      isArray,
      arrayDepth: arrayDepth ?? 0,
    };
    const baseTypeHash = this.hashTypeRef(typeRef);
    return `${baseTypeHash}#${isOptional}#${isArray}#${this.hashGenericParameters(
      property
    )}#${defaultLiteralValue}`;
  }
  private hashTypeRef(ref: TypeReference | undefined): string {
    if (!ref) {
      return "_";
    }
    const { arrayDepth, isArray, ref: typeRef, genericParameters } = ref;
    let baseTypeHash: string;
    if (isGenericReference(typeRef)) {
      baseTypeHash = typeRef.genericParamName;
    } else {
      const fromRegistry = this.registry.getType(typeRef);
      let prefix = "_";
      if (fromRegistry) {
        if (fromRegistry.getStructure().name === this.structure.name) {
          prefix = this.getStructure().name + "(this)";
        } else {
          prefix = fromRegistry.getHash();
        }
      }
      baseTypeHash =
        prefix +
        `a:${isArray};d:${arrayDepth ?? 0}.${this.hashPropertyStringArgs(genericParameters)}`;
    }
    return createHash("md5").update(baseTypeHash).digest().toString("hex");
  }
  private hashProperties(properties: Record<string, PropertyStructure>): string {
    const hashedArray = Object.entries(properties).map(
      ([key, p]) => `${key}:${this.hashProperty(p)}`
    );
    return this.hash(hashedArray.sort());
  }
  private hashGenericParams(params: GenericParameter[] | undefined) {
    if (!params || params.length === 0) return "_";
    const hashFn = (g: GenericParameter) =>
      `${this.hashTypeRef(g.constraint)},${this.hashTypeRef(g.default)},${this.hashTypeRef(
        g.apparent
      )}`;
    return params.map(hashFn).join(",");
  }
  private hashPropertyStringArgs(args: PropertyStringArgs | undefined) {
    if (!args || args.length === 0) return "_";
    const hashFn = (g: PropertyStringArg) => (typeof g === "string" ? g : this.hashTypeRef(g));
    return args.map(hashFn).join(",");
  }
  private hashTupleMembers(members?: Array<TypeReference<BaseTypeReference>>) {
    return members?.map(m => this.hashTypeRef(m)).join(",") ?? "_";
  }
  getHash() {
    if (this._hash) return this._hash;
    const {
      name,
      tokenType,
      unionMembers,
      properties,
      tupleMembers,
      mappedIndexType,
      mappedValueType,
      genericParameters,
    } = this.structure;
    const unionHash = this.hash(
      unionMembers?.sort((a, b) => {
        if (a > b) {
          return 1;
        }
        if (b > a) {
          return -1;
        }
        return 0;
      })
    );
    const propertiesHash = properties ? this.hashProperties(properties) : "_";
    // const refs =  createHash("md5").update(this.getRefHashes().sort().join("/")).digest().toString("hex")
    const hash = `${tokenType}#${
      tokenType === "Primitive" || tokenType === "Instance" ? `${name}#` : ""
    }${unionHash}#${propertiesHash}#${this.hashGenericParams(
      genericParameters
    )}#Index${this.hashTypeRef(mappedIndexType)}#${this.hashPropertyStringArgs(
      mappedIndexType?.genericParameters
    )}#Value${this.hashTypeRef(mappedValueType)}#${this.hashPropertyStringArgs(
      mappedIndexType?.genericParameters
    )}#T${this.hashTupleMembers(tupleMembers)}`;
    // if(this._hash && hash!==this._hash) {
    //   this.logger.warn(`Hash has changed for ${this.structure.name}`)
    // }
    this._hash = hash;
    return this._hash;
  }
  getSymbol(): Exclude<BaseTypeReference, GenericReference> {
    return this.symbol;
  }
  abstract getPropertyString(genericParameterValues?: TypeReference[]): string;
  abstract getCSharpElement(): CSharpElement;
  isGeneric(): this is TypeRegistryPossiblyGenericType<T> {
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
    return refs;
  }
  getRefHashes(): string[] {
    return Array.from(this.refs);
  }
  registerRefs(): void {
    const { properties, genericParameters, mappedValueType, mappedIndexType, tupleMembers } =
      this.getStructure();
    const refsFromProperties = Object.values(properties ?? {}).flatMap(p => [
      ...(p.genericParameters ?? []).flatMap(g => this.extractRefs(g)),
      p.baseType,
    ]);
    const refsFromGenericParams = (genericParameters ?? []).flatMap(g => [
      ...this.extractRefs(g.constraint),
      ...this.extractRefs(g.default),
    ]);
    const refs = [
      ...this.extractRefs(mappedIndexType),
      ...this.extractRefs(mappedValueType),
      ...(tupleMembers ?? []).flatMap(m => this.extractRefs(m)),
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
}
