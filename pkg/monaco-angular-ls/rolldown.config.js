import { defineConfig } from "rolldown";
import fs from "fs";

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
      name: "copy-readme",
      buildEnd() {
        fs.copyFileSync("../../README.md", "README.md");
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
    intro: "var require;var document;var process;",
    comments: {
      legal: false,
      jsdoc: false,
      annotation: true,
    },
    postBanner: googleLegal,
  },
});
