import { getOutputMapper } from "./factory";
import { formatForEnum, normalize, parseNormalized } from "./mappers";
import { CasingConvention, NameType, ParsedWord } from "./types";
import { countOccurences } from "./util";

type Input = {
  parsed: ParsedWord[];
  formatted: {
    [S in CasingConvention]: string;
  };
};

function runOutputTest<T extends CasingConvention>(convention: T, input: Input) {
  const key = input.formatted[convention];
  it(`${key} (${CasingConvention[convention]})`, () => {
    const outputMapper = getOutputMapper(convention);
    const formatted = outputMapper(input.parsed, NameType.DeclarationName);
    expect(formatted).toEqual(input.formatted[convention]);
  });
}

function runInputTest<T extends CasingConvention>(convention: T, input: Input) {
  const formatted = input.formatted[convention];
  it(`parse ${formatted}`, () => {
    const normalized = normalize(formatted);
    const parsed = parseNormalized(normalized);
    expect(parsed).toEqual(input.parsed);
  });
}
const inputs: Input[] = [
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "someString",
  //     [CasingConvention.KebabCase]: "some-string",
  //     [CasingConvention.PascalCase]: "SomeString",
  //     [CasingConvention.SnakeCase]: "some_string",
  //   },
  //   parsed: [
  //     {
  //       base: "some",
  //     },
  //     {
  //       base: "string",
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "someGeneric<t, v>",
  //     [CasingConvention.KebabCase]: "some-generic<t, v>",
  //     [CasingConvention.PascalCase]: "SomeGeneric<T, V>",
  //     [CasingConvention.SnakeCase]: "some_generic<t, v>",
  //   },
  //   parsed: [
  //     {
  //       base: "some",
  //     },
  //     {
  //       base: "generic",
  //       typeArguments: [[{ base: "t" }], [{ base: "v" }]],
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "nestedGeneric<someGeneric<t>, v>",
  //     [CasingConvention.KebabCase]: "nested-generic<some-generic<t>, v>",
  //     [CasingConvention.PascalCase]: "NestedGeneric<SomeGeneric<T>, V>",
  //     [CasingConvention.SnakeCase]: "nested_generic<some_generic<t>, v>",
  //   },
  //   parsed: [
  //     {
  //       base: "nested",
  //     },
  //     {
  //       base: "generic",
  //       typeArguments: [
  //         [{ base: "some" }, { base: "generic", typeArguments: [[{ base: "t" }]] }],
  //         [{ base: "v" }],
  //       ],
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "someArray[]",
  //     [CasingConvention.KebabCase]: "some-array[]",
  //     [CasingConvention.PascalCase]: "SomeArray[]",
  //     [CasingConvention.SnakeCase]: "some_array[]",
  //   },
  //   parsed: [
  //     {
  //       base: "some",
  //     },
  //     {
  //       base: "array",
  //       arrayPart: "[]",
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "nestedGenericWitharray<someGeneric<t[]>, v>",
  //     [CasingConvention.KebabCase]: "nested-generic-witharray<some-generic<t[]>, v>",
  //     [CasingConvention.PascalCase]: "NestedGenericWitharray<SomeGeneric<T[]>, V>",
  //     [CasingConvention.SnakeCase]: "nested_generic_witharray<some_generic<t[]>, v>",
  //   },
  //   parsed: [
  //     {
  //       base: "nested",
  //     },
  //     {
  //       base: "generic",
  //     },
  //     {
  //       base: "witharray",
  //       typeArguments: [
  //         [
  //           {
  //             base: "some",
  //           },
  //           {
  //             base: "generic",
  //             typeArguments: [[{ base: "t", arrayPart: "[]" }]],
  //           },
  //         ],
  //         [{ base: "v" }],
  //       ],
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "nestedGenericWitharrayWitharray<someGeneric<t[]>, v>[,,]",
  //     [CasingConvention.KebabCase]: "nested-generic-witharray-witharray<some-generic<t[]>, v>[,,]",
  //     [CasingConvention.PascalCase]: "NestedGenericWitharrayWitharray<SomeGeneric<T[]>, V>[,,]",
  //     [CasingConvention.SnakeCase]: "nested_generic_witharray_witharray<some_generic<t[]>, v>[,,]",
  //   },
  //   parsed: [
  //     {
  //       base: "nested",
  //     },
  //     {
  //       base: "generic",
  //     },
  //     {
  //       base: "witharray",
  //     },
  //     {
  //       base: "witharray",
  //       typeArguments: [
  //         [
  //           { base: "some" },
  //           {
  //             base: "generic",
  //             typeArguments: [[{ base: "t", arrayPart: "[]" }]],
  //           },
  //         ],
  //         [{ base: "v" }],
  //       ],
  //       arrayPart: "[,,]",
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "someDeeperArray[,,]",
  //     [CasingConvention.KebabCase]: "some-deeper-array[,,]",
  //     [CasingConvention.PascalCase]: "SomeDeeperArray[,,]",
  //     [CasingConvention.SnakeCase]: "some_deeper_array[,,]",
  //   },
  //   parsed: [
  //     {
  //       base: "some",
  //     },
  //     {
  //       base: "deeper",
  //     },
  //     {
  //       base: "array",
  //       arrayPart: "[,,]",
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "x",
  //     [CasingConvention.KebabCase]: "x",
  //     [CasingConvention.PascalCase]: "X",
  //     [CasingConvention.SnakeCase]: "x",
  //   },
  //   parsed: [
  //     {
  //       base: "x",
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "map<string, string[]>",
  //     [CasingConvention.KebabCase]: "map<string, string[]>",
  //     [CasingConvention.PascalCase]: "Map<string, string[]>",
  //     [CasingConvention.SnakeCase]: "map<string, string[]>",
  //   },
  //   parsed: [
  //     {
  //       base: "map",
  //       typeArguments: [[{ base: "string" }], [{ base: "string", arrayPart: "[]" }]],
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]: "map<string, string[], foo<int[,,]>>[]",
  //     [CasingConvention.KebabCase]: "map<string, string[], foo<int[,,]>>[]",
  //     [CasingConvention.PascalCase]: "Map<string, string[], Foo<int[,,]>>[]",
  //     [CasingConvention.SnakeCase]: "map<string, string[], foo<int[,,]>>[]",
  //   },
  //   parsed: [
  //     {
  //       base: "map",
  //       typeArguments: [
  //         [{ base: "string" }],
  //         [{ base: "string", arrayPart: "[]" }],
  //         [
  //           {
  //             base: "foo",
  //             typeArguments: [[{ base: "int", arrayPart: "[,,]" }]],
  //           },
  //         ],
  //       ],
  //       arrayPart: "[]",
  //     },
  //   ],
  // },
  // {
  //   formatted: {
  //     [CasingConvention.CamelCase]:
  //       "system.collections.generic.dictionary<system.collections.generic.dictionary<string, object>, object>",
  //     [CasingConvention.PascalCase]:
  //       "System.Collections.Generic.Dictionary<System.Collections.Generic.Dictionary<string, object>, object>",
  //     [CasingConvention.KebabCase]:
  //       "system.collections.generic.dictionary<system.collections.generic.dictionary<string, object>, object>",
  //     [CasingConvention.SnakeCase]:
  //       "system.collections.generic.dictionary<system.collections.generic.dictionary<string, object>, object>",
  //   },
  //   parsed: [
  //     {
  //       base: "system.collections.generic.dictionary",
  //       typeArguments: [
  //         [
  //           {
  //             base: "system.collections.generic.dictionary",
  //             typeArguments: [[{ base: "string" }], [{ base: "object" }]],
  //           },
  //         ],
  //         [{ base: "object" }],
  //       ],
  //     },
  //   ],
  // },
  {
    formatted: {
      [CasingConvention.CamelCase]:
        "system.collections.generic.dictionary<string, dotnetReportRequestDetails<tType, tFields, tAudience>>",
      [CasingConvention.PascalCase]:
        "System.Collections.Generic.Dictionary<string, DotnetReportRequestDetails<TType, TFields, TAudience>>",
      [CasingConvention.KebabCase]:
        "system.collections.generic.dictionary<string, dotnet-report-request-details<t-type, t-fields, t-audience>>",
      [CasingConvention.SnakeCase]:
        "system.collections.generic.dictionary<string, dotnet_report_request_details<t_type, t_fields, t_audience>>",
    },
    parsed: [
      {
        base: "system.collections.generic.dictionary",
        typeArguments: [
          [{ base: "string" }],
          [
            { base: "dotnet" },
            { base: "report" },
            { base: "request" },
            {
              base: "details",
              typeArguments: [
                [{ base: "t" }, { base: "type" }],
                [{ base: "t" }, { base: "fields" }],
                [{ base: "t" }, { base: "audience" }],
              ],
            },
          ],
        ],
      },
    ],
  },
];

