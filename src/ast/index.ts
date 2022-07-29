import {
  EnumDeclaration,
  InterfaceDeclaration,
  Node,
  Project,
  SourceFile,
  SyntaxKind,
  Type,
  TypeAliasDeclaration,
} from "ts-morph";
import { TypeRegistry } from "src/converter/registry";
import {
  TypeRegistryDictType,
  TypeRegistryType,
  TypeRegistryUnionType,
} from "src/converter/registry-types";
import { IRegistryType } from "src/converter/types";
import {
  asPrimitiveTypeName,
  createSymbol,
  getFinalSymbolOfType,
} from "src/converter/util";

type DeclarationType =
  | EnumDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration;
export class AstTraverser {
  private project: Project;
  private entrySourceFile: SourceFile;
  private registry: TypeRegistry;
  constructor(entrypoint: string, tsconfigPath: string) {
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
    });
    this.entrySourceFile = this.project.getSourceFileOrThrow(entrypoint);
    this.registry = new TypeRegistry();
  }
  private processDeclaration<T extends DeclarationType>(node: T) {
    const name = node.getName();
    const asType = node.getType();
    return this.createType(name, node, asType);
  }
  private createType(
    name: string,
    node: Node,
    asType: Type,
    internal: boolean = false
  ): IRegistryType {
    const typeAsPrimitive = asPrimitiveTypeName(asType);
    if (typeAsPrimitive) {
      return this.registry.getType(typeAsPrimitive)!;
    }
    const symbolToUse = createSymbol(name, asType);
    if (asType.isUnion()) {
      const unionTypes = asType.getUnionTypes();
      const nonUndefinedUnionTypes = unionTypes.filter((u) => !u.isUndefined());
      if (
        nonUndefinedUnionTypes.every((unionType) => unionType.isStringLiteral())
      ) {
        const members = unionTypes.map((member) =>
          member.getLiteralValueOrThrow()
        );
        const unionRegType = new TypeRegistryUnionType(
          this.registry,
          name,
          symbolToUse,
          members as string[],
          internal,
          asType
        );
        console.debug(`Adding union type ${name} to registry`);
        this.registry.addType(unionRegType);
        return unionRegType;
      }
      if (nonUndefinedUnionTypes.length === 1) {
        return this.createType(name, node, nonUndefinedUnionTypes[0], internal);
      }
    }
    const stringIndexType = asType.getStringIndexType();
    if (stringIndexType) {
      const valueType = stringIndexType.getApparentType();
      const indexType = this.registry.getType("string")!.getSymbol();
      const valueTypeName = `${name}Value`;
      console.debug(`Creating internal type ${valueTypeName}`);
      const vType = this.createType(valueTypeName, node, valueType, true);

      const mappedType = new TypeRegistryDictType(
        this.registry,
        name,
        symbolToUse,
        indexType,
        vType.getSymbol(),
        internal,
        node,
        asType
      );
      mappedType.addGenericParameters(asType);
      console.debug(`Adding mapped type ${name} to registry`);
      this.registry.addType(mappedType);
      return mappedType;
    }
    const regType = new TypeRegistryType(
      this.registry,
      name,
      symbolToUse,
      internal,
      node,
      asType
    );
    regType.addGenericParameters(asType);
    const propertySignatures = asType.getApparentProperties();
    propertySignatures.forEach((property) => {
      const propertyName = property.getName();
      const isOptional = property.isOptional();
      const propertyType = property.getTypeAtLocation(node);
      const isArray = propertyType.isArray();
      const typeArgs = propertyType.getAliasTypeArguments();
      const genericParameters = typeArgs.map(
        (t) =>
          t.getAliasSymbol()?.getName() ??
          t.getSymbol()?.getName() ??
          t.getText()
      );
      const propertyText = propertyType.getText();
      const propertyTypeSymbol = propertyType.getSymbol();
      const arrayElemType = propertyType.getArrayElementType();
      const primitiveType = asPrimitiveTypeName(propertyType);
      if (propertyType.isTypeParameter()) {
        const genericParamName = propertyType.getSymbolOrThrow().getName();
        regType.addProperty(
          propertyName,
          {
            genericParamName,
            isGenericReference: true,
          },
          {
            isArray,
            isOptional,
            genericParameters,
          }
        );
      } else if (primitiveType) {
        const primitiveSymbol = this.registry
          .getType(primitiveType)!
          .getSymbol();
        regType.addProperty(propertyName, primitiveSymbol, {
          isArray,
          isOptional,
          genericParameters,
        });
      } else if (propertyTypeSymbol) {
        if (isArray) {
          const arrayElemTypeSymbol = getFinalSymbolOfType(
            arrayElemType!.getApparentType()
          );
          const inRegistry =
            arrayElemTypeSymbol && this.registry.getType(arrayElemTypeSymbol);
          if (inRegistry) {
            regType.addProperty(propertyName, arrayElemTypeSymbol, {
              isArray,
              isOptional,
            });
          } else {
            console.debug(`Creating internal type ${name}${propertyName}Class`);
            const anon = this.createType(
              `${name}${propertyName}Class`,
              node,
              arrayElemType!,
              true
            );
            regType.addProperty(propertyName, anon.getSymbol(), {
              isArray,
              isOptional,
              genericParameters,
            });
          }
        } else {
          const inRegistry = this.registry.getType(propertyTypeSymbol);
          if (!inRegistry) {
            if (propertyType)
              console.debug(
                `Creating internal type ${name}${propertyName}Class`
              );
            const anon = this.createType(
              `${name}${propertyName}Class`,
              node,
              propertyType,
              true
            );
            regType.addProperty(propertyName, anon.getSymbol(), {
              isArray,
              isOptional,
              genericParameters,
            });
          } else {
            regType.addProperty(propertyName, propertyTypeSymbol, {
              isArray,
              isOptional,
              genericParameters,
            });
          }
        }
      } else {
        const fromText = this.registry.findTypeBySymbolText(propertyText);
        if (fromText) {
          regType.addProperty(propertyName, fromText.getSymbol(), {
            isArray,
            isOptional,
            genericParameters,
          });
        } else {
          if (propertyType) {
            console.debug(`Creating internal type ${name}${propertyName}Class`);
            const anon = this.createType(
              `${name}${propertyName}Class`,
              node,
              propertyType,
              true
            );
            regType.addProperty(propertyName, anon.getSymbol(), {
              isArray,
              isOptional,
              genericParameters,
            });
          } else {
            console.warn(
              `No symbol for property ${propertyName} on type ${name}!`
            );
            const primitiveSymbol = this.registry
              .getType("object")!
              .getSymbol();
            regType.addProperty(propertyName, primitiveSymbol, {
              isArray,
              isOptional,
              genericParameters,
            });
          }
        }
      }
    });
    console.debug(`Adding type ${name} to registry`);
    this.registry.addType(regType);
    return regType;
  }
  private traverseNode(node: Node) {
    node.forEachDescendant((node) => {
      const kind = node.getKind();
      switch (kind) {
        case SyntaxKind.TypeAliasDeclaration:
        case SyntaxKind.InterfaceDeclaration:
        case SyntaxKind.EnumDeclaration:
          this.processDeclaration(node.asKindOrThrow(kind));
          break;
        case SyntaxKind.ImportDeclaration:
        case SyntaxKind.ExportDeclaration: {
          const sourceFile = node
            .asKindOrThrow(kind)
            .getModuleSpecifierSourceFileOrThrow();
          this.traverseNode(sourceFile);
          break;
        }
        default:
          break;
      }
    });
  }
  traverse() {
    this.traverseNode(this.entrySourceFile);
  }
  createNamespace(name: string) {
    return this.registry.toNamespace(name);
  }
}
