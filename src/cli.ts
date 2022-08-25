import "source-map-support/register";
import { ArgumentParser } from "argparse";
import { convertTypescriptToCSharp } from ".";
import { CasingConvention, NameMapperConfig, NameType } from "./converter/name-mapper";
import { toCasingConvention } from "./converter/name-mapper/util";

type RunConfigBase = {
  entrypoint: string;
  tsconfigPath: string;
  outputFile: string;
  namespace: string;
};

type RunConfig = RunConfigBase & {
  classNameTargetCasing?: string;
  propertyNameTargetCasing?: string;
  enumMemberTargetCasing?: string;
  includeNodeModules?: boolean;
  ignoreClasses?: string;
};

type CompleteConfig = RunConfigBase & {
  nameMapperConfig: NameMapperConfig;
  includeNodeModules: boolean;
  ignoreClasses: Set<string>;
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
argParser.add_argument("--output-file", {
  required: true,
  dest: "outputFile",
});
argParser.add_argument("--output-namespace", {
  required: true,
  dest: "namespace",
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
argParser.add_argument("--ignore", {
  required: false,
  dest: "ignoreClasses",
});
const runConfigToCompleteRunConfig = (c: RunConfig): CompleteConfig => {
  const {
    classNameTargetCasing,
    propertyNameTargetCasing,
    enumMemberTargetCasing: enumNameTargetCasing,
    includeNodeModules,
    ignoreClasses,
    ...rest
  } = c;
  const ignoreClassesSet = new Set(ignoreClasses ? ignoreClasses.split(",") : []);
  const nameMapperConfig: NameMapperConfig = {
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
  return {
    ...rest,
    nameMapperConfig,
    includeNodeModules: !!includeNodeModules,
    ignoreClasses: ignoreClassesSet,
  };
};
const getRunConfig = () => {
  const [knownArgs] = argParser.parse_known_args(process.argv);
  const args: RunConfig = knownArgs;

  return runConfigToCompleteRunConfig(args);
};

async function main() {
  const {
    entrypoint,
    tsconfigPath,
    outputFile,
    namespace,
    nameMapperConfig,
    includeNodeModules,
    ignoreClasses,
  } = getRunConfig();
  await convertTypescriptToCSharp(
    entrypoint,
    tsconfigPath,
    outputFile,
    namespace,
    nameMapperConfig,
    includeNodeModules,
    ignoreClasses
  );
}

void main();
