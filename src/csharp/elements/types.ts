import { INameMapper } from "src/converter/name-mapper/types";

export interface ICSharpElement {
  readonly isPublic: boolean;
  serialize(mapper: INameMapper, indentation?: number): string;
}
