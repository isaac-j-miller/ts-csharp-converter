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
    false,
    new Set()
  );
};

void main();
