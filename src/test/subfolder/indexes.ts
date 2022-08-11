import { Abc, SomeGenericType } from "./types";

export type UnionIndex = {
  /**
   * @type {double}
   */
  [k in Abc]?: number;
};

export type UnionIndex2 = Record<Abc, boolean>;

export type GenericUnionIndex<T extends string | number, V> = {
  [K in T]: V;
};
export type GenericUnionIndex2<T extends string | number> = {
  [K in T]: string;
};

export type GenericUnionIndex3<T extends string | number> = {
  [K in T]: Abc | UnionIndex;
};
export type GenericUnionIndex4<T extends string | number> = {
  [K in T]: {
    /**
     * @type {float}
     */
    foo: number;
    bar: string;
  };
};
export type GenericConsumer = GenericUnionIndex<string, number>;

// this is a comment that should show up on the GenericConsumerConsumer class
export type GenericConsumerConsumer = {
  // g comment
  g: GenericConsumer;
};

export type FooBar = {
  f: () => string;
  g: () => GenericConsumer;
};

export type FunctionType = (x: string, y: number) => boolean;

export type FunctionType2 = (c: string) => {
  f: string;
  g: number;
};

export type FunctionType3 = <T extends string>(s: T) => GenericUnionIndex2<T>;

export type Whatever1 = {
  w: ReturnType<FunctionType2>;
};

export type RecursiveType = {
  t: number;
  r: RecursiveType;
};
export type RecursiveType2 = {
  t: number;
  r: RecursiveType | undefined;
};
export type RecursiveType3 = {
  t: number;
  r2?: RecursiveType;
};
export type GenericRecursive = {
  t: SomeGenericType<GenericRecursive>;
};
export type Constructor<T> = new (...args: any[]) => T;

export type DumbEnum = "member_one" | "member-two" | "member3" | "memberMember1" | "PascalMember" | "application/foooo.a-b-c.x"