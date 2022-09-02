import { CSharpClassUnion } from "src/csharp/elements/class-union";
import { getFirstNUppercaseLetters } from "src/csharp/util";
import { ISyntheticSymbol, TypeReference } from "../types";
import { TypeRegistry } from "../registry";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { getGenericTypeName } from "../util";

export class UnionSymbol implements ISyntheticSymbol {
  private readonly name: string;
  public readonly id: string;
  public readonly isSynthetic: true;
  public readonly isClassUnionBase: boolean;
  constructor(numElements: number) {
    this.name = `Union${numElements}`;
    this.id = this.name;
    this.isSynthetic = true;
    this.isClassUnionBase = true;
  }
  getName() {
    return this.name;
  }
  isAlias() {
    return false as const;
  }
  getUnderlyingSymbol() {
    return undefined;
  }
  getSourceFilePath() {
    return undefined;
  }
  getDeclaredType() {
    return undefined;
  }
}

export class TypeRegistryClassUnionType extends TypeRegistryPossiblyGenericType<"ClassUnion"> {
  private hasUpdatedHash?: boolean;
  constructor(
    registry: TypeRegistry,
    internal: boolean,
    isDescendantOfPublic: boolean,
    level: number,
    private numElements: number
  ) {
    const name = `Union${numElements}`;
    const symbol = new UnionSymbol(numElements);
    super(
      registry,
      "ClassUnion",
      name,
      symbol,
      internal,
      isDescendantOfPublic,
      true,
      undefined,
      undefined,
      level,
      false
    );
    const paramValues = getFirstNUppercaseLetters(numElements);
    paramValues.forEach(p => this.addGenericParameter({ name: p }));
  }
  usesRef(): boolean {
    return false;
  }
  getPropertyString(genericParameterValues?: TypeReference[]): string {
    const { name } = this.structure;
    if (this.numElements !== genericParameterValues?.length) {
      this.logger.error(
        `Mismatch number of generic args for ${name}: expected ${this.numElements}, got ${
          genericParameterValues?.length ?? 0
        }`
      );
    }
    const namesToUse = this.getGenericParametersForPropertyString(genericParameterValues ?? []);
    return getGenericTypeName(name, namesToUse);
  }
  override getHash(): string {
    if (this.hasUpdatedHash && this._hash) {
      return this._hash;
    }
    const baseHash = super.getHash();
    const withNumElements = baseHash + `NumElems=${this.numElements}`;
    this._hash = withNumElements;
    this.hasUpdatedHash = true;
    return this._hash;
  }
  getCSharpElement(): CSharpClassUnion {
    return new CSharpClassUnion(this.numElements);
  }
}
