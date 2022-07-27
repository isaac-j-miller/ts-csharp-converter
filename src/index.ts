import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { AstTraverser } from "./ast";

export async function convertTypescriptToCSharp(
  entrypoint: string,
  tsconfigPath: string,
  outputPath: string,
  namespaceName: string
): Promise<void> {
  const traverser = new AstTraverser(entrypoint, tsconfigPath);
  traverser.traverse();
  const ns = traverser.createNamespace(namespaceName);
  const str = ns.serialize();
  const dir = dirname(outputPath);
  await mkdir(dir, {
    recursive: true,
  });
  await writeFile(outputPath, str, {
    encoding: "utf-8",
  });
}
