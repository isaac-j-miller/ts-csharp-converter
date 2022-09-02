import { INameMapper } from "src/converter/name-mapper";
import { getGenericTypeName } from "src/converter/util";
import { getFirstNUppercaseLetters, getIndentString } from "../util";
import { CSharpElement } from "./base";

export class CSharpClassUnion extends CSharpElement {
  constructor(public readonly numElements: number) {
    const name = `Union${numElements}`;
    const commentString = `A union of ${numElements} elements`;
    super("class", name, commentString, false);
  }
  private createPositionClass(i: number, param: string, params: string[], indent: number): string {
    const { name } = this;
    const baseDec = `${getIndentString(indent)}public sealed class Case${i} : ${getGenericTypeName(
      name,
      params
    )} {`;
    const properties = [
      `${getIndentString(indent + 1)}public readonly ${param} Item;`,
      `${getIndentString(indent + 1)}Case${i}(${param} item) : base() { this.Item = item; }`,
      `${getIndentString(indent + 1)}override T Match<T>(${params
        .map(p => `Func<${p}, T> ${p.toLowerCase()}`)
        .join(", ")}) { return ${param.toLowerCase()}(item); }`,
    ];
    const endBracket = `${getIndentString(indent)}}`;
    const serialized = [baseDec, ...properties, endBracket].join("\n");
    return serialized;
  }
  serialize(_mapper: INameMapper, indentation: number = 0): string {
    const { name, numElements } = this;
    const params = getFirstNUppercaseLetters(numElements);
    const baseDec = `${getIndentString(indentation)}public abstract class ${getGenericTypeName(
      name,
      params
    )} {`;
    const match = `${getIndentString(indentation + 1)}public abstract T Match<T>(${params
      .map(p => `Func<${p}, T> ${p.toLowerCase()}`)
      .join(", ")});`;
    const cotr = `${getIndentString(indentation + 1)}private ${name}() { }`;
    const positionClasses = params.map((p, i, arr) =>
      this.createPositionClass(i, p, arr, indentation + 1)
    );
    const endBracket = `${getIndentString(indentation)}}`;
    const serialized = [baseDec, match, cotr, ...positionClasses, endBracket].join("\n");
    return serialized;
  }
}
