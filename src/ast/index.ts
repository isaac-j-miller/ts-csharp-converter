import { readFileSync } from "fs";
import path from "path";
import { TsConfigJson } from "type-fest";
import minimatch from "minimatch";
import deepmerge from "deepmerge";
import {
  EnumDeclaration,
  ExportDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ImportSpecifier,
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
  getComments,
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
  private tsconfig: TsConfigJson;
  private sourceFilesProcessed: Set<string>;
  private rootDir: string;
  constructor(
    entrypoint: string,
    tsconfigPath: string,
    private includeNodeModules: boolean = false,
    ignoreClasses: Set<string>
  ) {
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
    });
    this.entrySourceFile = this.project.getSourceFileOrThrow(entrypoint);
    this.registry = new TypeRegistry();
    this.typeFactory = new TypeFactory(this.registry, ignoreClasses);
    this.sourceFilesProcessed = new Set<string>();
    this.tsconfig = this.getTsConfig(tsconfigPath);
    const rel = path.dirname(path.resolve(tsconfigPath));
    const baseUrl = this.tsconfig.compilerOptions?.baseUrl ?? "./";
    this.rootDir = path.resolve(rel, baseUrl);
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
    const typeToUse = getFinalArrayType(asType).getApparentType();
    const literalType = asPrimitiveTypeName(typeToUse);
    let literal = typeToUse.getApparentType().getLiteralValue() as LiteralValue;
    const structure = node.getStructure();
    // TODO: make this work better
    if (isArray && structure.initializer) {
      try {
        // have to call eval like this because esbuild freaks out when I use eval the normal way
        literal = (0, eval)(structure.initializer.toString());
      } catch (e) {
        const arrayTypes = typeToUse.getUnionTypes();
        if (arrayTypes.every((e) => e.isLiteral())) {
          literal = arrayTypes.map((t) => t.getLiteralValue() as LiteralValue);
        }
      }
    }
    if (!node.isExported() || !literalType) {
      return;
    }
    if (!literalType) {
      console.warn(`Invalid literal type (${name})`);
      return;
    }
    const arrayDepth = getArrayDepth(asType);
    const varStatement = node.getVariableStatement();
    const comments = varStatement ? getComments(varStatement) : undefined;
    constType.addConst(
      name,
      literalType,
      isArray,
      arrayDepth,
      literal,
      comments
    );
    console.debug(
      `Found declaration: ${name} = ${JSON.stringify(
        literal
      )}, with comments "${comments}"`
    );
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
  private getTsConfig(tsconfigPath: string): TsConfigJson {
    const tsconfigRaw = readFileSync(tsconfigPath, { encoding: "utf-8" });
    const tsconfig: TsConfigJson = JSON.parse(tsconfigRaw);
    const rel = path.dirname(path.resolve(tsconfigPath));
    if (tsconfig.extends) {
      const extendedPath = path.resolve(rel, tsconfig.extends);
      const extendedFrom = this.getTsConfig(extendedPath);
      const merged = deepmerge(extendedFrom, tsconfig);
      return merged;
    }
    return tsconfig;
  }
  private isInIgnoreDir(fp: string) {
    const relative = path.relative(this.rootDir, fp);
    const exclude = [...(this.tsconfig.exclude ?? [])];
    if (!this.includeNodeModules && relative.startsWith("node_modules")) {
      return true;
    }
    for (const excludeGlob of exclude) {
      const matches = minimatch(relative, excludeGlob, {});
      if (matches) {
        return true;
      }
    }

    return false;
  }
  private getNodesToInclude<T extends ExportDeclaration | ImportDeclaration>(
    node: T
  ): string[] | undefined {
    let specs: Array<ExportSpecifier | ImportSpecifier> = [];
    if (node.getKind() === SyntaxKind.ImportDeclaration) {
      specs = node
        .asKindOrThrow(SyntaxKind.ImportDeclaration)
        .getNamedImports();
    } else if (node.getKind() === SyntaxKind.ExportDeclaration) {
      specs = node
        .asKindOrThrow(SyntaxKind.ExportDeclaration)
        .getNamedExports();
    }
    if (!specs.length) {
      return undefined;
    }
    return specs.map((e: ExportSpecifier | ImportSpecifier) => e.getName());
  }
  private traverseNode(node: Node, nodesToInclude?: string[]) {
    node.forEachDescendant((node) => {
      const kind = node.getKind();
      switch (kind) {
        case SyntaxKind.TypeAliasDeclaration:
        case SyntaxKind.InterfaceDeclaration:
        case SyntaxKind.EnumDeclaration: {
          const asKind = node.asKindOrThrow(kind);
          const explicitlyIncluded =
            nodesToInclude && nodesToInclude.includes(asKind.getName());
          if (
            nodesToInclude &&
            nodesToInclude.length > 0 &&
            !explicitlyIncluded
          ) {
            return;
          }
          this.processDeclaration(asKind);
          break;
        }
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
          const asKind = node.asKindOrThrow(kind);
          const sourceFile = asKind.getModuleSpecifierSourceFile();
          if (!sourceFile) {
            return;
          }
          const fp = sourceFile.getFilePath();
          const inIgnoreDir = this.isInIgnoreDir(fp);
          if (inIgnoreDir) {
            this.sourceFilesProcessed.add(fp);
            console.debug(`Ignoring file ${fp}, as it is excluded...`);
            return;
          }
          if (!this.sourceFilesProcessed.has(fp)) {
            this.sourceFilesProcessed.add(fp);
            const nodes = this.getNodesToInclude(asKind);
            this.traverseNode(sourceFile, nodes);
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
