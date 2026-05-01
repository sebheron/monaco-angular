import { WorkerManager as TSWorkerManager } from "monaco-editor/esm/vs/language/typescript/workerManager.js";
import { WorkerManager as HTMLWorkerManager } from "monaco-editor/esm/vs/language/html/workerManager.js";
import { Emitter } from 'monaco-editor/esm/vs/base/common/event.js';
import { DiagnosticsAdapter } from "monaco-editor/esm/vs/language/common/lspLanguageFeatures.js";
import { editor, languages } from "monaco-editor";
import { createWebWorker } from "monaco-editor/esm/vs/common/workers.js";
import { typescript } from "monaco-editor/esm/vs/language/typescript/lib/typescriptServices.js";

const { TokenType, TokenModifier } = typescript.classifier.v2020;

const tokenTypes = Object.keys(TokenType).filter(k => isNaN(Number(k)));
const tokenModifiers = Object.keys(TokenModifier).filter(k => isNaN(Number(k)));

const ALL_LANGUAGES = new Set([
  "typescript",
  "html",
  "css",
  "scss",
  "less",
  "stylus",
  "sass",
]);

let tsInstance = null;
const patched = new WeakSet();

function createSemanticTokensProvider(getWorker) {
  return {
    getLegend() {
      return {
        tokenTypes,
        tokenModifiers,
      };
    },

    async provideDocumentSemanticTokens(model) {
      const worker = await getWorker(model.uri);
      const result = await worker.getEncodedSemanticClassifications(
        model.uri.toString(),
        { start: 0, length: model.getValue().length },
        '2020'
      );

      if (!result?.spans?.length) return null;

      const data = [];
      let prevLine = 0;
      let prevChar = 0;

      for (let i = 0; i < result.spans.length; i += 3) {
        const start = result.spans[i];
        const length = result.spans[i + 1];
        const classification = result.spans[i + 2];

        const tokenType = (classification >> 8) - 1;
        const tokenModifiers = classification & 0xFF;

        if (tokenType < 0) continue;

        const pos = model.getPositionAt(start);
        const line = pos.lineNumber - 1;
        const char = pos.column - 1;

        const deltaLine = line - prevLine;
        const deltaStart = deltaLine === 0 ? char - prevChar : char;

        data.push(deltaLine, deltaStart, length, tokenType, tokenModifiers);
        prevLine = line;
        prevChar = char;
      }

      return { data: new Uint32Array(data) };
    },

    releaseDocumentSemanticTokens() {}
  };
}

function getClient() {
  if (!this._client) {
    this._client = (async () => {
      this._worker = createWebWorker({
        // Module id needs to match tsWorker
        moduleId: "vs/language/typescript/tsWorker",
        createWorker: () =>
          new Worker(new URL("./monaco-angular.worker.js", import.meta.url), {
            type: "module",
          }),
        label: this._modeId,
        keepIdleModels: true,
        createData: {
          compilerOptions: this._defaults.getCompilerOptions(),
          extraLibs: this._defaults.getExtraLibs(),
          customWorkerPath: this._defaults.workerOptions.customWorkerPath,
          inlayHintsOptions: this._defaults.inlayHintsOptions,
        },
      });
      if (this._defaults.getEagerModelSync()) {
        return await this._worker.withSyncedResources(
          editor.getModels().map((model) => model.uri)
        );
      }
      return await this._worker.getProxy();
    })();
  }
  return this._client;
}

function getLanguageServiceWorker(...resources) {
  if (!this._defaults.getCompilerOptions()) return;
  return (async () => {
    const client = await this._getClient();
    if (this._worker) {
      if (resources.some((res) => String(res).endsWith(".html"))) {
        await this._worker.withSyncedResources(resources);
      } else {
        await syncAllLanguages.call(this);
      }
    }
    return client;
  })();
}

function syncAllLanguages() {
  return this._worker.withSyncedResources(
    editor
      .getModels()
      .filter((model) => ALL_LANGUAGES.has(model.getLanguageId()))
      .map((model) => model.uri)
  );
}

