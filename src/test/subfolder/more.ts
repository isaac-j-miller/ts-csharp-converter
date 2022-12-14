import { TestEnum1, TestEnum2 } from "./more-types";

export interface NominalString extends String {
  _nominal: "Nominal";
}
export interface NominalNumber extends Number {
  _nominal: "NominalNum";
}
export interface NominalBool extends Boolean {
  _nominal: "NominalBool";
}
export interface NominalObj extends Object {
  _nominal: "NominalObj";
}

type X = {
  // whatever is a number property on X
  whatever: number;
};
export interface SomeInterface {
  foo?: string;
  bar: string;
}
export interface SomeInterface2 extends X {
  foo2: string;
  bar: string;
}

export type TypeWithEnums = {
  enum1: TestEnum1;
  enum2: TestEnum2;
};

export function someFn() {
  return "blah blah";
}
export const anotherFn = () => {
  console.debug("jjjjjjjjj");
};

export type AAAAAAAA<T> = {
  vvv: T[];
};
