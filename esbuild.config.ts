import "source-map-support/register";
import esbuild from "esbuild";

esbuild.buildSync({
  entryPoints: ["./src/index.ts", "./src/cli.ts"],
  bundle: true,
  platform: "node",
  outdir: "./dist",
});
