import "source-map-support/register";
import { ArgumentParser } from "argparse";
import { convertTypescriptToCSharp } from ".";
import { CasingConvention, NameMapperConfig, NameType } from "./converter/name-mapper";
import { toCasingConvention } from "./converter/name-mapper/util";
import { CSharpConverterConfig } from "./types";
import { isCSharpNumericType } from "./converter/util";
import { jsDocNumberTypes } from "./converter/consts";

type CliRunConfig = {
  defaultNumericType: string;
  entrypoint: string;
  tsconfigPath: string;
  outputDir: string;
  namespaceName: string;
  classNameTargetCasing?: string;
  propertyNameTargetCasing?: string;
  enumMemberTargetCasing?: string;
  includeNodeModules?: boolean;
  ignoreClasses?: string;
  writeCsProjFile: boolean;
  baseNamespace?: string;
};

const argParser = new ArgumentParser();
argParser.add_argument("--entrypoint", {
  required: true,
  dest: "entrypoint",
});
argParser.add_argument("--tsconfig-path", {
  required: true,
  dest: "tsconfigPath",
});
argParser.add_argument("--output-dir", {
  required: true,
  dest: "outputDir",
});
argParser.add_argument("--output-namespace-base", {
  required: false,
  dest: "baseNamespace",
});
argParser.add_argument("--output-namespace", {
  required: true,
  dest: "namespaceName",
});
argParser.add_argument("--class-name-target-casing", {
  required: false,
  dest: "classNameTargetCasing",
});
argParser.add_argument("--property-name-target-casing", {
  required: false,
  dest: "propertyNameTargetCasing",
});
argParser.add_argument("--enum-member-target-casing", {
  required: false,
  dest: "enumNameTargetCasing",
});
argParser.add_argument("--include-node-modules", {
  required: false,
  action: "store_true",
  default: false,
  dest: "includeNodeModules",
});
argParser.add_argument("--write-csproj", {
  required: false,
  action: "store_true",
  default: false,
  dest: "writeCsProjFile",
});
argParser.add_argument("--ignore", {
  required: false,
  dest: "ignoreClasses",
});
const runConfigToCompleteRunConfig = (c: CliRunConfig): CSharpConverterConfig => {
  const {
    classNameTargetCasing,
    propertyNameTargetCasing,
    enumMemberTargetCasing: enumNameTargetCasing,
    includeNodeModules,
    ignoreClasses,
    defaultNumericType,
    ...rest
  } = c;
  const ignoreClassesSet = new Set(ignoreClasses ? ignoreClasses.split(",") : []);
  const nameMappingConfig: NameMapperConfig = {
    transforms: {
      [NameType.DeclarationName]: {
        output: toCasingConvention(classNameTargetCasing) ?? CasingConvention.PascalCase,
      },
      [NameType.PropertyName]: {
        output: toCasingConvention(propertyNameTargetCasing) ?? CasingConvention.PascalCase,
      },
      [NameType.EnumMember]: {
        output: toCasingConvention(enumNameTargetCasing) ?? CasingConvention.PascalCase,
      },
    },
  };
  const numericTypeToUse = defaultNumericType ?? "int";
  const isNumericTypeValid = isCSharpNumericType(numericTypeToUse);
  const defaultNumericTypeValidated = isNumericTypeValid ? numericTypeToUse : undefined;
  if (!defaultNumericTypeValidated) {
    throw new Error(
      `Invalid numeric type: ${defaultNumericType}. Expected one of ${jsDocNumberTypes}`
    );
  }
  return {
    ...rest,
    nameMappingConfig,
    defaultNumericType: defaultNumericTypeValidated,
    includeNodeModules: !!includeNodeModules,
    ignoreClasses: ignoreClassesSet,
  };
};
const getRunConfig = () => {
  const [knownArgs] = argParser.parse_known_args(process.argv);
  const args: CliRunConfig = knownArgs;

  return runConfigToCompleteRunConfig(args);
};

async function main() {
  const config = getRunConfig();
  await convertTypescriptToCSharp(config);
}

void main();
