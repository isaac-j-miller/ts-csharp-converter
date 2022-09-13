import ejs from "ejs";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join, resolve } from "path";
import { AstTraverser } from "./ast";
import { CasingConvention, NameMapperConfig } from "./converter/name-mapper";
import { NameMapper } from "./converter/name-mapper/mapper";

export { NameType } from "./converter/name-mapper/types";
export { CasingConvention, NameMapperConfig };

export async function convertTypescriptToCSharp(
  entrypoint: string,
  tsconfigPath: string,
  outputDir: string,
  namespaceName: string,
  config: NameMapperConfig,
  includeNodeModules: boolean,
  ignoreClasses: Set<string>
): Promise<void> {
  const mapper = new NameMapper(config);
  const traverser = new AstTraverser(entrypoint, tsconfigPath, includeNodeModules, ignoreClasses);
  traverser.traverse();
  const ns = traverser.createNamespace(namespaceName, mapper);
  const serializedNamespace = ns.serialize(mapper);
  const dir = join(resolve(outputDir), namespaceName);
  await mkdir(dir, {
    recursive: true,
  });
  const outputFile = join(dir, `${namespaceName}.cs`);
  const serializationUtilsPath = join(__dirname, "csharp/Source/SerializationUtils.cs");
  const csprojFilepath = join(__dirname, "csharp/Source/csproj.ejs");
  const serializationUtilsOutputPath = join(dir, "SerializationUtils.cs");
  const csprojOutputPath = join(dir, `${namespaceName}.csproj`);
  const serializationUtils = await readFile(serializationUtilsPath, { encoding: "utf-8" });
  await writeFile(outputFile, serializedNamespace, {
    encoding: "utf-8",
  });
  await writeFile(serializationUtilsOutputPath, serializationUtils, {
    encoding: "utf-8",
  });
  const csproj = await readFile(csprojFilepath, { encoding: "utf-8" });
  const templated = await ejs.render(csproj, { namespaceName }, { async: true });
  await writeFile(csprojOutputPath, templated, {
    encoding: "utf-8",
  });
}
