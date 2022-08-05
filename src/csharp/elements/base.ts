import { NameMapper } from "src/converter/name-mapper/mapper";
import { CSharpElementKind } from "../types";

export abstract class CSharpElement {
  private _isInternal: boolean;
  constructor(
    public readonly kind: CSharpElementKind,
    public readonly name: string,
    public readonly commentString?: string,
    isInternal?: boolean
  ) {
    this._isInternal = !!isInternal;
  }
  public get isPublic() {
    return !this._isInternal;
  }
  abstract serialize(mapper: NameMapper, indentation?: number): string;
}
