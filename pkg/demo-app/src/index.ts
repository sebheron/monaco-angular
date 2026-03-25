import * as monaco from "monaco-editor";
import coreTypes from '../node_modules/@angular/core/types/core.d.ts?raw';
import tslibTypes from '../node_modules/tslib/tslib.d.ts?raw';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import angularWorker from 'monaco-angular-ls/worker?worker';
import setupAngularWorker from 'monaco-angular-ls';

setupAngularWorker();
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
        '@angular/*': ['node_modules/@angular/*'],
    },
});

monaco.typescript.typescriptDefaults.addExtraLib(
    coreTypes,
    'file:///node_modules/@angular/core/index.d.ts'
);

monaco.typescript.typescriptDefaults.addExtraLib(
    `declare module 'tslib' { ${tslibTypes} }`,
    'file:///node_modules/tslib/index.d.ts'
);

// monaco.typescript.typescriptDefaults.setEagerModelSync(true);

const tsUri = monaco.Uri.parse('file:///app/app.ts');
const tsModel = monaco.editor.createModel(
`import { Component } from '@angular/core';

@Component({
    selector: 'app-hello',
    templateUrl: './app.html',
    styleUrls: ['./app.css']
})
export class HelloComponent {
    title = 'Hello Angular';
}`,
    'typescript',
    tsUri
);

const htmlUri = monaco.Uri.parse('file:///app/app.html');
const htmlModel = monaco.editor.createModel(
`<div>
    <h1>{{ title }}</h1>
    <h2>{{ subtitle }}</h2>
</div>`,
    'html',
    htmlUri
);

const cssUri = monaco.Uri.parse('file:///app/app.css');
const cssModel = monaco.editor.createModel(
`.container {
    color: red;
}`,
    'css',
    cssUri
);

const editorContainer = document.getElementById('monaco-editor') as HTMLElement;
const appTsTab = document.getElementById('app-ts') as HTMLElement;
const appHtmlTab = document.getElementById('app-html') as HTMLElement;
const appCssTab = document.getElementById('app-css') as HTMLElement;

if (![editorContainer, appTsTab, appHtmlTab, appCssTab].every(Boolean)) {
    throw new Error('Missing elements');
}

const editor = monaco.editor.create(editorContainer, {
    language: "typescript",
    theme: "vs-light",
    automaticLayout: true,
    model: tsModel,
    useShadowDOM: true,
    scrollbar: {
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        verticalSliderSize: 10,
        horizontalSliderSize: 10,
    },
    padding: {
        top: 5,
        bottom: 5,
    },
    scrollBeyondLastLine: false,
    minimap: {
        enabled: false
    }
});

const openTab = 'app-ts';

function setActiveTab(tab: string) {
    appTsTab.classList.toggle('selected', tab === 'app-ts');
    appHtmlTab.classList.toggle('selected', tab === 'app-html');
    appCssTab.classList.toggle('selected', tab === 'app-css');

    if (tab === 'app-ts') {
        editor.setModel(tsModel);
    } else if (tab === 'app-html') {
        editor.setModel(htmlModel);
    } else if (tab === 'app-css') {
        editor.setModel(cssModel);
    }
}
setActiveTab(openTab);

appTsTab.addEventListener('click', () => setActiveTab('app-ts'));
appHtmlTab.addEventListener('click', () => setActiveTab('app-html'));
appCssTab.addEventListener('click', () => setActiveTab('app-css'));

const del = document.getElementById('delete');
del?.addEventListener('click', () => {
    console.log('Disposing model');
    htmlModel.dispose();
    console.log('Disposed', monaco.editor.getModels().map(m => m.uri.toString()));
});