function interceptTs(instance, angularConfig) {
  if (patched.has(instance)) return;
  patched.add(instance);
  if (instance._worker) {
    instance._worker.dispose();
    instance._worker = null;
  }
  if (instance._defaults.getCompilerOptions) {
    const optsFn = instance._defaults.getCompilerOptions;
    instance._defaults.getCompilerOptions = function () {
      return {
        ...optsFn.call(this),
        angularConfig: angularConfig,
      }
    }
  }
  instance._client = null;
  tsInstance = instance;
}

function interceptHtml(instance) {
  if (patched.has(instance)) return;
  patched.add(instance);
  if (instance._worker) {
    instance._worker.dispose();
    instance._worker = null;
  }
  instance._client = null;
  if (instance._idleCheckInterval) clearInterval(instance._idleCheckInterval);
  if (instance._configChangeListener) instance._configChangeListener.dispose();
}

function waitForTs() {
  if (tsInstance) return Promise.resolve(tsInstance);
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (tsInstance) {
        clearInterval(check);
        resolve(tsInstance);
      }
    }, 50);
  });
}

function setupAngularWorker(config = { strictTemplates: true }) {
  // Strip stuff that can't be serialized.
  const strippedConfig = JSON.parse(JSON.stringify(config));

  const origTs = Object.getOwnPropertyDescriptors(TSWorkerManager.prototype);
  const origHtml = Object.getOwnPropertyDescriptors(
    HTMLWorkerManager.prototype
  );
  const disposables = [];

  TSWorkerManager.prototype._getClient = function () {
    interceptTs(this, strippedConfig);
    return getClient.call(this);
  };
  TSWorkerManager.prototype.getLanguageServiceWorker = function (...args) {
    interceptTs(this, strippedConfig);
    return getLanguageServiceWorker.call(this, ...args);
  };

  HTMLWorkerManager.prototype._getClient = function () {
    interceptHtml(this);
    return waitForTs().then((ts) => ts._getClient());
  };
  HTMLWorkerManager.prototype.getLanguageServiceWorker = function (
    ...resources
  ) {
    interceptHtml(this);
    return waitForTs().then((ts) => ts.getLanguageServiceWorker(...resources));
  };
  HTMLWorkerManager.prototype.dispose = function () {
    interceptHtml(this);
  };
  // No-op for stopping/idle checking, sharing a worker now and the html worker usually stops itself intermittently.
  HTMLWorkerManager.prototype._stopWorker = function () {};
  HTMLWorkerManager.prototype._checkIfIdle = function () {};

  const sharedWorker = (...uris) => {
    return waitForTs().then((ts) => ts.getLanguageServiceWorker(...uris));
  };

  const emitter = new Emitter();
  const listeners = new Map();

  const watch = (model) => {
    if (model.getLanguageId() === "html" || listeners.has(model.uri.toString()))
      return;
    listeners.set(
      model.uri.toString(),
      model.onDidChangeContent(() => emitter.fire())
    );
  };

  const unwatch = (model) => {
    const key = model.uri.toString();
    listeners.get(key)?.dispose();
    listeners.delete(key);
  };

  editor.getModels().forEach(watch);
  disposables.push(editor.onDidCreateModel(watch));
  disposables.push(editor.onWillDisposeModel(unwatch));
  disposables.push(editor.onDidChangeModelLanguage((e) => {
    unwatch(e.model);
    watch(e.model);
  }));
  disposables.push(
    new DiagnosticsAdapter("html", sharedWorker, (cb) => emitter.event(cb))
  );
  disposables.push({ dispose: () => listeners.forEach((l) => l.dispose()) });
  disposables.push(
    languages.registerDocumentSemanticTokensProvider(
      'typescript', createSemanticTokensProvider(sharedWorker)
    )
  );
  disposables.push(
    languages.registerDocumentSemanticTokensProvider(
      'html', createSemanticTokensProvider(sharedWorker)
    )
  );

  return () => {
    Object.defineProperties(TSWorkerManager.prototype, origTs);
    Object.defineProperties(HTMLWorkerManager.prototype, origHtml);
    disposables.forEach((d) => d.dispose());
    tsInstance = null;
  };
}

export default setupAngularWorker;
