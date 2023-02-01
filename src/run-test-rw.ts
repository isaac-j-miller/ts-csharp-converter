import { NameType, CasingConvention } from "./converter/name-mapper";
import { convertTypescriptToCSharp } from "./index";
import { CSharpConverterConfig } from "./types";

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
      // "InternalGlobalFieldNames",
      // "ReportFields",
      // "ReportConfiguration",
      // "TokenMap",
      // "ReportMetadata",
      // "JobSummary",
      // "DataFetchRequest",
      // "DataBindingRequest",
      // "DataFetchRequestInternal",
      // "DataBindingRequestInternal",
      // "ReportRequestInternal",
      // "PassThroughMap",
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
      // "Denominalize",
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
      // "PdfOrXlsxInternalGlobalOptionsFieldNames",
      // "JobReports",
      // "Options",
      // "LogEmitter",
      "Services",
      "RwCluster",
      "ReportService",
      "ConfigResponse",
      // "ReportTypeSwitch",
      "JobStoreDbMethods",
      "JobStoreSdk",
      "JobStoreOptions",
      "DynamoItemInput",
      // "RqcAppConfig",
      // "RqcAppConfigGeneric",
      // "ReportManifest",
      // "ReportManifestGeneric",
      // "ReportBase",
      // "ReportVisibilityCriteria",
      // "ParsedEntityDataKey",
      // "JobStatusByUser",
      // "UpdateRecord",
      // "EntityDataRecord",
      // "EntityDataRecords",
      // "ReportDataRecord",
      // "ReportDataRecords",
      // "JobDataDetails",
      // "JobStoreRecordBase",
      // "JobDataRecordBase",
      // "JobDataKey",
      // "JobDataStatus",
      // "JobDataStatuses",
      // "JobDataUserId",
      // "JobDataDetails",
      // "JobStatusInfo",
      "SchemaNameParam",
      // "CueJobDetails",
      // "ClientJobRequestGeneric",
      // "ReportOptions",
      // "PdfReportConfiguration",
      // "ReportManifestInternal",
      // "UpdateJobDataRecord",
      // "JobDataCreatedDate",
      // "UploadSchemaParams",
      // "GetDynamoBackupParams",
      // "RestoreDynamoTableParams",
      // "ReportQueueParams",
      // "GlobalOptionWithLayout",
      // "GlobalOptions",
      // "CancelJobRequest",
      // "CancelJobResponse",
      // "GenerateResponse",
      // "Cookies",
      // "FormFieldTypes",
    ]),
    writeCsProjFile: true,
  };
  await convertTypescriptToCSharp(config);
};

void main();
