import { Abc } from "./types";

export type A = {
  foo: number;
};
export type B = {
  bar: string;
};

export type Inverse<T extends A | B> = T extends A ? B : A;

export type ConsumesConditional = {
  prop1: Inverse<A>;
};

export type ConditionalMappedType<T extends string, V> = {
  [key in T]: V extends A ? Inverse<A> : ConsumesConditional;
};

export type ConsumesConditionalMappedType = {
  x: ConditionalMappedType<Abc, A>;
  y: ConditionalMappedType<Abc, B>;
};
