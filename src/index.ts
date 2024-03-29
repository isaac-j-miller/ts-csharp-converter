import ejs from "ejs";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join, resolve } from "path";
import { AstTraverser } from "./ast";
import { CasingConvention, NameMapperConfig } from "./converter/name-mapper";
import { NameMapper } from "./converter/name-mapper/mapper";
import { ConfigDependentUtils } from "./converter/util";
import { CSharpConverterConfig } from "./types";

export { NameType } from "./converter/name-mapper/types";
export { CasingConvention, NameMapperConfig };

export async function convertTypescriptToCSharp(config: CSharpConverterConfig): Promise<void> {
  const {
    entrypoint,
    tsconfigPath,
    outputDir,
    namespaceName: finalNamespaceName,
    nameMappingConfig,
    includeNodeModules,
    ignoreClasses,
    baseNamespace,
    writeCsProjFile,
  } = config;
  const mapper = new NameMapper(nameMappingConfig);
  const utils = new ConfigDependentUtils(config);
  const traverser = new AstTraverser(
    entrypoint,
    tsconfigPath,
    includeNodeModules,
    ignoreClasses,
    utils
  );
  traverser.traverse();
  const namespaceName = baseNamespace
    ? `${baseNamespace}.${finalNamespaceName}`
    : finalNamespaceName;
  const ns = traverser.createNamespace(namespaceName, mapper);
  const serializedNamespace = ns.serialize(mapper);
  const dir = join(resolve(outputDir), namespaceName);
  await mkdir(dir, {
    recursive: true,
  });
  const outputFile = join(dir, `${namespaceName}.cs`);
  const isBundled = __dirname.includes("node_modules");
  const resourcesPath = isBundled ? join(__dirname, "resources") : join(__dirname, "../resources");
  const serializationUtilsPath = join(resourcesPath, "SerializationUtils.cs");
  if (writeCsProjFile) {
    const csprojFilepath = join(resourcesPath, "csproj.ejs");
    const csprojOutputPath = join(dir, `${namespaceName}.csproj`);
    const csproj = await readFile(csprojFilepath, { encoding: "utf-8" });
    const templated = await ejs.render(csproj, { namespaceName }, { async: true });
    await writeFile(csprojOutputPath, templated, {
      encoding: "utf-8",
    });
  }
  const serializationUtilsOutputPath = join(dir, "Serialization.cs");
  const serializationUtils = await readFile(serializationUtilsPath, { encoding: "utf-8" });
  await writeFile(outputFile, serializedNamespace, {
    encoding: "utf-8",
  });
  await writeFile(serializationUtilsOutputPath, serializationUtils, {
    encoding: "utf-8",
  });
}
