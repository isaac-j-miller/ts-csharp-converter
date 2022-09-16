import { readFileSync } from "fs";
import path from "path";
import { TsConfigJson } from "type-fest";
import minimatch from "minimatch";
import deepmerge from "deepmerge";
import {
  AsExpression,
  EnumDeclaration,
  ExportDeclaration,
  ExportSpecifier,
  Expression,
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
  VariableStatement,
} from "ts-morph";
import { TypeRegistry } from "src/converter/registry";
import { IRegistryType, LiteralValue } from "src/converter/types";
import { TypeFactory } from "src/converter/type-factory";
import {
  asPrimitiveTypeName,
  ConfigDependentUtils,
  getArrayDepth,
  getComments,
  getFinalArrayType,
} from "src/converter/util";
import { ILogger } from "src/common/logging/types";
import { LoggerFactory } from "src/common/logging/factory";
import { NameMapper } from "src/converter/name-mapper";

type DeclarationType = EnumDeclaration | InterfaceDeclaration | TypeAliasDeclaration;

function getExpr(node: AsExpression): Expression {
  const expr = node.getExpression();
  if (expr.asKind(SyntaxKind.AsExpression)) {
    return getExpr(expr.asKindOrThrow(SyntaxKind.AsExpression));
  }
  return expr;
}