function runFormattingTests<T extends CasingConvention>(inpts: Input[], convention: T) {
  inpts.forEach(input => {
    runOutputTest(convention, input);
    runInputTest(convention, input);
  });
}

describe("formatters", () => {
  (
    Object.values(CasingConvention).filter(k => typeof k !== "string") as CasingConvention[]
  ).forEach(convention => {
    describe(CasingConvention[convention], () => {
      runFormattingTests(inputs, convention);
    });
  });
});

const normalizeTests: Record<string, string> = {
  someInput: "some_input",
  some_input: "some_input",
  "some-input": "some_input",
  "Some-Input": "some_input",
  someMixed_string: "some_mixed_string",
  "En-Us": "en_us",
  "Whatever_some-inputMixed": "whatever_some_input_mixed",
  "System.Collections.Generic.Dictionary<System.Collections.Generic.Dictionary<string, object>, object>":
    "system.collections.generic.dictionary<system.collections.generic.dictionary<string, object>, object>",
};

describe("normalizer", () => {
  Object.entries(normalizeTests).forEach(([input, expectation]) => {
    it(input, () => {
      expect(normalize(input)).toEqual(expectation);
    });
  });
});

type FormatForEnumInput = {
  [key: string]: {
    [k in CasingConvention]: string;
  };
};

