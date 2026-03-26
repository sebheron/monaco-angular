import { defineConfig } from "rolldown";

const googleLegal = `/**
* The following licence applies to the @angular/language-service package.
*
* @license
* Copyright Google LLC All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.dev/license
*/`

export default defineConfig({
  input: {
    worker: "worker.js",
    main: "main.js",
  },
  plugins: [
    {
      name: "remove-require-polyfill",
      renderChunk(code) {
        return code.replace(
          /\/\/#region.*?rolldown\/runtime\.js[\s\S]*?__require[\s\S]*?\}\);/m,
          ""
        ).replace('__require', "require")
      },
    },
    {
      name: "language-service-transform",
      transform(code, id) {
        if (!id.includes("language-service")) return;
        return (
          code.replace("module.exports = function", "export default function") +
          "\n"
        );
      },
    },
  ],
  external: (id) => id === "monaco-editor" || id.startsWith("monaco-editor/"),
  output: {
    dir: "esm",
    format: "esm",
    entryFileNames: (chunk) => {
      if (chunk.name === "worker") {
        return "monaco-angular.worker.js";
      }
      return "monaco-angular.js";
    },
    // Might need to figure out how to put this in the actual file, otherwise I can't test without building.
    intro: "var require;var document;var process;",
    // Can't get this to work, leaving as a note.
    polyfillRequire: false,
    // minify: true,
    comments: {
      legal: false,
      jsdoc: false,
      annotation: true,
    },
    postBanner: googleLegal,
  },
  // treeshake: {
  //   manualPureFunctions
  // }
});
