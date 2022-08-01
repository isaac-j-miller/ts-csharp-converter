import { Symbol, Node, Type } from "ts-morph";
import {
  CSharpProperty,
  GenericParam,
  CSharpClass,
  CSharpGenericClass,
} from "src/csharp/elements";
import { TypeRegistry } from "../registry";
import {
  isGenericReference,
  ISyntheticSymbol,
  PropertyStructure,
  TypeReference,
} from "../types";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { getGenericTypeName } from "../util";

export type PropertyOptions = Omit<
  PropertyStructure,
  "propertyName" | "baseType"
>;

export class TypeRegistryType extends TypeRegistryPossiblyGenericType<"Type"> {
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    internal: boolean,
    node: Node,
    type: Type,
    level: number
  ) {
    super(registry, "Type", name, symbol, internal, true, node, type, level);
    this.structure.properties = {};
    this.structure.genericParameters = [];
  }
  addProperty(
    propertyName: string,
    baseType: TypeReference,
    options: PropertyOptions
  ) {
    const propertyStructure: PropertyStructure = {
      ...options,
      propertyName,
      baseType,
    };
    this.structure.properties![propertyName] = propertyStructure;
    if (isGenericReference(baseType)) {
      const paramName = baseType.genericParamName;
      const { genericParameters } = this.structure;
      const genericParameterNames = (genericParameters ?? []).map(
        (g) => g.name
      );
      if (!genericParameters?.find((p) => p.name === paramName)) {
        if (!genericParameters || genericParameters.length === 0) {
          this.structure.genericParameters = [{ name: paramName }];
        } else if (genericParameterNames.includes("__type")) {
          const idx = genericParameters.findIndex(
            (item) => item.name === "__type"
          );
          this.structure.genericParameters![idx] = {
            ...(this.structure.genericParameters![idx] ?? {}),
            name: paramName,
          };
        } else {
          this.structure.genericParameters!.push({
            name: paramName,
          });
        }
      }
    }
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
  private symbolToString(propName: string, baseType: TypeReference): string {
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
  private generateCSharpProperty(
    propName: string,
    struct: PropertyStructure
  ): CSharpProperty {
    const { baseType, isOptional, isArray, arrayDepth } = struct;
    const kindType = this.symbolToString(propName, baseType);
    const prop: CSharpProperty = {
      name: propName,
      accessLevel: "public",
      getter: true,
      setter: true,
      isConst: false,
      optional: isOptional,
      kind: isArray
        ? kindType + `[${",".repeat(arrayDepth ? arrayDepth - 1 : 0)}]`
        : kindType,
    };
    return prop;
  }

  private generateCSharpProperties(): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(
      ([propName, struct]) => this.generateCSharpProperty(propName, struct)
    );
  }
  private generateCSharpGenericParams(
    paramsToInclude: string[]
  ): Record<string, GenericParam> {
    return paramsToInclude.reduce((acc, curr) => {
      const param = (this.structure.genericParameters ?? []).find(
        (g) => g.name === curr
      );
      acc[curr] = {
        constraint: param?.constraint
          ? this.resolveTypeName(param.constraint)
          : undefined,
      };
      return acc;
    }, {} as Record<string, GenericParam>);
  }
  private getUsedGenericParams(): string[] {
    const { properties, genericParameters } = this.structure;
    if (!genericParameters || !properties) {
      return [];
    }
    const genericParamNames = genericParameters.map((g) => g.name);
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
  getCSharpElement(): CSharpClass {
    const props = this.generateCSharpProperties();
    const genericParams = this.getUsedGenericParams();
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        false,
        props,
        this.generateCSharpGenericParams(genericParams),
        undefined,
        this.internal
      );
    }
    return new CSharpClass(
      this.structure.name,
      false,
      props,
      false,
      undefined,
      this.internal
    );
  }
  getPropertyString(genericParameterValues?: string[]): string {
    const { name } = this.structure;
    return getGenericTypeName(name, genericParameterValues);
  }
}
