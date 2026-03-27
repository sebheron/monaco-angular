# Monaco Angular
Angular language plugin for the Monaco Editor. It bundles the entire angular language service into a web worker so it can run locally and offline. It can be used alongside tools like [esbuild-wasm](https://www.npmjs.com/package/esbuild-wasm) to build entirely web based Angular development environments.

There are some features such as code fixes and refactorings that are not currently implemented. However, the core features of the language service are completely working.

[Sandbox Demo](https://sebheron.github.io/monaco-angular/)

## Installation
```bash
npm install monaco-angular
```
or
```bash
pnpm install monaco-angular
```

## Usage

### Setting up the worker
The package exposes both the worker and a function to setup the worker. `setupAngularWorker` must be called before the editor is intialised as it patches some of the monaco editor's internals. To enable html template support, the `angularWorker` must be created outside of the `getWorker` function and returned for both **typescript** and **html** labels. Other labels like css, sass, etc. are supported but largely untested as of now.
```typescript
import setupAngularWorker from 'monaco-angular';
import angularWorker from 'monaco-angular/worker?worker';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

setupAngularWorker();
const angularWorkerInstance = new angularWorker();

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'typescript' || label === 'html') {
            return angularWorkerInstance;
        }
        else {
            return new editorWorker();
        }
    },
};
```

### Enabling angular types
By default the language service doesn't bundle any of the angular types. The easiest way to add these (if you're using vite/angular-cli as your bundler) is to import the raw declaration files into your project and declare them as **extraLibs**.

```typescript
import coreDTS from '../node_modules/@angular/core/types/core.d.ts?raw';
import primitivesDiDTS from '../node_modules/@angular/core/types/primitives-di.d.ts?raw';
import primitivesEventDispatchDTS from '../node_modules/@angular/core/types/primitives-event-dispatch.d.ts?raw';
import primitivesSignalsDTS from '../node_modules/@angular/core/types/primitives-signals.d.ts?raw';
import rxjsInteropDTS from '../node_modules/@angular/core/types/rxjs-interop.d.ts?raw';
import testingDTS from '../node_modules/@angular/core/types/testing.d.ts?raw';
import apiChunkDTS from '../node_modules/@angular/core/types/_api-chunk.d.ts?raw';
import chromeDevToolsPerformanceChunkDTS from '../node_modules/@angular/core/types/_chrome_dev_tools_performance-chunk.d.ts?raw';
import discoveryChunkDTS from '../node_modules/@angular/core/types/_discovery-chunk.d.ts?raw';
import effectChunkDTS from '../node_modules/@angular/core/types/_effect-chunk.d.ts?raw';
import eventDispatcherChunkDTS from '../node_modules/@angular/core/types/_event_dispatcher-chunk.d.ts?raw';
import formatterChunkDTS from '../node_modules/@angular/core/types/_formatter-chunk.d.ts?raw';
import weakRefChunkDTS from '../node_modules/@angular/core/types/_weak_ref-chunk.d.ts?raw';
import tslibDTS from '../node_modules/tslib/tslib.d.ts?raw';

monaco.typescript.typescriptDefaults.addExtraLib(
    coreDTS,
    'file:///node_modules/@angular/core/index.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    primitivesDiDTS,
    'file:///node_modules/@angular/core/types/primitives-di.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    primitivesEventDispatchDTS,
    'file:///node_modules/@angular/core/types/primitives-event-dispatch.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    primitivesSignalsDTS,
    'file:///node_modules/@angular/core/types/primitives-signals.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    rxjsInteropDTS,
    'file:///node_modules/@angular/core/types/rxjs-interop.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    testingDTS,
    'file:///node_modules/@angular/core/types/testing.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    apiChunkDTS,
    'file:///node_modules/@angular/core/types/_api-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    chromeDevToolsPerformanceChunkDTS,
    'file:///node_modules/@angular/core/types/_chrome_dev_tools_performance-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    discoveryChunkDTS,
    'file:///node_modules/@angular/core/types/_discovery-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    effectChunkDTS,
    'file:///node_modules/@angular/core/types/_effect-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    eventDispatcherChunkDTS,
    'file:///node_modules/@angular/core/types/_event_dispatcher-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    formatterChunkDTS,
    'file:///node_modules/@angular/core/types/_formatter-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    weakRefChunkDTS,
    'file:///node_modules/@angular/core/types/_weak_ref-chunk.d.ts'
);
monaco.typescript.typescriptDefaults.addExtraLib(
    tslibDTS,
    'file:///node_modules/tslib/tslib.d.ts'
);

//Make sure to include some additional compiler options too for tslib and fix paths for the angular imports.
monaco.typescript.typescriptDefaults.setCompilerOptions({
    // Existing compiler options...
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    baseUrl: '.',
    paths: {
        '@angular/*': ['node_modules/@angular/core/*'],
    },
});
```

## Customisation
The language service uses a subset of the angular compiler options. You can pass any of these options into the `setupAngularWorker` function to customize its behaviour.
For more info: [angular compiler options](https://angular.dev/reference/configs/angular-compiler-options).

```typescript
export interface PluginConfig {
    /**
     * If true, return only Angular results. Otherwise, return Angular + TypeScript results.
     */
    angularOnly?: boolean;
    /**
     * If false, disable `strictTemplates` in the language service.
     */
    strictTemplates?: boolean;
    /**
     * If false, disables parsing control flow blocks in the compiler. Should be used only when older
     * versions of Angular that do not support blocks (pre-v17) used with the language service.
     */
    enableBlockSyntax?: boolean;
    /**
     * Version of `@angular/core` that should be used by the language service.
     */
    angularCoreVersion?: string;
    /**
     * If false, disables parsing of `@let` declarations in the language service.
     */
    enableLetSyntax?: boolean;
    /**
     * A list of diagnostic codes that should be supressed in the language service.
     */
    suppressAngularDiagnosticCodes?: number[];
}
```