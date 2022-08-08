import "source-map-support/register"
import { ArgumentParser } from "argparse";
import { convertTypescriptToCSharp } from ".";
import {
  CasingConvention,
  NameMapperConfig,
  NameType,
} from "./converter/name-mapper";
import { toCasingConvention } from "./converter/name-mapper/util";

type RunConfigBase = {
  entrypoint: string;
  tsconfigPath: string;
  outputFile: string;
  namespace: string;
};

type RunConfig = RunConfigBase & {
  classNameSourceCasing?: string;
  classNameTargetCasing?: string;
  propertyNameSourceCasing?: string;
  propertyNameTargetCasing?: string;
  enumMemberSourceCasing?: string;
  enumMemberTargetCasing?: string;
};

type CompleteConfig = RunConfigBase & {
  nameMapperConfig: NameMapperConfig;
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
argParser.add_argument("--class-name-source-casing", {
  required: false,
  dest: "classNameSourceCasing",
});
argParser.add_argument("--class-name-target-casing", {
  required: false,
  dest: "classNameTargetCasing",
});
argParser.add_argument("--property-name-source-casing", {
  required: false,
  dest: "propertyNameSourceCasing",
});
argParser.add_argument("--property-name-target-casing", {
  required: false,
  dest: "propertyNameTargetCasing",
});
argParser.add_argument("--enum-member-source-casing", {
  required: false,
  dest: "enumNameSourceCasing",
});
argParser.add_argument("--enum-member-target-casing", {
  required: false,
  dest: "enumNameTargetCasing",
});
const runConfigToCompleteRunConfig = (c: RunConfig): CompleteConfig => {
  const {
    classNameSourceCasing,
    classNameTargetCasing,
    propertyNameSourceCasing,
    propertyNameTargetCasing,
    enumMemberSourceCasing: enumNameSourceCasing,
    enumMemberTargetCasing: enumNameTargetCasing,
    ...rest
  } = c;
  const nameMapperConfig: NameMapperConfig = {
    transforms: {
      [NameType.DeclarationName]: {
        input:
          toCasingConvention(classNameSourceCasing) ??
          CasingConvention.PascalCase,
        output:
          toCasingConvention(classNameTargetCasing) ??
          CasingConvention.PascalCase,
      },
      [NameType.PropertyName]: {
        input:
          toCasingConvention(propertyNameSourceCasing) ??
          CasingConvention.CamelCase,
        output:
          toCasingConvention(propertyNameTargetCasing) ??
          CasingConvention.PascalCase,
      },
      [NameType.EnumMember]: {
        input:
          toCasingConvention(enumNameSourceCasing) ??
          CasingConvention.CamelCase,
        output:
          toCasingConvention(enumNameTargetCasing) ??
          CasingConvention.PascalCase,
      },
    },
  };
  return {
    ...rest,
    nameMapperConfig,
  };
};
const getRunConfig = () => {
  const args: RunConfig = argParser.parse_args(process.argv);
  return runConfigToCompleteRunConfig(args);
};

async function main() {
  const { entrypoint, tsconfigPath, outputFile, namespace, nameMapperConfig } =
    getRunConfig();
  await convertTypescriptToCSharp(
    entrypoint,
    tsconfigPath,
    outputFile,
    namespace,
    nameMapperConfig
  );
}

void main();
