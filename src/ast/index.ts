import {
  ForEachDescendantTraversalControl,
  InterfaceDeclaration,
  Node,
  Project,
  PropertySignature,
  SourceFile,
  SyntaxKind,
  Type,
  TypeAliasDeclaration,
} from "ts-morph";
import { TypeRegistry } from "src/converter/registry";
import {
  TypeRegistryType,
  TypeRegistryUnionType,
} from "src/converter/registry-types";
import { IRegistryType, PrimitiveTypeName } from "src/converter/types";
import { SyntheticSymbol } from "src/converter/synthetic/symbol";

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
  private processNode<T extends SyntaxKind>(kind: T, node: Node) {
    console.debug(`Got kind: ${SyntaxKind[kind]}`);
    // TODO: do something here
    return;
  }
  private processInterfaceDeclaration(node: InterfaceDeclaration) {}

  private createType(
    name: string,
    node: Node,
    asType: Type,
    internal: boolean = false
  ): IRegistryType {
    const symbolToUse =
      asType.getSymbol() ??
      asType.getAliasSymbol() ??
      new SyntheticSymbol(name, asType);
    if (asType.isUnion()) {
      const unionTypes = asType.getUnionTypes();
      if (unionTypes.every((unionType) => unionType.isStringLiteral())) {
        const members = unionTypes.map((member) =>
          member.getLiteralValueOrThrow()
        );
        const unionRegType = new TypeRegistryUnionType(
          name,
          symbolToUse,
          members as string[],
          internal
        );
        console.debug(`Adding type ${name} to registry`);
        this.registry.addType(unionRegType);
        return unionRegType;
      }
    }
    const regType = new TypeRegistryType(
      this.registry,
      name,
      symbolToUse,
      internal
    );
    const propertySignatures = asType.getApparentProperties();
    propertySignatures.forEach((property) => {
      const propertyName = property.getName();
      const isOptional = property.isOptional();
      const propertyType = property.getTypeAtLocation(node);
      const isArray = propertyType.isArray();
      const propertyText = propertyType.getText();
      const propertyTypeSymbol = propertyType.getSymbol();
      const arrayElemType = propertyType.getArrayElementType();
      if (name === "BlahBlah") {
        console.debug(name);
      }
      const getPrimitivePropertyType = (): PrimitiveTypeName | undefined => {
        if (propertyType.isString()) {
          return "string";
        }
        if (propertyType.isNumber()) {
          return "number";
        }
        if (propertyType.isBoolean()) {
          return "boolean";
        }
        if (propertyType.isAny()) {
          return "any";
        }
        return;
      };
      const primitiveType = getPrimitivePropertyType();
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
          }
        );
      } else if (primitiveType) {
        const primitiveSymbol = this.registry
          .getType(primitiveType)!
          .getSymbol();
        regType.addProperty(propertyName, primitiveSymbol, {
          isArray,
          isOptional,
        });
      } else if (propertyTypeSymbol) {
        if (isArray) {
          const arrayElemTypeSymbol = arrayElemType!.getSymbol();
          if (arrayElemTypeSymbol) {
            regType.addProperty(propertyName, arrayElemTypeSymbol, {
              isArray,
              isOptional,
            });
          } else {
            console.debug(
              `Creating anonymous type ${name}${propertyName}Class`
            );
            const anon = this.createType(
              `${name}${propertyName}Class`,
              node,
              arrayElemType!,
              true
            );
            regType.addProperty(propertyName, anon.getSymbol(), {
              isArray,
              isOptional,
            });
          }
        } else {
          regType.addProperty(propertyName, propertyTypeSymbol, {
            isArray,
            isOptional,
          });
        }
      } else {
        const fromText = this.registry.findTypeBySymbolText(propertyText);
        if (fromText) {
          regType.addProperty(propertyName, fromText.getSymbol(), {
            isArray,
            isOptional,
          });
        } else {
          console.warn(
            `No symbol for property ${propertyName} on type ${name}!`
          );
          const primitiveSymbol = this.registry.getType("object")!.getSymbol();
          regType.addProperty(propertyName, primitiveSymbol, {
            isArray,
            isOptional,
          });
        }
      }
    });
    const genericParameters = asType.getTypeArguments();
    genericParameters.forEach((param) => {
      const v = (param.getSymbol() ?? param.getAliasSymbol())?.getName();
      if (!v) {
        console.debug(`Unable to find generic param name`);
        return;
      }
      regType.addGenericParameter(v);
    });
    console.debug(`Adding type ${name} to registry`);
    this.registry.addType(regType);
    return regType;
  }
  private processTypeAliasDeclaration(node: TypeAliasDeclaration) {
    const name = node.getName();
    const asType = node.getType();
    return this.createType(name, node, asType);
  }
  private traverseNode(node: Node) {
    node.forEachDescendant((node, traversal) => {
      const kind = node.getKind();
      // console.debug(`Traversing node with kind ${SyntaxKind[kind]}`);
      switch (kind) {
        // case SyntaxKind.ConditionalType:
        case SyntaxKind.TypeAliasDeclaration:
          this.processTypeAliasDeclaration(node.asKindOrThrow(kind));
          break;
        case SyntaxKind.InterfaceDeclaration:
          this.processInterfaceDeclaration(node.asKindOrThrow(kind));
          break;
        // case SyntaxKind.LiteralType:
        case SyntaxKind.MappedType:
        case SyntaxKind.EnumDeclaration:
          // case SyntaxKind.NumericLiteral:
          // case SyntaxKind.PropertySignature:
          // case SyntaxKind.TupleType:
          // case SyntaxKind.TypeLiteral:
          // case SyntaxKind.TypeParameter:
          // case SyntaxKind.TypeReference:
          this.processNode(kind, node);
          break;
        // case SyntaxKind.UnionType:
        //     break;
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
