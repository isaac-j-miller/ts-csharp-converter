import { TypeWithEnums } from "./subfolder/more";
import { TestEnum1, TestEnum2 } from "./subfolder/more-types";

export const FOO = "some string";
export const BAR = "some string as const" as const;

export const whatever = 1;
/**
 * an array of strings
 */
export const aStringArray = ["foo", "var", "aaaa"];
export const aNumberArray = [1, 2, 3, 4];
// a 2D int array
export const a2dArray = [
  [1, 2, 3],
  [2, 3, 4],
  [4, 5, 6],
];

export const typeInstance: TypeWithEnums = {
  enum1: TestEnum1.Baz,
  enum2: TestEnum2.Value2,
};
