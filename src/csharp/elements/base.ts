import type { INameMapper } from "src/converter/name-mapper/types";
import type { CSharpElementKind } from "../types";
import type { ICSharpElement } from "./types";

export abstract class CSharpElement implements ICSharpElement {
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
  abstract serialize(mapper: INameMapper, indentation?: number): string;
}
