export interface NominalString extends String {
  _nominal: "Nominal";
}

type X = {
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
