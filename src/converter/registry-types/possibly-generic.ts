import { Symbol, Type, Node } from "ts-morph";
import { GenericParam } from "src/csharp";
import { TypeRegistry } from "../registry";
import {
  BaseTypeReference,
  GenericParameter,
  isConstType,
  isGenericReference,
  isPrimitiveType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  TokenType,
  TypeReference,
  TypeStructure,
} from "../types";
import {
  formatCsharpArrayString,
  getGenericParameters,
  getGenericTypeName,
  toCSharpPrimitive,
} from "../util";
import { RegistryType } from "./base";
import { TypeRegistryType } from "./type";

export abstract class TypeRegistryPossiblyGenericType<
  T extends TokenType
> extends RegistryType<T> {
  constructor(
    registry: TypeRegistry,
    tokenType: T,
    name: string,
    sym: Symbol | ISyntheticSymbol,
    internal: boolean,
    shouldBeRendered: boolean,
    protected readonly node: Node,
    type: Type,
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
      registry,
      structure,
      sym,
      shouldBeRendered,
      internal,
      type,
      level,
      !!isMappedType
    );
  }
  addGenericParameter(p: GenericParameter) {
    if (!this.structure.genericParameters) {
      this.structure.genericParameters = [];
    }
    this.structure.genericParameters!.push(p);
  }
  protected getUsedGenericParams(): string[] {
    const { properties, genericParameters } = this.structure;
    if (!genericParameters) {
      return [];
    }
    const genericParamNames = genericParameters.map((g) => g.name);
    if (!properties || Object.keys(properties).length === 0) {
      return genericParamNames;
    }
    const usedGenericParamsSet = new Set<string>();
    const cb = (params: string[]) => {
      params.forEach((p) => {
        usedGenericParamsSet.add(p);
      });
    };
    Object.keys(properties).forEach((name) => {
      const params = this.getGenericParametersOfProperty(name, cb);
      const { baseType } = properties[name];
      if (isGenericReference(baseType)) {
        usedGenericParamsSet.add(baseType.genericParamName);
      }
      if (params) {
        params.forEach((p) => {
          usedGenericParamsSet.add(p);
        });
      }
    });
    return genericParamNames.filter((g) => usedGenericParamsSet.has(g));
  }

  private getGenericParametersOfProperty(
    propName: string,
    onFoundArgCb?: (args: string[]) => void
  ): string[] | undefined {
    const property = (this.structure.properties ?? {})[propName];
    if (!property) {
      return;
    }
    const { baseType } = property;
    let numGenericArgs = 0;
    let restrictLength = false;
    if (!isGenericReference(baseType)) {
      const fromRegistry = this.registry.getType(baseType);
      if (fromRegistry && fromRegistry.tokenType === "Type") {
        const asRegistryType = fromRegistry as TypeRegistryType;
        numGenericArgs = asRegistryType.getUsedGenericParams().length;
        restrictLength = true;
      }
    }

    const thisType = this.getType();
    if (!thisType) {
      return;
    }
    const matchingProperty = thisType.getApparentProperty(propName);
    if (!matchingProperty) {
      throw new Error(
        `Property ${propName} declared but not found on type ${this.structure.name}`
      );
    }
    const valueDec = matchingProperty.getValueDeclaration();
    if (!valueDec) {
      return;
    }
    const valueDecType = valueDec.getType();
    let elemToUse = valueDecType;
    if (property.isArray) {
      elemToUse = valueDecType.getArrayElementType()!;
      if (!elemToUse) {
        throw new Error(
          `Property ${propName} on type ${this.structure.name} is supposed to be an array but the underlying declaration contradicts`
        );
      }
    }
    const args = elemToUse
      .getAliasTypeArguments()
      .map((a) => this.getArgString(a, onFoundArgCb))
      .filter((arg) => arg !== undefined) as string[];
    if (restrictLength) {
      return args.slice(0, numGenericArgs);
    }
    return args;
  }
  protected propertySymbolToString(
    propName: string,
    baseType: BaseTypeReference
  ): string {
    if (isGenericReference(baseType)) {
      return baseType.genericParamName;
    }
    const fromRegistry = this.registry.getType(baseType);
    if (fromRegistry) {
      const genericParameters = this.getGenericParametersOfProperty(propName);
      return fromRegistry.getPropertyString(genericParameters);
    }
    return this.resolveTypeName(baseType);
  }
  private getArgString(
    t: Type,
    cb?: (str: string[]) => void
  ): string | undefined {
    const name = (t.getAliasSymbol() ?? t.getSymbol())?.getName();
    if (!name) {
      return;
    }
    const aliasArgs = t.getAliasTypeArguments();
    const argsList = aliasArgs
      .map((a) => this.getArgString(a, cb))
      .filter((a) => a !== undefined) as string[];
    cb && cb(argsList);
    return getGenericTypeName(name, argsList);
  }
  protected generateCSharpGenericParams(
    paramsToInclude: string[]
  ): Record<string, GenericParam> {
    return paramsToInclude.reduce((acc, curr) => {
      const param = (this.structure.genericParameters ?? []).find(
        (g) => g.name === curr
      );
      acc[curr] = {
        constraint: param?.constraint
          ? this.resolveTypeName(param.constraint.ref)
          : undefined,
      };
      return acc;
    }, {} as Record<string, GenericParam>);
  }
  protected resolveAndFormatTypeName(t: TypeReference): string {
    const resolved = this.resolveTypeName(t.ref);
    return formatCsharpArrayString(resolved, t.isArray, t.arrayDepth);
  }
  protected resolveTypeName(ref: BaseTypeReference): string {
    if (isGenericReference(ref)) {
      return ref.genericParamName;
    }
    if (isPrimitiveType(ref)) {
      return toCSharpPrimitive(ref.primitiveType);
    }
    const registryType = this.registry.getType(ref);
    let genericParameterNames: string[] = [];
    if (registryType) {
      const { genericParameters } = registryType.getStructure();
      if (genericParameters && genericParameters.length > 0) {
        let typeToUse = registryType.getType()?.getApparentType();
        if (!typeToUse) {
          if (isSyntheticSymbol(ref)) {
            const underlyingSymbol = ref.getUnderlyingSymbol();
            typeToUse = ref.getDeclaredType();
            if (underlyingSymbol) {
              const typeFromUnderlyingSymbol =
                underlyingSymbol.getTypeAtLocation(this.node);
              if (typeFromUnderlyingSymbol) {
                typeToUse = typeFromUnderlyingSymbol;
              }
            }
          } else if (!isConstType(ref)) {
            typeToUse = ref.getTypeAtLocation(this.node);
          }
        }
        genericParameterNames = getGenericParameters(
          this.registry,
          typeToUse
        ).map((t) => t.name);
      }
      return registryType.getPropertyString(genericParameterNames);
    }

    console.error("Type not found in registry", ref);
    return "object";
  }
}
