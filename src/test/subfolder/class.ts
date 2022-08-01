import { TestEnum1 } from "./more-types";

export class SomeDataRepresentation {
  public foo!: number;
  public bar?: string;
  protected z!: TestEnum1;
  constructor(public x: string) {}
  aMethod() {}
}
