import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const id = randomBytes(4).toString('hex');
const version = process.argv[2];

writeFileSync(
  `.changeset/ls-${id}.md`,
  `---
"monaco-angular": patch
---

Update bundled @angular/language-service to ${version}
`
);