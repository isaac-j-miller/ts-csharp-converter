import { Symbol, Type, Node } from "ts-morph";
import { TypeRegistry } from "../registry";
import {
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
import { getGenericParameters, toCSharpPrimitive } from "../util";
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
    type: Type,
    level: number
  ) {
    const structure: TypeStructure<T> = {
      tokenType,
      name,
      properties: {},
      genericParameters: [],
    };
    super(registry, structure, sym, shouldBeRendered, internal, type, level);
  }
  addGenericParameter(p: GenericParameter) {
    if (!this.structure.genericParameters) {
      this.structure.genericParameters = [];
    }
    this.structure.genericParameters!.push(p);
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
