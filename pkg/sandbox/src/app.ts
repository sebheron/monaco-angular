import * as monaco from "monaco-editor";
import setupAngularWorker from 'monaco-angular';

// core.d.ts
// primitives-di.d.ts
// primitives-event-dispatch.d.ts
// primitives-signals.d.ts
// rxjs-interop.d.ts
// testing.d.ts
// _api-chunk.d.ts
// _chrome_dev_tools_performance-chunk.d.ts
// _discovery-chunk.d.ts
// _effect-chunk.d.ts
// _event_dispatcher-chunk.d.ts
// _formatter-chunk.d.ts
// _weak_ref-chunk.d.ts

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

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import angularWorker from 'monaco-angular/worker?worker';

const angularWorkerInstance = new angularWorker();

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'typescript' || label === 'javascript' || label === 'html') {
            return angularWorkerInstance;
        }
        else if (label === 'css') {
            return new cssWorker();
        }
        else {
            return new editorWorker();
        }
    },
};

export function createEditors(htmlElement: HTMLElement, tsElement: HTMLElement) {
    const disposables: monaco.IDisposable[] = [];
    disposables.push({ dispose: setupAngularWorker() });

    monaco.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.typescript.ScriptTarget.ESNext,
        module: monaco.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        strict: true,
        strictNullChecks: true,
        strictPropertyInitialization: false,
        noEmit: true,
        noImplicitAny: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        allowNonTsExtensions: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        skipLibCheck: true,
        sourceMap: true,
        declaration: false,
        downlevelIteration: true,
        importHelpers: true,
        useDefineForClassFields: false,
        lib: ['es2022', 'dom'],
        baseUrl: '.',
        paths: {
            '@angular/*': ['node_modules/@angular/core/*'],
        },
    });

    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        coreDTS,
        'file:///node_modules/@angular/core/index.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        primitivesDiDTS,
        'file:///node_modules/@angular/core/primitives-di.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        primitivesEventDispatchDTS,
        'file:///node_modules/@angular/core/primitives-event-dispatch.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        primitivesSignalsDTS,
        'file:///node_modules/@angular/core/primitives-signals.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        rxjsInteropDTS,
        'file:///node_modules/@angular/core/rxjs-interop.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        testingDTS,
        'file:///node_modules/@angular/core/testing.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        apiChunkDTS,
        'file:///node_modules/@angular/core/_api-chunk.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        chromeDevToolsPerformanceChunkDTS,
        'file:///node_modules/@angular/core/_chrome_dev_tools_performance-chunk.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        discoveryChunkDTS,
        'file:///node_modules/@angular/core/_discovery-chunk.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        effectChunkDTS,
        'file:///node_modules/@angular/core/_effect-chunk.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        eventDispatcherChunkDTS,
        'file:///node_modules/@angular/core/_event_dispatcher-chunk.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        formatterChunkDTS,
        'file:///node_modules/@angular/core/_formatter-chunk.d.ts'
    ));
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        weakRefChunkDTS,
        'file:///node_modules/@angular/core/_weak_ref-chunk.d.ts'
    ));
    
    disposables.push(monaco.typescript.typescriptDefaults.addExtraLib(
        `declare module 'tslib' { ${tslibDTS} }`,
        'file:///node_modules/tslib/index.d.ts'
    ));

    const tsModel = monaco.editor.createModel('', 'typescript', monaco.Uri.parse('file:///app/app.ts'));
    const htmlModel = monaco.editor.createModel('', 'html', monaco.Uri.parse('file:///app/app.html'));

    disposables.push(tsModel);
    disposables.push(htmlModel);

    const editorSettings = {
        theme: "vs-dark",
        automaticLayout: true,
        useShadowDOM: true,
        scrollbar: {
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            verticalSliderSize: 10,
            horizontalSliderSize: 10,
        },
        padding: {
            top: 40,
            bottom: 5,
        },
        scrollBeyondLastLine: false,
        minimap: {
            enabled: false
        }
    }

    const htmlEditor = monaco.editor.create(htmlElement, editorSettings);
    const tsEditor = monaco.editor.create(tsElement, editorSettings);

    disposables.push(htmlEditor);
    disposables.push(tsEditor);

    htmlEditor.setModel(htmlModel);
    tsEditor.setModel(tsModel);

    return {
        tsEditor,
        htmlEditor,
        getTsErrors: () => monaco.editor.getModelMarkers({ resource: tsModel.uri }),
        getHtmlErrors: () => monaco.editor.getModelMarkers({ resource: htmlModel.uri }),
        dispose: () => disposables.forEach(d => d.dispose()),
    }
}