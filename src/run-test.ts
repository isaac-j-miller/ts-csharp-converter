import { NameType, CasingConvention } from "./converter/name-mapper";
import { convertTypescriptToCSharp } from "./index";
import { CSharpConverterConfig } from "./types";

const main = async () => {
  const config: CSharpConverterConfig = {
    entrypoint: "./src/test/index.ts",
    tsconfigPath: "./tsconfig.json",
    outputDir: "./tmp",
    namespaceName: "TestNamespace",
    nameMappingConfig: {
      transforms: {
        [NameType.DeclarationName]: {
          output: CasingConvention.PascalCase,
        },
        [NameType.PropertyName]: {
          output: CasingConvention.PascalCase,
        },
        [NameType.EnumMember]: {
          output: CasingConvention.PascalCase,
        },
      },
    },
    includeNodeModules: false,
    ignoreClasses: new Set(),
    defaultNumericType: "int",
  };
  await convertTypescriptToCSharp(config);
};

void main();
