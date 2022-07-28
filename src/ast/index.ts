import {
  InterfaceDeclaration,
  Node,
  Project,
  Symbol,
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
import {
  IRegistryType,
  ISyntheticSymbol,
  PrimitiveTypeName,
} from "src/converter/types";
import { SyntheticSymbol } from "src/converter/synthetic/symbol";
import { getFinalSymbol } from "src/converter/util";

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
  private createSymbol(name: string, asType: Type): Symbol | ISyntheticSymbol {
    // let symbolToUse = asType.getSymbol() ?? asType.getAliasSymbol();
    // if (!symbolToUse || !(symbolToUse.compilerSymbol as any).id) {
    return new SyntheticSymbol(name, asType);
    // }
    // return getFinalSymbol(symbolToUse);
  }
  private asPrimitiveTypeName(type: Type): PrimitiveTypeName | undefined {
    const apparentType = type.getApparentType();
    const baseTypeName = apparentType
      .getBaseTypes()[0]
      ?.getText()
      ?.toLowerCase();
    const apparentTypeName = apparentType.getSymbol()?.getName()?.toLowerCase();

    if (
      apparentType.isString() ||
      baseTypeName === "string" ||
      apparentTypeName === "string"
    ) {
      return "string";
    }
    if (
      apparentType.isNumber() ||
      baseTypeName === "number" ||
      apparentTypeName === "number"
    ) {
      return "number";
    }
    if (
      apparentType.isBoolean() ||
      baseTypeName === "boolean" ||
      apparentTypeName === "boolean"
    ) {
      return "boolean";
    }
    if (apparentType.isAny()) {
      return "any";
    }
    return;
  }
  private createType(
    name: string,
    node: Node,
    asType: Type,
    internal: boolean = false
  ): IRegistryType {
    const asPrimitiveTypeName = this.asPrimitiveTypeName(asType);
    if (asPrimitiveTypeName) {
      return this.registry.getType(asPrimitiveTypeName)!;
    }
    const symbolToUse = this.createSymbol(name, asType);
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
          internal,
          asType
        );
        console.debug(`Adding union type ${name} to registry`);
        this.registry.addType(unionRegType);
        return unionRegType;
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
      const primitiveType = this.asPrimitiveTypeName(propertyType);
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
          const arrayElemTypeSymbol = arrayElemType!.getSymbol();
          if (arrayElemTypeSymbol) {
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
          console.warn(
            `No symbol for property ${propertyName} on type ${name}!`
          );
          const primitiveSymbol = this.registry.getType("object")!.getSymbol();
          regType.addProperty(propertyName, primitiveSymbol, {
            isArray,
            isOptional,
            genericParameters,
          });
        }
      }
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
