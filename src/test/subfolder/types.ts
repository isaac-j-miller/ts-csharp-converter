import { NominalString } from "./more";
import { TestEnum1, TestEnum2 } from "./more-types";

export type Foo = {
  x: number;
  y: string;
};
const arrayValues = ["a", "b", "c"] as const;
export type Abc = typeof arrayValues[number];

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

export type NumericalUnion = 1 | 3 | 4;

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
