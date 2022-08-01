import { createHash } from "crypto";
import { Symbol, Type } from "ts-morph";
import { CSharpElement } from "src/csharp/elements";
import {
  ConstType,
  IRegistryType,
  isGenericReference,
  ISyntheticSymbol,
  PrimitiveType,
  PropertyStructure,
  TokenType,
  TypeStructure,
} from "../types";
import { TypeRegistry } from "../registry";

export abstract class RegistryType<T extends TokenType>
  implements IRegistryType<T>
{
  private readonly originalName: string;
  public readonly tokenType: T;
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
    protected readonly type: Type | undefined,
    private readonly level: number
  ) {
    this.tokenType = structure.tokenType;
    this.originalName = structure.name;
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
  getType() {
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
      const foundGenericParam = this.structure.genericParameters?.find(
        (p) => p.name === g
      );
      hashes.push(g + "." + this.hash(foundGenericParam));
    });
    return hashes.join(":");
  }
  private hashProperty(property: PropertyStructure): string {
    const { baseType, isArray, isOptional, genericParameters } = property;
    let baseTypeHash: string;
    if (isGenericReference(baseType)) {
      baseTypeHash = baseType.genericParamName;
    } else {
      const fromRegistry = this.registry.getType(baseType);
      baseTypeHash = fromRegistry?.getHash() ?? "undefined";
    }
    return `${baseTypeHash}#${isOptional}#${isArray}#${this.hashGenericParameters(
      property
    )}`;
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
      mappedIndexType,
      mappedValueType,
    } = this.structure;
    const unionHash = this.hash(unionMembers);
    const propertiesHash = properties
      ? this.hashProperties(properties)
      : "undefined";
    const hash = `${tokenType}#${
      tokenType === "Primitive" ? `${name}#` : ""
    }${unionHash}#${propertiesHash}#${mappedIndexType}#${mappedValueType}`;
    return hash;
  }
  getSymbol(): Symbol | PrimitiveType | ISyntheticSymbol | ConstType {
    return this.symbol;
  }
  abstract getPropertyString(genericParameterValues?: string[]): string;
  abstract getCSharpElement(): CSharpElement;
}
