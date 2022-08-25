import { AstTraverser } from "src/ast";
import { CasingConvention, NameMapper, NameType } from "src/converter/name-mapper";

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
    const traverser = new AstTraverser("./src/test/index.ts", "./tsconfig.json", false, new Set());
    traverser.traverse();
    const ns = traverser.createNamespace("TestNamespace");
    const str = ns.serialize(mapper);
    expect(str).toMatchSnapshot();
  });
});
