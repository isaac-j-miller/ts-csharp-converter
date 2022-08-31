import { Symbol, Node, Type } from "ts-morph";
import { CSharpClass, CSharpGenericClass } from "src/csharp/elements";
import { CSharpProperty } from "src/csharp/types";
import { TypeRegistry } from "../registry";
import {
  BaseTypeReference,
  isGenericReference,
  ISyntheticSymbol,
  PropertyStructure,
  TypeReference,
} from "../types";
import { TypeRegistryPossiblyGenericType } from "./possibly-generic";
import { formatCSharpArrayString, getGenericTypeName, literalValueToCSharpLiteralValue } from "../util";

export type PropertyOptions = Omit<PropertyStructure, "propertyName" | "baseType">;

export class TypeRegistryType extends TypeRegistryPossiblyGenericType<"Type"> {
  constructor(
    registry: TypeRegistry,
    name: string,
    symbol: Symbol | ISyntheticSymbol,
    internal: boolean,
    isDescendantOfPublic: boolean,
    node: Node,
    type: Type,
    level: number,
    commentString?: string
  ) {
    super(registry, "Type", name, symbol, internal, isDescendantOfPublic, true, node, type, level);
    this.structure.commentString = commentString;
  }
  addCommentStringToProperty(propertyName: string, newCommentString: string): void {
    const prop = this.structure.properties![propertyName];
    if (!prop) {
      throw new Error(`Type ${this.structure.name} has no property "${propertyName}"`);
    }
    const { commentString } = prop;
    prop.commentString = (commentString ? commentString + "\n" : "") + newCommentString;
  }
  addGenericParameterToProperty(propertyName: string, ref: TypeReference<BaseTypeReference>) {
    const prop = (this.structure.properties ?? {})[propertyName];
    if (!prop) {
      throw new Error(`Type ${this.structure.name} has no property "${propertyName}"`);
    }
    prop.genericParameters = [...(prop.genericParameters ?? []), ref];
  }
  addProperty(propertyName: string, baseType: BaseTypeReference, options: PropertyOptions) {
    const propertyStructure: PropertyStructure = {
      ...options,
      propertyName,
      baseType,
    };
    if (!this.structure.properties) {
      this.structure.properties = {};
    }
    const existing = this.structure.properties[propertyName] ?? {};
    this.structure.properties[propertyName] = {
      ...existing,
      ...propertyStructure,
    };
    if (isGenericReference(baseType)) {
      const paramName = baseType.genericParamName;
      const { genericParameters } = this.structure;
      const genericParameterNames = (genericParameters ?? []).map(g => g.name);
      if (!genericParameters?.find(p => p.name === paramName)) {
        if (!genericParameters || genericParameters.length === 0) {
          this.structure.genericParameters = [{ name: paramName }];
        } else if (genericParameterNames.includes("__type")) {
          const idx = genericParameters.findIndex(item => item.name === "__type");
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

  private generateCSharpProperty(propName: string, struct: PropertyStructure): CSharpProperty {
    const { baseType, isOptional, isArray, arrayDepth, commentString, defaultLiteralValue } = struct;
    const kindType = this.propertySymbolToString(propName, baseType);
    const prop: CSharpProperty = {
      name: propName,
      accessLevel: "public",
      getter: true,
      setter: !defaultLiteralValue,
      isConst: false,
      optional: isOptional,
      commentString,
      defaultValue: literalValueToCSharpLiteralValue(defaultLiteralValue),
      kind: formatCSharpArrayString(kindType, isArray, arrayDepth ?? 0),
    };
    return prop;
  }

  private generateCSharpProperties(): CSharpProperty[] {
    return Object.entries(this.structure.properties!).map(([propName, struct]) =>
      this.generateCSharpProperty(propName, struct)
    );
  }

  getCSharpElement(): CSharpClass {
    const props = this.generateCSharpProperties();
    const partial = this.isMappedType;
    if (
      (!this.structure.properties || Object.keys(this.structure.properties).length === 0) &&
      !partial
    ) {
      const src = this.node.getSourceFile().getFilePath();
      const startLine = this.node.getStartLineNumber(false);
      this.addCommentString(
        `Warning: This class might not have been generated correctly. Source to check ${src}:${startLine}\nSource code: ${this.node.getFullText()}`
      );
    }
    if ((this.structure.genericParameters ?? []).length > 0) {
      return new CSharpGenericClass(
        this.structure.name,
        partial,
        props,
        this.generateCSharpGenericParams(),
        undefined,
        [],
        [],
        this.internal,
        this.structure.commentString
      );
    }
    return new CSharpClass(
      this.structure.name,
      partial,
      props,
      false,
      undefined,
      [],
      [],
      this.internal,
      this.structure.commentString
    );
  }

  getPropertyString(genericParameterValues?: TypeReference[]): string {
    const { name } = this.structure;
    const namesToUse = this.getGenericParametersForPropertyString(genericParameterValues ?? []);
    return getGenericTypeName(name, namesToUse);
  }
}
