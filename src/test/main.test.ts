import { AstTraverser } from "src/ast";
import { CasingConvention, NameMapper, NameType } from "src/converter/name-mapper";
import { ConfigDependentUtils } from "src/converter/util";
import { CSharpConverterConfig } from "src/types";

describe("snapshot", () => {
  it("works", () => {
    const config = {
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
    };
    const mapper = new NameMapper(config);
    const utils = new ConfigDependentUtils({
      defaultNumericType: "int",
    } as unknown as CSharpConverterConfig);
    const traverser = new AstTraverser(
      "./src/test/index.ts",
      "./tsconfig.json",
      false,
      new Set(),
      utils
    );
    traverser.traverse();
    const ns = traverser.createNamespace("TestNamespace", mapper);
    const str = ns.serialize(mapper);
    expect(str).toMatchSnapshot();
  });
});
