import { getInputMapper, getOutputMapper } from "./factory";
import { parseNormalized, PascalInputMapper } from "./mappers";
import {
  CasedString,
  CasingConvention,
  NameInputMapper,
  ParsedWord,
} from "./types";

type Input = {
  parsed: ParsedWord[];
  formatted: {
    [S in CasingConvention]: string;
  };
};
function runInputTest<T extends CasingConvention>(convention: T, input: Input) {
  const key = input.formatted[convention];
  it(`${key} (${CasingConvention[convention]})`, () => {
    const inputMapper = getInputMapper(convention);
    const parsed = inputMapper(key as unknown as CasedString<T>);
    expect(parsed).toEqual(input.parsed);
  });
}

function runOutputTest<T extends CasingConvention>(
  convention: T,
  input: Input
) {
  const key = input.formatted[convention];
  it(`${key} (${CasingConvention[convention]})`, () => {
    const outputMapper = getOutputMapper(convention);
    const formatted = outputMapper(input.parsed);
    expect(formatted).toEqual(input.formatted[convention]);
  });
}

const inputs: Input[] = [
  {
    formatted: {
      [CasingConvention.CamelCase]: "someString",
      [CasingConvention.KebabCase]: "some-string",
      [CasingConvention.PascalCase]: "SomeString",
      [CasingConvention.SnakeCase]: "some_string",
    },
    parsed: [
      {
        base: "some",
      },
      {
        base: "string",
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "someGeneric<t, v>",
      [CasingConvention.KebabCase]: "some-generic<t, v>",
      [CasingConvention.PascalCase]: "SomeGeneric<T, V>",
      [CasingConvention.SnakeCase]: "some_generic<t, v>",
    },
    parsed: [
      {
        base: "some",
      },
      {
        base: "generic",
        typeArguments: [[{ base: "t" }], [{ base: "v" }]],
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "nestedGeneric<someGeneric<t>, v>",
      [CasingConvention.KebabCase]: "nested-generic<some-generic<t>, v>",
      [CasingConvention.PascalCase]: "NestedGeneric<SomeGeneric<T>, V>",
      [CasingConvention.SnakeCase]: "nested_generic<some_generic<t>, v>",
    },
    parsed: [
      {
        base: "nested",
      },
      {
        base: "generic",
        typeArguments: [
          [
            { base: "some" },
            { base: "generic", typeArguments: [[{ base: "t" }]] },
          ],
          [{ base: "v" }],
        ],
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "someArray[]",
      [CasingConvention.KebabCase]: "some-array[]",
      [CasingConvention.PascalCase]: "SomeArray[]",
      [CasingConvention.SnakeCase]: "some_array[]",
    },
    parsed: [
      {
        base: "some",
      },
      {
        base: "array",
        arrayPart: "[]",
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]:
        "nestedGenericWitharray<someGeneric<t[]>, v>",
      [CasingConvention.KebabCase]:
        "nested-generic-witharray<some-generic<t[]>, v>",
      [CasingConvention.PascalCase]:
        "NestedGenericWitharray<SomeGeneric<T[]>, V>",
      [CasingConvention.SnakeCase]:
        "nested_generic_witharray<some_generic<t[]>, v>",
    },
    parsed: [
      {
        base: "nested",
      },
      {
        base: "generic",
      },
      {
        base: "witharray",
        typeArguments: [
          [
            {
              base: "some",
            },
            {
              base: "generic",
              typeArguments: [[{ base: "t", arrayPart: "[]" }]],
            },
          ],
          [{ base: "v" }],
        ],
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]:
        "nestedGenericWitharrayWitharray<someGeneric<t[]>, v>[,,]",
      [CasingConvention.KebabCase]:
        "nested-generic-witharray-witharray<some-generic<t[]>, v>[,,]",
      [CasingConvention.PascalCase]:
        "NestedGenericWitharrayWitharray<SomeGeneric<T[]>, V>[,,]",
      [CasingConvention.SnakeCase]:
        "nested_generic_witharray_witharray<some_generic<t[]>, v>[,,]",
    },
    parsed: [
      {
        base: "nested",
      },
      {
        base: "generic",
      },
      {
        base: "witharray",
      },
      {
        base: "witharray",
        typeArguments: [
          [
            { base: "some" },
            {
              base: "generic",
              typeArguments: [[{ base: "t", arrayPart: "[]" }]],
            },
          ],
          [{ base: "v" }],
        ],
        arrayPart: "[,,]",
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "someDeeperArray[,,]",
      [CasingConvention.KebabCase]: "some-deeper-array[,,]",
      [CasingConvention.PascalCase]: "SomeDeeperArray[,,]",
      [CasingConvention.SnakeCase]: "some_deeper_array[,,]",
    },
    parsed: [
      {
        base: "some",
      },
      {
        base: "deeper",
      },
      {
        base: "array",
        arrayPart: "[,,]",
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "x",
      [CasingConvention.KebabCase]: "x",
      [CasingConvention.PascalCase]: "X",
      [CasingConvention.SnakeCase]: "x",
    },
    parsed: [
      {
        base: "x",
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "map<string, string[]>",
      [CasingConvention.KebabCase]: "map<string, string[]>",
      [CasingConvention.PascalCase]: "Map<string, string[]>",
      [CasingConvention.SnakeCase]: "map<string, string[]>",
    },
    parsed: [
      {
        base: "map",
        typeArguments: [
          [{ base: "string" }],
          [{ base: "string", arrayPart: "[]" }],
        ],
      },
    ],
  },
  {
    formatted: {
      [CasingConvention.CamelCase]: "map<string, string[], foo<int[,,]>>[]",
      [CasingConvention.KebabCase]: "map<string, string[], foo<int[,,]>>[]",
      [CasingConvention.PascalCase]: "Map<string, string[], Foo<int[,,]>>[]",
      [CasingConvention.SnakeCase]: "map<string, string[], foo<int[,,]>>[]",
    },
    parsed: [
      {
        base: "map",
        typeArguments: [
          [{ base: "string" }],
          [{ base: "string", arrayPart: "[]" }],
          [
            {
              base: "foo",
              typeArguments: [[{ base: "int", arrayPart: "[,,]" }]],
            },
          ],
        ],
        arrayPart: "[]",
      },
    ],
  },
];

function runInputTests<T extends CasingConvention>(
  inputs: Input[],
  convention: T
) {
  inputs.forEach((input) => {
    runInputTest(convention, input);
  });
}

function runFormattingTests<T extends CasingConvention>(
  inputs: Input[],
  convention: T
) {
  inputs.forEach((input) => {
    runOutputTest(convention, input);
  });
}

describe("formatters", () => {
  (
    Object.values(CasingConvention).filter(
      (k) => typeof k !== "string"
    ) as CasingConvention[]
  ).forEach((convention) => {
    describe(CasingConvention[convention], () => {
      runFormattingTests(inputs, convention);
    });
  });
});

describe("input mappers", () => {
  (
    Object.values(CasingConvention).filter(
      (k) => typeof k !== "string"
    ) as CasingConvention[]
  ).forEach((convention) => {
    describe(CasingConvention[convention], () => {
      runInputTests(inputs, convention);
    });
  });
});
