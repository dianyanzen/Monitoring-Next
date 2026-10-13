// Test-only TypeScript loader, using the project's installed compiler.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return original.call(
    this,
    name.startsWith("@/")
      ? path.join(process.cwd(), "src", name.slice(2))
      : name,
    parent,
    ...rest,
  );
};
require.extensions[".ts"] = function (module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(result.outputText, filename);
};
