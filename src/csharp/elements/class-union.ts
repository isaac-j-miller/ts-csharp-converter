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
    const baseDec = `${getIndentString(indent)}public sealed class Case${
      i + 1
    } : ${getGenericTypeName(name, params)} {`;
    const properties = [
      `${getIndentString(indent + 1)}public readonly ${param} Item;`,
      `${getIndentString(indent + 1)}Case${i + 1}(${param} item) : base() { this.Item = item; }`,
      `${getIndentString(indent + 1)}override T Match<T>(${params
        .map(p => `Func<${p}, T> ${p.toLowerCase()}`)
        .join(", ")}) { return ${param.toLowerCase()}(item); }`,
    ];
    const endBracket = `${getIndentString(indent)}}`;
    const serialized = [baseDec, ...properties, endBracket].join("\n");
    return serialized;
  }
  serialize(_mapper: INameMapper, indentation: number = 0): string {
    const mainClass = this.serializeMainClass(indentation);
    const serializer = this.serializeSerializer(indentation);
    const serialized = `${mainClass}\n${serializer}`;
    return serialized;
  }
  private serializeMainClass(indentation: number = 0) {
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
  serializeSerializer(indentation: number = 0) {
    const generator = new UnionSerializerGenerator(this.numElements);
    return generator.serialize(indentation);
  }
}
class UnionSerializerGenerator {
  constructor(private numElements: number) {}
  private getReadMethod(indentation: number = 0) {
    const { numElements } = this;
    const params = getFirstNUppercaseLetters(numElements);
    const className = `Union${numElements}<${params.join(", ")}>`;
    const bodyLines = [
      "JToken token = JToken.Load(reader);",
      "NamingStrategy? namingStrategy = null;",
      "var resolver = serializer.ContractResolver;",
      "try {",
      `${getIndentString(1)} var asDefault = (DefaultContractResolver)resolver;`,
      `${getIndentString(1)} namingStrategy = asDefault.NamingStrategy;`,
      "} catch (InvalidCastException) { }",
      ...params.map(p => `var as${p} = SerializationUtils.FindType<${p}>(token, namingStrategy);`),
      `double[] scores = { ${params.map(p => `as${p}.Item2`).join(", ")} };`,
      "double maxScore = 0;",
      "int maxIndex = 0;",
      "for (int i = 0; i < scores.Length; i++) {",
      `${getIndentString(1)}double score = scores[i];`,
      `${getIndentString(1)}if (score > maxScore) {`,
      `${getIndentString(2)}maxIndex = i;`,
      `${getIndentString(2)}maxScore = score;`,
      `${getIndentString(1)}}`,
      "}",
      "#pragma warning disable CS8604 // Possible null reference argument.",
      "switch(maxIndex) {",
      ...params.flatMap((p, i) => [
        `${getIndentString(1)}case ${i}:`,
        `${getIndentString(2)}return new ${className}.Case${i + 1}(as${p}.Item1);`,
      ]),
      `${getIndentString(1)}default:`,
      `${getIndentString(2)}throw new Exception("Should not be any other cases");`,
      "#pragma warning restore CS8604 // Possible null reference argument.",
      "}",
    ];
    const body = bodyLines.map(b => `${getIndentString(indentation + 1)}${b}`).join("\n");
    return `${getIndentString(
      indentation
    )}public override ${className} ReadJson(JsonReader reader, Type objectType, ${className} existingValue, bool hasExistingValue, JsonSerializer serializer) {\n${body}\n${getIndentString(
      indentation
    )}}`;
  }
  private getWriteMethod(indentation: number = 0) {
    const { numElements } = this;
    const params = getFirstNUppercaseLetters(numElements);
    const className = `Union${numElements}<${params.join(", ")}>`;
    const bodyLines = [
      "value.Match<string?>(",
      ...params.flatMap((p, i) => [
        `${getIndentString(1)}${p.toLowerCase()} => {`,
        `${getIndentString(2)}serializer.Serialize(writer, ${p.toLowerCase()});`,
        `${getIndentString(2)}return null;`,
        `${getIndentString(1)}}${i === numElements - 1 ? "" : ","}`,
      ]),
      ");",
    ];
    const body = bodyLines.map(b => `${getIndentString(indentation + 1)}${b}`).join("\n");
    return `${getIndentString(
      indentation
    )}public override void WriteJson(JsonWriter writer, ${className} value, JsonSerializer serializer) {\n${body}\n${getIndentString(
      indentation
    )}}`;
  }
  serialize(indentation: number = 0): string {
    const { numElements } = this;
    const params = getFirstNUppercaseLetters(numElements);
    const methods = [this.getReadMethod(indentation + 1), this.getWriteMethod(indentation + 1)];
    const body = methods.join("\n");
    const declaration = `${getIndentString(
      indentation
    )}public class Union${numElements}Serializer<${params.join(
      ", "
    )}> : JsonConverter<Union${numElements}<${params.join(", ")}>> {\n${body}\n${getIndentString(
      indentation
    )}}`;
    return declaration;
  }
}
