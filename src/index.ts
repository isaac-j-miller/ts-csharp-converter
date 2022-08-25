import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
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
  const ns = traverser.createNamespace(namespaceName);
  const str = ns.serialize(mapper);
  const dir = dirname(outputPath);
  await mkdir(dir, {
    recursive: true,
  });
  await writeFile(outputPath, str, {
    encoding: "utf-8",
  });
}
