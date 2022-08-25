import { NominalString } from "./more";
import { TestEnum1, TestEnum2 } from "./more-types";

export type Foo = {
  // x is a number
  x: number;
  // comment comment comment
  y: string;
};
const arrayValues = ["a", "b", "c"] as const;
export type Abc = typeof arrayValues[number];

export type GenericWithConstraints<T extends string> = {
  str: T;
};

export type GenericWithConstraints2<T extends Foo> = {
  foo: T;
};

export type GenericWithConstraints3<T extends 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = {
  digit: T;
};
export type GenericWithConstraints4<T extends ZZZ> = {
  z: T;
};
export type SomeGenericType<T> = {
  foo: T;
  bar: Abc;
};

export type DefaultGeneric<Ta = number> = {
  v: Ta;
};
export type SomeLargerType<U> = {
  a: string;
  y: Abc;
} & DefaultGeneric & {
    x: Omit<SomeGenericType<U>, "bar">;
  };

export type Composite = DefaultGeneric & SomeGenericType<Abc> & Foo;

export type BlahBlah = {
  x: Array<Foo & SomeGenericType<string>>;
  y: Array<SomeLargerType<DefaultGeneric>>;
};

export type ZZZ = {
  z: NominalString;
  v: Record<string, string>;
  y: Record<string, DefaultGeneric>;
  x: Record<string, SomeGenericType<Abc>>;
};
export type Bs<T> = Record<string, DefaultGeneric<T>>;

export type SomeStupidSubEnum = TestEnum1.Baz | TestEnum1.FooBar;

export type SomeStupidSubEnum2 = TestEnum1.Fooooo | TestEnum2.Value2;

/**
 * @type {float}
 */
export type NumericalUnion = 1.2 | 3.8 | 4;

export type DumbType = {
  num: NumericalUnion;
  dumber: TestEnum1 | 1;
  un: SomeUnion;
  absurd: AbsurdUnion;
};
export type AbsurdUnion = "foo" | 1 | null;

export type SomeUnion = "foo" | "bar" | string;

export type IndexType = {
  abc: ZZZ["v"];
  a: SomeLargerType<Abc>["x"];
};

export type GenericIndexType<T extends Bs<any>> = {
  i: IndexType;
  v: SomeGenericType<T>["foo"];
};

export type AnotherType = {
  x: string[][][];
  n: number[][][][][];
};

export type GenericArrayType = {
  j: SomeGenericType<Composite>[];
  k: Array<Array<AnotherType>>;
};

export type GenericArrayType2<V> = {
  someProperty: V[][];
  anotherProperty: DefaultGeneric<V>[];
};

export type NumbersWithJsDoc = {
  /**
   * @type {int}
   */
  intProperty: number;
  /**
   * @type {float}
   */
  floatProperty: number;
};

/**
 * @type {int}
 */
export interface Integer extends Number {
  _nominal: "Integer";
}
/**
 * @type {float}
 */
export interface Float extends Number {
  _nominal: "Integer";
}

export type ConsumesInterface = {
  integer: Integer;
  float: Float;
};
