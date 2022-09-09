import { mkdir, writeFile, readFile } from "fs/promises";
import { dirname, join } from "path";
import { AstTraverser } from "./ast";
import { CasingConvention, NameMapperConfig } from "./converter/name-mapper";
import { NameMapper } from "./converter/name-mapper/mapper";

export { NameType } from "./converter/name-mapper/types";
export { CasingConvention, NameMapperConfig };

export async function convertTypescriptToCSharp(
  entrypoint: string,
  tsconfigPath: string,
  outputPath: string,
  namespaceName: string,
  config: NameMapperConfig,
  includeNodeModules: boolean,
  ignoreClasses: Set<string>
): Promise<void> {
  const mapper = new NameMapper(config);
  const traverser = new AstTraverser(entrypoint, tsconfigPath, includeNodeModules, ignoreClasses);
  traverser.traverse();
  const ns = traverser.createNamespace(namespaceName, mapper);
  const str = ns.serialize(mapper);
  const dir = dirname(outputPath);
  await mkdir(dir, {
    recursive: true,
  });
  const serializationFilePath = join(__dirname, "csharp/Source/SerializationUtils.cs");
  const serializationUtilsPath = join(dir, "SerializationUtils.cs");
  const serializationUtils = await readFile(serializationFilePath, { encoding: "utf-8" });
  await writeFile(outputPath, str, {
    encoding: "utf-8",
  });
  await writeFile(serializationUtilsPath, serializationUtils, {
    encoding: "utf-8",
  });
}