const formatForEnumTests: FormatForEnumInput = {
  "En-Us": {
    [CasingConvention.CamelCase]: "enUs",
    [CasingConvention.PascalCase]: "EnUs",
    [CasingConvention.SnakeCase]: "en_us",
    [CasingConvention.KebabCase]: "en-us",
  },
  "application/zip": {
    [CasingConvention.CamelCase]: "applicationZip",
    [CasingConvention.PascalCase]: "ApplicationZip",
    [CasingConvention.SnakeCase]: "application_zip",
    [CasingConvention.KebabCase]: "application-zip",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    [CasingConvention.CamelCase]: "applicationVndOpenxmlformatsOfficedocumentSpreadsheetmlSheet",
    [CasingConvention.PascalCase]: "ApplicationVndOpenxmlformatsOfficedocumentSpreadsheetmlSheet",
    [CasingConvention.SnakeCase]:
      "application_vnd_openxmlformats_officedocument_spreadsheetml_sheet",
    [CasingConvention.KebabCase]:
      "application-vnd-openxmlformats-officedocument-spreadsheetml-sheet",
  },
};

describe("formatForEnum", () => {
  Object.entries(formatForEnumTests).forEach(([input, formatOutputs]) => {
    Object.entries(formatOutputs).forEach(([casingConventionIdx, expectation]) => {
      const casingConvention = Number.parseInt(casingConventionIdx, 10) as CasingConvention;
      it(`${input} (${CasingConvention[casingConvention]})`, () => {
        const mapper = getOutputMapper(casingConvention);
        const normalized = normalize(input);
        const parsed = parseNormalized(normalized);
        const output = mapper(parsed, NameType.DeclarationName);
        const formatted = formatForEnum(output, casingConvention);
        expect(formatted).toEqual(expectation);
      });
    });
  });
});

describe("countOccurrences", () => {
  const occurrencesInputs = [
    ["at", "a", 1],
    ["ataoatt", "at", 2],
    ["ataoatt", "t", 3],
    ["atatatat", "a", 4],
    ["atoatoat__atat", "a", 5],
    ["foo", "at", 0],
    ["12345", "x", 0],
  ] as const;
  occurrencesInputs.forEach(([str, substr, count]) => {
    it(`${str} (substr)`, () => {
      expect(countOccurences(str, substr)).toEqual(count);
    });
  });
});
