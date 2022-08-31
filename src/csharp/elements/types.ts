import { INameMapper } from "src/converter/name-mapper/types";
import type { BaseTypeReference, GenericReference } from "src/converter/types";
import { CSharpElementKind } from "../types";

export interface ICSharpElement {
  readonly isPublic: boolean;
  readonly kind: CSharpElementKind,
  readonly name: string,
  readonly commentString?: string,
  readonly ref?: Exclude<BaseTypeReference, GenericReference>;
  serialize(mapper: INameMapper, indentation?: number): string;
}
