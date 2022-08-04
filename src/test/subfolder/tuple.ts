import { UnionIndex2 } from "./indexes";
import { Abc, DefaultGeneric, Float, SomeGenericType } from "./types";

export type ATuple = [string, number];
export type BTuple = [Float, Float, Float];
export type CTuple = [string, Float, UnionIndex2, Abc];
export type TupleMap = Record<string, BTuple>;
export type GenericTupleMap<T, U, V> = [T, U, V];
export type GenericTupleMap2<T, V> = [T, V[]];
export type TupleMap2 = [string, string[], number[][][]];
export type TupleMap3 = [ATuple[], BTuple[][]];
export type Tuple1 = [
  string,
  Float,
  SomeGenericType<Float>,
  DefaultGeneric<Float>,
  SomeGenericType<Abc>
];
