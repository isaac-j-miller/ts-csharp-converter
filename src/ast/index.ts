import {
  EnumDeclaration,
  InterfaceDeclaration,
  Node,
  Project,
  SourceFile,
  SyntaxKind,
  Type,
  TypeAliasDeclaration,
  VariableDeclaration,
} from "ts-morph";
import { TypeRegistry } from "src/converter/registry";
import { IRegistryType, LiteralValue } from "src/converter/types";
import { TypeFactory } from "src/converter/type-factory";
import {
  asPrimitiveTypeName,
  getArrayDepth,
  getFinalArrayType,
} from "src/converter/util";

type DeclarationType =
  | EnumDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration;
export class AstTraverser {
  private project: Project;
  private entrySourceFile: SourceFile;
  private registry: TypeRegistry;
  private typeFactory: TypeFactory;
  private sourceFilesProcessed: Set<string>;
  constructor(entrypoint: string, tsconfigPath: string) {
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
    });
    this.entrySourceFile = this.project.getSourceFileOrThrow(entrypoint);
    this.registry = new TypeRegistry();
    this.typeFactory = new TypeFactory(this.registry);
    this.sourceFilesProcessed = new Set<string>();
  }
  private processDeclaration<T extends DeclarationType>(node: T) {
    const name = node.getName();
    const asType = node.getType();
    return this.createType(name, node, asType);
  }
  private processVariableDeclaration(node: VariableDeclaration) {
    const name = node.getName();
    const asType = node.getType();
    const isArray = asType.isArray();

    const constType = this.registry.getConstValueType();
    const typeToUse = getFinalArrayType(asType);
    const literalType = asPrimitiveTypeName(typeToUse);
    let literal = typeToUse.getLiteralValue();
    const structure = node.getStructure();
    if (isArray && structure.initializer) {
      literal = eval(structure.initializer.toString());
    }
    if (!node.isExported() || !literalType) {
      return;
    }
    if (!literalType) {
      console.warn(`Invalid literal type (${name})`);
      return;
    }
    const arrayDepth = getArrayDepth(asType);
    constType.addConst(
      name,
      literalType,
      isArray,
      arrayDepth,
      literal as LiteralValue
    );
    console.debug(`Found declaration: ${name} = ${JSON.stringify(literal)}`);
  }
  private createType(
    name: string,
    node: Node,
    asType: Type,
    internal: boolean = false
  ): IRegistryType {
    const options = { name, node, type: asType, internal, level: 0 };
    const regType = this.typeFactory.createType(options);
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
        case SyntaxKind.MappedType: {
          const k = node.asKindOrThrow(kind);
          this.registry.markMappedType(k);
          break;
        }
        case SyntaxKind.VariableDeclaration:
          this.processVariableDeclaration(node.asKindOrThrow(kind));
          break;
        case SyntaxKind.ImportDeclaration:
        case SyntaxKind.ExportDeclaration: {
          const sourceFile = node
            .asKindOrThrow(kind)
            .getModuleSpecifierSourceFileOrThrow();
          const fp = sourceFile.getFilePath();
          if (!this.sourceFilesProcessed.has(fp)) {
            this.traverseNode(sourceFile);
            this.sourceFilesProcessed.add(fp);
          }
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
