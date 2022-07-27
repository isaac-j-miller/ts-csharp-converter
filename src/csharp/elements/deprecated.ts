import { CSharpPrimitiveType } from "./types";

export interface ICSharpPrimitive {
  name: CSharpPrimitiveType | ICSharpPrimitive | string;
  toString(): string;
}

export class CSharpPrimitive implements ICSharpPrimitive {
  constructor(public readonly name: CSharpPrimitiveType) {}
  toString(): string {
    return this.name.toString();
  }
}
export class CSharpType implements ICSharpPrimitive {
  constructor(public readonly name: string) {}
  toString(): string {
    return this.name.toString();
  }
}
export class CSharpList implements ICSharpPrimitive {
  constructor(
    public readonly name: CSharpPrimitiveType | string | ICSharpPrimitive
  ) {}

  toString(): string {
    return `${this.name.toString()}[]`;
  }
}

export class CSharpGeneric implements ICSharpPrimitive {
  constructor(public readonly name: string, private params: string[]) {}
  toString(): string {
    return `${this.name.toString()}<${this.params.join(", ")}>`;
  }
}
