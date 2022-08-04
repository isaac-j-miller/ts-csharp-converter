import { createHash } from "crypto";
import { MappedTypeNode, Symbol } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";
import {
  ConstType,
  IRegistryType,
  isConstType,
  isGenericReference,
  isPrimitiveType,
  ISyntheticSymbol,
  PrimitiveType,
  PropertyStructure,
  TokenType,
  TypeReference,
  TypeStructure,
  UnderlyingType,
} from "../types";
import { NonPrimitiveType, TypeRegistry } from "../registry";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";

export abstract class RegistryType<T extends TokenType>
  implements IRegistryType<T>
{
  private readonly originalName: string;
  public readonly tokenType: T;
  protected mappedTypeNode?: MappedTypeNode;
  constructor(
    protected registry: TypeRegistry,
    protected structure: TypeStructure<T>,
    private readonly symbol:
      | Symbol
      | PrimitiveType
      | ISyntheticSymbol
      | ConstType,
    public readonly shouldBeRendered: boolean,
    protected readonly internal: boolean,
    protected readonly type: UnderlyingType<T>,
    private readonly level: number,
    protected isMappedType: boolean
  ) {
    this.tokenType = structure.tokenType;
    this.originalName = structure.name;
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
  isPublic(): boolean {
    return !this.internal;
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
    property.genericParameters?.forEach((g) => {
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
      const foundGenericParam = this.structure.genericParameters?.find(
        (p) => p.name === gName
      );
      hashes.push(g + "." + this.hash(foundGenericParam));
    });
    return hashes.join(":");
  }
  private hashProperty(property: PropertyStructure): string {
    const { baseType, isArray, isOptional, arrayDepth } = property;
    const typeRef = {
      ref: baseType,
      isArray,
      arrayDepth: arrayDepth ?? 0,
    };
    const baseTypeHash = this.hashTypeRef(typeRef);
    return `${baseTypeHash}#${isOptional}#${isArray}#${this.hashGenericParameters(
      property
    )}`;
  }
  private hashTypeRef(ref: TypeReference | undefined): string {
    if (!ref) {
      return "undefined";
    }
    const { arrayDepth, isArray, ref: typeRef } = ref;
    let baseTypeHash: string;
    if (isGenericReference(typeRef)) {
      baseTypeHash = typeRef.genericParamName;
    } else {
      const fromRegistry = this.registry.getType(typeRef);
      baseTypeHash =
        (fromRegistry?.getHash() ?? "undefined") +
        `a:${isArray};d:${arrayDepth ?? 0}`;
    }
    return baseTypeHash;
  }
  private hashProperties(
    properties: Record<string, PropertyStructure>
  ): string {
    const hashedArray = Object.entries(properties).map(
      ([key, p]) => `${key}:${this.hashProperty(p)}`
    );
    return this.hash(hashedArray);
  }
  getHash() {
    const {
      name,
      tokenType,
      unionMembers,
      properties,
      tupleMembers,
      mappedIndexType,
      mappedValueType,
    } = this.structure;
    const unionHash = this.hash(unionMembers);
    const propertiesHash = properties
      ? this.hashProperties(properties)
      : "undefined";
    const hash = `${tokenType}#${
      tokenType === "Primitive" || tokenType === "Instance" ? `${name}#` : ""
    }${unionHash}#${propertiesHash}#${this.hashTypeRef(
      mappedIndexType?.ref
    )}#${mappedIndexType?.genericParameters
      ?.map((g) => (typeof g === "string" ? g : this.hashTypeRef(g)))
      .join(".")}#${this.hashTypeRef(
      mappedValueType?.ref
    )}#${mappedValueType?.genericParameters
      ?.map((g) => (typeof g === "string" ? g : this.hashTypeRef(g)))
      .join(".")}#${tupleMembers?.map(
      (t) =>
        this.hashTypeRef(t.ref) +
        "#" +
        t.genericParameters
          ?.map((g) => (typeof g === "string" ? g : this.hashTypeRef(g)))
          .join(".")
    )}`;
    return hash;
  }
  getSymbol(): Symbol | PrimitiveType | ISyntheticSymbol | ConstType {
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
}
