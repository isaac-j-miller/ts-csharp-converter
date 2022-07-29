import { Symbol, Type, Node } from "ts-morph";
import { TypeRegistry } from "../registry";
import {
  isGenericReference,
  isPrimitiveType,
  isSyntheticSymbol,
  ISyntheticSymbol,
  TokenType,
  TypeReference,
  TypeStructure,
} from "../types";
import { getGenericTypeName, toCSharpPrimitive } from "../util";
import { RegistryType } from "./base";

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
    type: Type
  ) {
    const structure: TypeStructure<T> = {
      tokenType,
      name,
      properties: {},
      genericParameters: [],
    };
    super(registry, structure, sym, shouldBeRendered, internal, type);
  }
  addGenericParameters(t: Type) {
    const genericParameters = this.getGenericParameters(t);
    this.structure.genericParameters = [
      ...(this.structure.genericParameters ?? []),
      ...genericParameters,
    ];
  }
  private getGenericParameters(t: Type | undefined): string[] {
    if (!t) {
      return [];
    }
    const params: string[] = [];
    const genericParameters = t.getAliasTypeArguments();
    genericParameters.forEach((param) => {
      const v = (param.getSymbol() ?? param.getAliasSymbol())?.getName();
      if (!v) {
        console.debug(`Unable to find generic param name`);
        return;
      }
      params.push(v);
    });
    return params;
  }
  protected resolveTypeName(ref: TypeReference): string {
    if (isGenericReference(ref)) {
      return ref.genericParamName;
    }
    if (isPrimitiveType(ref)) {
      return toCSharpPrimitive(ref.primitiveType);
    }
    const registryType = this.registry.getType(ref);
    let genericParameterNames: string[] = [];
    if (registryType) {
      const { name, genericParameters } = registryType.getStructure();
      if (genericParameters && genericParameters.length > 0) {
        let typeToUse = registryType.getType()?.getApparentType();
        if (!typeToUse) {
          if (isSyntheticSymbol(ref)) {
            typeToUse = ref.getDeclaredType();
          } else {
            typeToUse = ref.getTypeAtLocation(this.node);
          }
        }
        genericParameterNames = this.getGenericParameters(typeToUse);
      }
      return getGenericTypeName(name, genericParameterNames);
    }

    console.error("Type not found in registry", ref);
    return "object";
  }
}
