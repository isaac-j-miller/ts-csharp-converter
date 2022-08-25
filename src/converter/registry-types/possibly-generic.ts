import { Symbol, Node } from "ts-morph";
import { GenericParam } from "src/csharp";
import { TypeRegistry } from "../registry";
import {
  BaseTypeReference,
  GenericParameter,
  isGenericReference,
  ISyntheticSymbol,
  PropertyStringArgs,
  TokenType,
  TypeReference,
  TypeStructure,
  UnderlyingType,
} from "../types";
import { formatCSharpArrayString, resolveTypeName } from "../util";
import { RegistryType } from "./base";

export abstract class TypeRegistryPossiblyGenericType<T extends TokenType> extends RegistryType<T> {
  constructor(
    registry: TypeRegistry,
    tokenType: T,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    internal: boolean,
    shouldBeRendered: boolean,
    protected readonly node: Node,
    type: UnderlyingType<T>,
    level: number,
    isMappedType?: boolean
  ) {
    const structure: TypeStructure<T> = {
      tokenType,
      name,
      properties: {},
      genericParameters: [],
    };
    super(registry, structure, sym, shouldBeRendered, internal, type, level, !!isMappedType);
  }
  addGenericParameter(p: GenericParameter) {
    if (!this.structure.genericParameters) {
      this.structure.genericParameters = [];
    }
    this.structure.genericParameters!.push(p);
  }

  private getGenericParametersOfProperty(propName: string): TypeReference[] {
    const property = (this.structure.properties ?? {})[propName];
    if (!property) {
      throw new Error(`Property ${propName} does not exist on ${this.structure.name}`);
    }
    const { genericParameters } = property;
    const givenGenericParams = genericParameters ?? [];
    return givenGenericParams;
  }
  protected propertySymbolToString(propName: string, baseType: BaseTypeReference): string {
    if (isGenericReference(baseType)) {
      return baseType.genericParamName;
    }
    const fromRegistry = this.registry.getType(baseType);
    if (!fromRegistry) {
      throw new Error(`Unable to find symbol for ${this.structure.name}.${propName}`);
    }
    const declaredGenericParams = fromRegistry.getStructure().genericParameters;
    if (declaredGenericParams && declaredGenericParams.length > 0) {
      const genericParameters = this.getGenericParametersOfProperty(propName);
      return fromRegistry.getPropertyString(genericParameters);
    }
    return fromRegistry.getPropertyString();
  }
  protected generateCSharpGenericParams(): Record<string, GenericParam> {
    const genericParams = this.structure.genericParameters ?? [];
    return genericParams.reduce((acc, param) => {
      acc[param.name] = {
        constraint: param?.constraint ? this.resolveAndFormatTypeName(param.constraint) : undefined,
      };
      return acc;
    }, {} as Record<string, GenericParam>);
  }
  protected resolveAndFormatTypeName(t: TypeReference): string {
    const resolved = resolveTypeName(
      this.registry,
      t.ref,
      this.structure.genericParameters ?? [],
      t.genericParameters
    );
    return formatCSharpArrayString(resolved, t.isArray, t.arrayDepth);
  }
  protected getGenericParametersForPropertyString(givenValues: PropertyStringArgs): string[] {
    const { name } = this.structure;
    const genericParameters = this.structure.genericParameters ?? [];
    const namesToUse: string[] = [];
    for (let i = 0; i < genericParameters.length; i++) {
      const thisParam = genericParameters[i];
      const { default: defaultValue } = thisParam;
      const givenValue = givenValues[i];
      if (givenValue) {
        if (typeof givenValue === "string") {
          namesToUse.push(givenValue);
        } else {
          namesToUse.push(this.resolveAndFormatTypeName(givenValue));
        }
      } else if (defaultValue) {
        namesToUse.push(this.resolveAndFormatTypeName(defaultValue));
      } else {
        this.logger.warn(
          `No parameter defined for ${name}'s type parameter in position ${i} (${thisParam.name})!`
        );
      }
    }
    return namesToUse;
  }
  override isGeneric(): this is TypeRegistryPossiblyGenericType<T> {
    return true;
  }
}
