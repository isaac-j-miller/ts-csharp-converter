import { convertTypescriptToCSharp } from "./index";

const main = async () => {
  await convertTypescriptToCSharp(
    "./src/test/index.ts",
    "./tsconfig.json",
    "./dist/Output.cs",
    "TestNamespace"
  );
};

if (require.main === module) {
  void main();
}
