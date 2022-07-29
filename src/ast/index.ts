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
import { IRegistryType } from "src/converter/types";
import { TypeFactory } from "src/converter/type-factory";

type DeclarationType =
  | EnumDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration;
export class AstTraverser {
  private project: Project;
  private entrySourceFile: SourceFile;
  private registry: TypeRegistry;
  private typeFactory: TypeFactory;
  constructor(entrypoint: string, tsconfigPath: string) {
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
    });
    this.entrySourceFile = this.project.getSourceFileOrThrow(entrypoint);
    this.registry = new TypeRegistry();
    this.typeFactory = new TypeFactory(this.registry);
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
    const options = { name, node, type: asType, internal };
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
