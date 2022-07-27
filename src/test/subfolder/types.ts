import { NominalString } from "./more";

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
