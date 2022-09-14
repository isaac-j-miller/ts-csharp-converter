import { Symbol, Node } from "ts-morph";
import { GenericParam } from "src/csharp";
import { TypeRegistry } from "../registry";
import {
  BaseTypeReference,
  GenericParameter,
  isConstType,
  isGenericReference,
  isPrimitiveType,
  isPrimitiveTypeName,
  isUnionTypeValueReference,
  ISyntheticSymbol,
  PropertyStringArgs,
  TokenType,
  TypeReference,
  TypeStructure,
  UnderlyingType,
} from "../types";
import { ConfigDependentUtils, formatCSharpArrayString } from "../util";
import { RegistryType } from "./base";

export abstract class TypeRegistryPossiblyGenericType<
  T extends Exclude<TokenType, "Primitive" | "Const">
> extends RegistryType<T> {
  constructor(
    utils: ConfigDependentUtils,
    registry: TypeRegistry,
    tokenType: T,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    internal: boolean,
    isDescendantOfPublic: boolean,
    shouldBeRendered: boolean,
    protected readonly node: T extends "ClassUnion" ? undefined : Node,
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
    super(
      utils,
      registry,
      structure,
      sym,
      shouldBeRendered,
      internal,
      isDescendantOfPublic,
      type,
      level,
      !!isMappedType
    );
  }
  addGenericParameter(p: GenericParameter) {
    if (!this.structure.genericParameters) {
      this.structure.genericParameters = [];
    }
    this.structure.genericParameters.push(p);
  }
  public getGenericParameters(): GenericParameter[] {
    return (this.structure.genericParameters ?? []).filter(p =>
      this.genericParamShouldBeRendered(p)
    );
  }
  public genericParamShouldBeRendered(p: GenericParameter) {
    const { constraint, name } = p;
    if (!constraint) {
      return true;
    }
    if (isPrimitiveType(constraint.ref)) {
      return false;
    }
    if (isGenericReference(constraint.ref)) {
      return true;
    }
    if (isConstType(constraint.ref)) {
      throw new Error(
        `Should not reference const type: ${this.structure.name}(generic param ${name})`
      );
    }
    const fromRegistry = this.registry.getType(constraint.ref);
    if (!fromRegistry) {
      throw new Error(`Unable to find reference for ${this.structure.name}(generic param ${name})`);
    }
    return fromRegistry.getStructure().tokenType !== "StringUnion";
  }
  protected getGenericParametersOfProperty(propName: string): TypeReference[] {
    const property = (this.structure.properties ?? {})[propName];
    if (!property) {
      throw new Error(`Property ${propName} does not exist on ${this.structure.name}`);
    }
    const { genericParameters } = property;
    const givenGenericParams = genericParameters ?? [];
    const gParamsToRender = this.getGenericParameters();
    const filteredGenericParams = givenGenericParams.filter(g => {
      if (!isGenericReference(g.ref)) {
        return true;
      }
      const paramName = g.ref.genericParamName;
      return gParamsToRender.some(gParam => gParam.name === paramName);
    });
    return filteredGenericParams;
  }
  protected propertySymbolToString(propName: string, baseType: BaseTypeReference): string {
    if (isGenericReference(baseType)) {
      const p = this.structure.genericParameters?.find(g => g.name == baseType.genericParamName);
      if (!p || this.genericParamShouldBeRendered(p)) {
        return baseType.genericParamName;
      }
      if (p.apparent) {
        return this.resolveAndFormatTypeName(p.apparent);
      }
      if (p.constraint) {
        return this.resolveAndFormatTypeName(p.constraint);
      }
      if (p.default) {
        return this.resolveAndFormatTypeName(p.default);
      }
      throw new Error(
        `Generic param ${p.name} for ${this.structure.name} should not be rendered, but no fallback type found`
      );
    }
    const fromRegistry = this.registry.getType(baseType);
    if (!fromRegistry) {
      throw new Error(`Unable to find symbol for ${this.structure.name}.${propName}`);
    }
    const isGeneric = fromRegistry.isGeneric();
    if (!isGeneric) {
      return fromRegistry.getPropertyString();
    }
    const declaredGenericParams = fromRegistry.getGenericParameters();
    if (declaredGenericParams && declaredGenericParams.length > 0) {
      const genericParameters = this.getGenericParametersOfProperty(propName);
      return fromRegistry.getPropertyString(genericParameters);
    }
    return fromRegistry.getPropertyString();
  }
  protected generateCSharpGenericParams(): Record<string, GenericParam> {
    const genericParams = this.getGenericParameters();
    return genericParams.reduce((acc, param) => {
      acc[param.name] = {
        constraint: param?.constraint ? this.resolveAndFormatTypeName(param.constraint) : undefined,
      };
      return acc;
    }, {} as Record<string, GenericParam>);
  }
  public resolveAndFormatTypeName(t: TypeReference): string {
    if (isPrimitiveTypeName(t)) {
      return t;
    }
    const resolved = this.utils.resolveTypeName(
      this.registry,
      t.ref,
      this,
      t.genericParameters?.filter(h => {
        if (typeof h === "string") {
          return true;
        }
        if (isGenericReference(h.ref)) {
          const genericRef = h.ref;
          const param = this.structure.genericParameters?.find(
            g => g.name === genericRef.genericParamName
          );
          return !param || this.genericParamShouldBeRendered(param);
        }
        return true;
      })
    );
    return formatCSharpArrayString(resolved, t.isArray, t.arrayDepth);
  }
  protected getGenericParametersForPropertyString(givenValues: PropertyStringArgs): string[] {
    const { name } = this.structure;
    const genericParameters = this.getGenericParameters();
    const namesToUse: string[] = [];
    for (let i = 0; i < genericParameters.length; i++) {
      const thisParam = genericParameters[i];
      if (!this.genericParamShouldBeRendered(thisParam)) {
        continue;
      }
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
  override isGeneric() {
    return true;
  }
  updateDefaultValues(): void {
    Object.entries(this.structure.properties ?? {}).forEach(([propName, value]) => {
      const { defaultLiteralValue } = value;
      if (
        !defaultLiteralValue ||
        isUnionTypeValueReference(defaultLiteralValue) ||
        typeof defaultLiteralValue !== "string"
      ) {
        return;
      }
      const propertyType = this.getType()
        ?.getProperty(propName)
        ?.getDeclarations()[0]
        ?.getType()
        ?.getConstraint();
      const unionMember = this.registry.findUnionTypesWithMember(defaultLiteralValue, propertyType);
      if (!unionMember) return;
      value.defaultLiteralValue = unionMember;
      value.baseType = unionMember.ref;
    });
  }
}
