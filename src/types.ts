import type { NameMapperConfig } from "./converter/name-mapper/types";
import type { JsDocNumberType } from "./converter/types";

export type CSharpConverterConfig = {
  entrypoint: string;
  tsconfigPath: string;
  outputDir: string;
  namespaceName: string;
  nameMappingConfig: NameMapperConfig;
  includeNodeModules: boolean;
  ignoreClasses: Set<string>;
  defaultNumericType: JsDocNumberType;
  baseNamespace?: string;
  writeCsProjFile: boolean;
};