function getFinalExpression(statement?: VariableStatement): Expression | undefined {
  if (!statement) return;
  const dec = statement.getDeclarations()[0];
  if (!dec) return;
  const init = dec.getInitializer();
  if (!init) return;
  const asExpr = init.asKind(SyntaxKind.AsExpression);
  if (asExpr) {
    return getExpr(asExpr);
  }
  return init;
}
export class AstTraverser {
  private project: Project;
  private entrySourceFile: SourceFile;
  private registry: TypeRegistry;
  private typeFactory: TypeFactory;
  private tsconfig: TsConfigJson;
  private sourceFilesProcessed: Set<string>;
  private rootDir: string;
  private logger: ILogger;
  constructor(
    entrypoint: string,
    tsconfigPath: string,
    private includeNodeModules: boolean = false,
    private ignoreClasses: Set<string>,
    utils: ConfigDependentUtils
  ) {
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
    });
    this.entrySourceFile = this.project.getSourceFileOrThrow(entrypoint);
    this.registry = new TypeRegistry(utils, ignoreClasses);
    this.typeFactory = new TypeFactory(utils, this.registry, ignoreClasses);
    this.sourceFilesProcessed = new Set<string>();
    this.tsconfig = this.getTsConfig(tsconfigPath);
    const rel = path.dirname(path.resolve(tsconfigPath));
    const baseUrl = this.tsconfig.compilerOptions?.baseUrl ?? "./";
    this.rootDir = path.resolve(rel, baseUrl);
    this.logger = LoggerFactory.getLogger("ast-traverser");
  }
  private processDeclaration<T extends DeclarationType>(node: T, internal: boolean) {
    const name = node.getName();
    const asType = node.getType();
    this.logger.trace(`Processing declaration for ${name}`);
    return this.createType(name, node, asType, internal);
  }
  private processVariableDeclaration(node: VariableDeclaration) {
    const name = node.getName();
    const asType = node.getType();
    const isArray = asType.isArray();
    const constType = this.registry.getConstValueType();
    let literal = asType.getLiteralValue() as LiteralValue;
    const varStatement = node.getVariableStatement();
    const expr = getFinalExpression(varStatement);
    if (!expr) {
      return;
    }
    const typeToUse = getFinalArrayType(expr.getType()).getApparentType();
    const literalType = asPrimitiveTypeName(typeToUse);
    if (typeToUse.isUnion()) {
      // if it is a union, TODO: create a type and make variable declaration that references that type
      return;
    }
    const initializer = expr.getText(false);
    if (initializer && !literal) {
      try {
        // have to call eval like this because esbuild freaks out when I use eval the normal way
        // eslint-disable-next-line no-eval
        literal = (0, eval)(initializer.toString());
      } catch (e) {
        if (isArray) {
          const arrayTypes = typeToUse.getUnionTypes();
          if (arrayTypes.every(err => err.isLiteral())) {
            literal = arrayTypes.map(t => t.getLiteralValue() as LiteralValue);
          }
        }
      }
    }
    if (!name || !(literalType || literal) || !node.isExported()) {
      return;
    }
    this.logger.trace(`Processing variable declaration for ${name}`);
    if (!literalType) {
      return;
    }
    const arrayDepth = getArrayDepth(asType);
    let comments = varStatement ? getComments(varStatement) : undefined;
    if (literal === undefined) {
      literal = null;
      const comment = "Unable to resolve value for type";
      this.logger.warn(
        `${comment} for declaration ${name} in ${node.getSourceFile().getFilePath()}`
      );
      comments = comments ? comments + `\n// ${comment}` : "// " + comment;
    }
    constType.addConst(name, literalType, isArray, arrayDepth, literal, comments);
  }
  private createType(name: string, node: Node, asType: Type, internal: boolean): IRegistryType {
    const options = { name, node, type: asType, internal, level: 0, descendsFromPublic: false };
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
      specs = [];
    } else if (node.getKind() === SyntaxKind.ExportDeclaration) {
      specs = node.asKindOrThrow(SyntaxKind.ExportDeclaration).getNamedExports();
      if (!specs.length) {
        return undefined;
      }
      // TODO: handle wildcard export
    }
    return specs.map((e: ExportSpecifier | ImportSpecifier) => e.getName());
  }
  private traverseNode(node: Node, isFromRoot: boolean, nodesToInclude?: string[]) {
    this.logger.trace(
      `Traversing node ${node.getSymbol()?.getName()}${
        nodesToInclude ? `, including ${nodesToInclude}` : ""
      }`
    );
    node.forEachDescendant(nd => {
      const kind = nd.getKind();
      const isRoot = nd.getSourceFile() === this.entrySourceFile;
      const isRootOrFromRoot = isFromRoot || isRoot;
      switch (kind) {
        case SyntaxKind.VariableDeclaration:
        case SyntaxKind.TypeAliasDeclaration:
        case SyntaxKind.InterfaceDeclaration:
        case SyntaxKind.EnumDeclaration: {
          const asKind = nd.asKindOrThrow(kind);
          const isPublic =
            isRootOrFromRoot && (!nodesToInclude || nodesToInclude.includes(asKind.getName()));
          const explicitlyIncluded =
            isRootOrFromRoot || (nodesToInclude && nodesToInclude.includes(asKind.getName()));
          const explicitlyExcluded =
            (!!nodesToInclude && nodesToInclude.length > 0 && !explicitlyIncluded) ||
            this.ignoreClasses.has(asKind.getName());
          if (explicitlyExcluded) return;
          if (kind === SyntaxKind.VariableDeclaration) {
            if (isRootOrFromRoot && asKind.isExported()) {
              this.processVariableDeclaration(nd.asKindOrThrow(kind));
            }
          } else {
            this.processDeclaration(
              asKind as TypeAliasDeclaration | InterfaceDeclaration | EnumDeclaration,
              !isPublic
            );
          }
          break;
        }
        case SyntaxKind.ImportDeclaration:
        case SyntaxKind.ExportDeclaration: {
          const asKind = nd.asKindOrThrow(kind);
          const sourceFile = asKind.getModuleSpecifierSourceFile();
          if (!sourceFile) {
            this.logger.trace(
              `Ignoring export/import declaration in ${nd
                .getSourceFile()
                .getFilePath()} with text ${asKind.getText()} because source file was not found`
            );
            return;
          }
          const fp = sourceFile.getFilePath();
          const inIgnoreDir = this.isInIgnoreDir(fp);
          if (inIgnoreDir) {
            this.sourceFilesProcessed.add(fp);
            this.logger.trace(`Ignoring file ${fp} because it is excluded`);
            return;
          }
          if (isRoot || !this.sourceFilesProcessed.has(fp)) {
            this.sourceFilesProcessed.add(fp);
            const nodes = this.getNodesToInclude(asKind);
            this.traverseNode(sourceFile, isRoot, nodes);
          } else {
            this.logger.trace(`Ignoring ${fp} because it has already been processed`);
          }
          break;
        }
        default:
          break;
      }
    });
  }
  traverse() {
    this.traverseNode(this.entrySourceFile, true);
  }
  createNamespace(name: string, mapper: NameMapper) {
    return this.registry.toNamespace(name, mapper);
  }
}
