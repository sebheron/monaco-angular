import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('pkg/monaco-angular-ls/package.json', 'utf8'));
const version = pkg.devDependencies['@angular/language-service'];

// Fixed filename so re-running on a rebased branch overwrites rather than stacks up.
writeFileSync(
  '.changeset/bundled-language-service.md',
  `---
"monaco-angular": patch
---

Update bundled @angular/language-service to ${version}
`
);
