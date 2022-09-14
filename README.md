# C# Converter

This project seeks to generate generic C# dataclasses from typescript types, interfaces, tuples,
etc. It traverses the AST to create a registry of types, and then renders those types as their
closest C# equivalents.

# Build

To build this project, you need `node`, version 16 or higher, as well as `pnpm`.  
Once you have `node` and `pnpm` installed, install the dependencies with `pnpm install`. Then, you
can build the project using `pnpm build`. There are a few validation scripts in `package.json`:

- `pnpm test(-inspect)`: run jest tests
- `pnpm lint`: run linting
- `pnpm prettier-check`: run prettier validation
- `pnpm check-all`: run all validation checks
- `pnpm check-ts`: check typescript Additionally, there are some other scripts:
- `pnpm run-test(-inspect)`: generate c# code from types in `src/test`
- `pnpm run-test-rw(-inspect)`: generate c# file from report-wrangler repo. Currently doesn't work
  anywhere except on my personal machine. TODO: fix this.
- `pnpm build`: build the `cli.js` and `index.js` scripts

# Usage

To install this package, run `pnpm add -D @costar/ts-csharp-converter` You can use it from the cli
or by importing it as a module. Example usage from the cli:

`pnpm ts-csharp-converter --entrypoint packages/report-core/src/dotnet.index.ts --tsconfig-path ./tsconfig-global.json --output-file ./generated/dotnet/ReportWrangler/ReportWrangler.cs --output-namespace ReportWrangler`

You can run `pnpm ts-csharp-converter --help` to view a list of available cli arguments.

Example usage as a module:

```typescript
import {
  NameType,
  CasingConvention,
  convertTypescriptToCSharp,
  CSharpConverterConfig,
} from "@costar/ts-csharp-converter";
const main = async () => {
  const config: CSharpConverterConfig = {
    entrypoint: "/Users/imiller/code/report-wrangler/packages/report-core/src/dotnet.index.ts",
    tsconfigPath: "/Users/imiller/code/report-wrangler/tsconfig-global.json",
    outputDir: "./tmp",
    namespaceName: "ReportWrangler",
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
    defaultNumericType: "int",
    // these types can be ignored because they aren't used anywhere and just take forever
    ignoreClasses: new Set([
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
      "DynamoDbAdapter",
      "DynamoDbAdapterOptions",
      "Cache",
      "ConfigByEnv",
      "RuntimeConfig",
      "ParsedLoggable",
      "Transform",
      "TimerCotr",
      "ReportCallback",
      "FilterCallbackPredicate",
      "ReportRequestDetails",
      "SchemaType",
      "GetS3ObjectResponseHeaders",
      "ValuePropOf",
      "RuntimeConfig",
      "TLambdaEvent",
      "Loggable",
      "JobQueryOptions",
      "FunctionMap",
      "AsProperties",
      "Loggable",
      "Logger",
      "EventLogger",
      "SyncLogWriter",
      "AsyncLogWriter",
      "LogFilter",
      "ArrayOneOrMore",
      "NonFunctionPropertyNames",
      "PopulatedMap",
      "BackoffConfig",
      "SqsConsumerConfig",
      "AwsHttpOptions",
      "AwsServiceGlobalOptions",
      "FunctionMap",
      "BuildConfig",
      "SecretsConfig",
      "SecretsConfigPromise",
      "RuntimeConfig",
      "ServerWindow",
      "ClientOptions",
      "ReportWizardOptions",
      "AdminOptions",
      "I18nMessageType",
      "SsrClientConfig",
      "InvocationContextMenuOption",
      "InvocationContextOptions",
      "FeatureToggles",
      "RandomStringOptions",
      "Context",
      "NodeVisited",
      "S3Request",
      "S3PutRequest",
      "S3PutObjectRequest",
      "S3DeleteObjectRequest",
      "S3GetObjectRequest",
      "S3HeadObjectRequest",
      "S3TreeParams",
      "S3ArtifactResponse",
      "S3Tree",
      "OpenApiSchemas",
      "S3Options",
      "SampleRequestBody",
      "Services",
      "RwCluster",
      "ReportService",
      "ConfigResponse",
      "JobStoreDbMethods",
      "JobStoreSdk",
      "JobStoreOptions",
      "DynamoItemInput",
      "SchemaNameParam",
    ]),
  };
  await convertTypescriptToCSharp(config);
};
void main();
```

The log level is set by the `LOG_LEVEL` environment variable, which can be 0,1,2,3 or `DEBUG`,
`INFO`, `WARN`, or `ERROR`.

# TODO:

- make default number type config driven
- allow specifying c# numeric types better (decimal, int, long, etc)
- clean up messy code (constructor args, etc)
- evaluate const declarations to use local variables
- move UnionX and UnionXSerializer classes to separate namespace
- sort items in namespace
- more unit tests using generated code (including:
  - serialization/deserialization of union and template types
  - serialization/deserialization of normal types
  - usage of union types )
