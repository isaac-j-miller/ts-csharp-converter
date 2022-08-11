import { NameType, CasingConvention } from "./converter/name-mapper";
import { convertTypescriptToCSharp } from "./index";

const main = async () => {
  await convertTypescriptToCSharp(
    "/Users/imiller/code/report-wrangler/packages/report-core/src/dotnet.index.ts",
    "/Users/imiller/code/report-wrangler/tsconfig-global.json",
    "./tmp/ReportWrangler.cs",
    "ReportWrangler",
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
    new Set([
      "JsonSchema",
      "DeepPartial",
      "RwContext",
      "SpanWrapped",
      "Headers",
      "SchemaProvider",
      "TableWriteRequest",
      "DynamoDbAPI",
      "AsyncOptions",
      "SpanWrapped",
      "StackItem",
      "TracingContextUnpackaged",
      "TracingContextPackaged",
      "NodeEnv",
      "Resources",
      "Timer",
      "WrapperData",
      "DbAdapter",
      "Cache",
      "ConfigByEnv",
      "S3Tree",
      "RuntimeConfig",
      "ParsedLoggable",
    ])
  );
};

void main();
