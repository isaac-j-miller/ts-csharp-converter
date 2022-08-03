import { Abc } from "./types";

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
