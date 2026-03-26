import { WorkerManager as TSWorkerManager } from "monaco-editor/esm/vs/language/typescript/workerManager.js";
import { WorkerManager as HTMLWorkerManager } from "monaco-editor/esm/vs/language/html/workerManager.js";
import { Emitter } from 'monaco-editor/esm/vs/base/common/event.js';
import { DiagnosticsAdapter } from "monaco-editor/esm/vs/language/html/htmlMode.js";
import { editor } from "monaco-editor/esm/vs/editor/editor.api2.js";
import { createWebWorker } from "monaco-editor/esm/vs/common/workers.js";

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

function interceptTs(instance) {
  if (patched.has(instance)) return;
  patched.add(instance);
  if (instance._worker) {
    instance._worker.dispose();
    instance._worker = null;
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

function setupAngularWorker() {
  const origTs = Object.getOwnPropertyDescriptors(TSWorkerManager.prototype);
  const origHtml = Object.getOwnPropertyDescriptors(
    HTMLWorkerManager.prototype
  );
  const disposables = [];

  TSWorkerManager.prototype._getClient = function () {
    interceptTs(this);
    return getClient.call(this);
  };
  TSWorkerManager.prototype.getLanguageServiceWorker = function (...args) {
    interceptTs(this);
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

  const htmlWorker = (...uris) => {
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
    new DiagnosticsAdapter("html", htmlWorker, (cb) => emitter.event(cb))
  );
  disposables.push({ dispose: () => listeners.forEach((l) => l.dispose()) });

  return () => {
    Object.defineProperties(TSWorkerManager.prototype, origTs);
    Object.defineProperties(HTMLWorkerManager.prototype, origHtml);
    disposables.forEach((d) => d.dispose());
    tsInstance = null;
  };
}

export default setupAngularWorker;
