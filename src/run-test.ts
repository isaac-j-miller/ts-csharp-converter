import { NameType, CasingConvention } from "./converter/name-mapper";
import { convertTypescriptToCSharp } from "./index";

const main = async () => {
  await convertTypescriptToCSharp(
    "./src/test/index.ts",
    "./tsconfig.json",
    "./tmp/Output.cs",
    "TestNamespace",
    {
      transforms: {
        [NameType.DeclarationName]: {
          input: CasingConvention.PascalCase,
          output: CasingConvention.PascalCase,
        },
        [NameType.PropertyName]: {
          input: CasingConvention.CamelCase,
          output: CasingConvention.PascalCase,
        },
        [NameType.EnumMember]: {
          input: CasingConvention.CamelCase,
          output: CasingConvention.PascalCase,
        },
      },
    },
    false,
    new Set()
  );
};

void main();
