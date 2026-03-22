import ls from "@angular/language-service/bundles/language-service.js";
import { initialize } from "monaco-editor/esm/vs/common/initialize.js";
import { typescript } from "monaco-editor/esm/vs/language/typescript/lib/typescriptServices.js";
import { TypeScriptWorker } from "monaco-editor/esm/vs/language/typescript/ts.worker.js";
import path from "path-browserify-esm";

const stripFileProtocol = (p) => p.replace(/^file:\/\//, "");
const hasFileProtocol = (p) => p.startsWith("file://");
const addFileProtocol = (p) => "file://" + p;

const pathHandlers = {
  isAbsolute: (original) => (p) => hasFileProtocol(p) || original(p),

  resolve: (original) => (...args) => {
    const cleaned = args.map((a) => (typeof a === "string" ? stripFileProtocol(a) : a));
    if (cleaned.length === 0 || !cleaned[0].startsWith("/")) {
      cleaned.unshift("/");
    }
    return addFileProtocol(original(...cleaned));
  },

  join: (original) => (...args) => {
    const hadProtocol = args.some((a) => hasFileProtocol(a));
    const result = original(...args.map((a) => stripFileProtocol(a)));
    return hadProtocol ? addFileProtocol(result) : result;
  },

  relative: (original) => (from, to) =>
    original(stripFileProtocol(from), stripFileProtocol(to)),

  dirname: (original) => (p) =>
    hasFileProtocol(p) ? addFileProtocol(original(stripFileProtocol(p))) : original(p),

  basename: (original) => (p, ext) => original(stripFileProtocol(p), ext),

  extname: (original) => (p) => original(stripFileProtocol(p)),

  normalize: (original) => (p) =>
    hasFileProtocol(p) ? addFileProtocol(original(stripFileProtocol(p))) : original(p),
};

const wrappedPath = new Proxy(path, {
  get: (target, prop) => {
    const original = target[prop];
    if (typeof original !== "function") return original;
    if (prop in pathHandlers) return pathHandlers[prop](original);
    return original.bind ? original.bind(target) : original;
  },
});

function buildAssert() {
  const assert = (condition, msg) => {
    if (!condition) throw new Error(msg ?? "failed");
  };
  assert.ok = (v) => {
    if (!v) throw new Error("failed");
  };
  assert.fail = (msg) => {
    throw new Error(msg ?? "failed");
  };
  return assert;
}

function buildFsWrap(getScriptText) {
  return {
    readFileSync: (filePath) => {
      const content = getScriptText(filePath);
      if (content === undefined) {
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
    existsSync: (filePath) => getScriptText(filePath) !== undefined,
    statSync: () => ({
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
    }),
    lstatSync: () => ({
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
    }),
    readdirSync: () => [],
    realpathSync: (filePath) => filePath,
    writeFileSync: () => {},
    mkdirSync: () => {},
    rmdirSync: () => {},
    renameSync: () => {},
    copyFileSync: () => {},
    symlinkSync: () => {},
    unlinkSync: () => {},
  };
}

function buildProcessWrap() {
  return {
    ...globalThis.process,
    platform: "linux",
    env: {},
    argv: [],
    versions: { node: "20.0.0" },
    cwd: () => "/",
    memoryUsage: () => {
      const mem = performance?.memory;
      return {
        rss: mem?.totalJSHeapSize || 0,
        heapTotal: mem?.totalJSHeapSize || 0,
        heapUsed: mem?.usedJSHeapSize || 0,
        external: 0,
        arrayBuffers: 0,
      };
    },
    hrtime: (prev) => {
      const now = performance.now();
      const sec = Math.floor(now / 1000);
      const nano = Math.floor((now % 1000) * 1e6);
      if (prev) {
        let diffSec = sec - prev[0];
        let diffNano = nano - prev[1];
        if (diffNano < 0) {
          diffSec -= 1;
          diffNano += 1e9;
        }
        return [diffSec, diffNano];
      }
      return [sec, nano];
    },
    nextTick: (cb) => setTimeout(cb, 0),
    stdout: { write: () => {} },
    stderr: { write: () => {} },
    exit: () => {},
    on: () => {},
    off: () => {},
    emit: () => {},
  };
}

function buildRequireWrap(getScriptText) {
  const assert = buildAssert();
  const fs = buildFsWrap(getScriptText);

  const wrappedRequire = (moduleName) => {
    const normalised = moduleName.replace(/^node:/, "");
    const moduleOverrides = {
      typescript,
      fs,
      os: {},
      path: wrappedPath,
      "node:path": wrappedPath,
      url: {
        fileURLToPath: (u) => stripFileProtocol(u),
        pathToFileURL: (p) => ({
          href: hasFileProtocol(p) ? p : addFileProtocol(p),
        }),
        URL: globalThis.URL,
      },
      module: { createRequire: () => wrappedRequire },
      assert,
    };
    if (!(normalised in moduleOverrides)) {
      throw new Error(
        `Something went wrong getting the angular language service modules. Make a note of the following module name and report it as missing: ${moduleName}`
      );
    }
    return moduleOverrides[normalised];
  };

  return wrappedRequire;
}

function buildProject(worker, scriptInfoMap) {
  const logger = {
    info: () => {},
    msg: () => {},
    loggingEnabled: () => false,
    hasLevel: () => false,
    getLogFileName: () => undefined,
    close: () => {},
  };

  const scriptInfoHost = {
    useCaseSensitiveFileNames: false,
    readFile: (fileName) => worker._getScriptText(fileName),
    fileExists: (fileName) => worker._getScriptText(fileName) !== undefined,
    writeFile: () => {},
    newLine: "\n",
    realpath: (p) => p,
  };

  const getScriptInfo = (fileName) => {
    if (scriptInfoMap.has(fileName)) return scriptInfoMap.get(fileName);
    if (worker._getScriptText(fileName) === undefined) return undefined;

    const ext = fileName.substring(fileName.lastIndexOf("."));
    let scriptKind = typescript.ScriptKind.TS;
    if (ext === ".tsx" || ext === ".jsx") scriptKind = typescript.ScriptKind.TSX;
    else if (ext === ".js") scriptKind = typescript.ScriptKind.JS;

    const info = new typescript.server.ScriptInfo(
      scriptInfoHost,
      fileName,
      scriptKind,
      false,
      fileName
    );
    info.open(worker._getScriptText(fileName));
    scriptInfoMap.set(fileName, info);
    return info;
  };

  const createScriptInfo = (fileName, content, scriptKind) => {
    const info = new typescript.server.ScriptInfo(
      scriptInfoHost,
      fileName,
      scriptKind ?? typescript.ScriptKind.External,
      false,
      fileName
    );
    info.open(content ?? "");
    scriptInfoMap.set(fileName, info);
    return info;
  };

  const rootFileNames = new Set(worker.getScriptFileNames());

  const project = {
    projectKind: typescript.server.ProjectKind.Inferred,
    getLanguageService: () => worker._languageService,
    getCompilationSettings: () => worker.getCompilationSettings(),
    getCompilerOptions: () => worker.getCompilationSettings(),
    getScriptFileNames: () => [...rootFileNames],
    getCurrentDirectory: () => "file:///",
    readFile: (filePath) => worker._getScriptText(filePath),
    fileExists: (filePath) => worker._getScriptText(filePath) !== undefined,
    getScriptVersion: (fileName) => worker.getScriptVersion(fileName),
    readDirectory: () => [],
    getProjectName: () => "file:///inferred",
    getProjectReferences: () => null,
    getScriptInfo,
    containsScriptInfo: (scriptInfo) => rootFileNames.has(scriptInfo.fileName),
    addRoot: (scriptInfo) => {
      rootFileNames.add(scriptInfo.fileName);
      scriptInfo.attachToProject(project);
    },
    onFileAddedOrRemoved: () => {},
    markFileAsDirty: () => {},
    markAsDirty: () => {},
    toPath: (fileName) => fileName,
    projectService: {
      logger,
      toCanonicalFileName: (fileName) => fileName,
      getScriptInfo,
      getOrCreateScriptInfoForNormalizedPath: (fileName, openedByClient, fileContent, scriptKind) => {
        const existing = getScriptInfo(fileName);
        if (existing) return existing;
        return createScriptInfo(fileName, fileContent, scriptKind);
      },
    },
  };

  return project;
}

class AngularWorker extends TypeScriptWorker {
  constructor(ctx, createData) {
    super(ctx, createData);
    this.angularLanguageService = null;
    this._virtualScriptInfos = new Map();
  }

  getScriptFileNames() {
    return [...(new Set([...super.getScriptFileNames(), ...this._virtualScriptInfos.keys()]))];
  }

  _getScriptText(fileName) {
    let script = super._getScriptText(fileName);
    if (script) return script;
    const snap = this._virtualScriptInfos.get(fileName)?.getSnapshot();
    script = snap?.getText(0, snap.getLength());
    return script;
  }

  getScriptSnapshot(fileName) {
    const real = super.getScriptSnapshot(fileName);
    if (real) return real;
    const info = this._virtualScriptInfos.get(fileName);
    if (info) return info.getSnapshot();
    return undefined;
  }

  getScriptVersion(fileName) {
    const real = super.getScriptVersion(fileName);
    if (real) return real;
    const info = this._virtualScriptInfos.get(fileName);
    if (info) return info.getLatestVersion();
    return "";
  }

  getScriptKind(fileName) {
    if (this._virtualScriptInfos.has(fileName)) {
      return this._virtualScriptInfos.get(fileName).scriptKind;
    }
    return super.getScriptKind(fileName);
  }

  getAngularLanguageService() {
    if (this.angularLanguageService) return this.angularLanguageService;

    const requireWrap = buildRequireWrap((filePath) => this._getScriptText(filePath));

    document = { baseURI: "file:///" };
    require = requireWrap;
    process = buildProcessWrap();

    const plugin = ls({ typescript });

    const project = buildProject(this, this._virtualScriptInfos);

    this.angularLanguageService = plugin.create({
      project,
      languageService: this._languageService,
      languageServiceHost: this,
      config: {
        angularOnly: false,
        forceStrictTemplates: true,
      },
      serverHost: {
        readFile: (filePath) => this._getScriptText(filePath),
      },
    });

    return this.angularLanguageService;
  }

  async getSemanticDiagnostics(fileName) {
    try {
      const diagnostics = this.getAngularLanguageService().getSemanticDiagnostics(fileName);
      const clearedDiagnostics = TypeScriptWorker.clearFiles(diagnostics).map((d) => {
        d.sourceFile = undefined;
        return d;
      });
      return clearedDiagnostics;
    } catch (error) {
      console.warn("Angular diagnostics unavailable for", fileName, error);
      const diagnostics = this._languageService.getSemanticDiagnostics(fileName);
      return TypeScriptWorker.clearFiles(diagnostics);
    }
  }

  async getCompletionsAtPosition(fileName, position) {
    return (
      this.getAngularLanguageService().getCompletionsAtPosition(fileName, position, undefined) ??
      this._languageService.getCompletionsAtPosition(fileName, position, undefined)
    );
  }

  async getQuickInfoAtPosition(fileName, position) {
    return (
      this.getAngularLanguageService().getQuickInfoAtPosition(fileName, position) ??
      this._languageService.getQuickInfoAtPosition(fileName, position)
    );
  }
}

self.onmessage = () => {
  initialize((ctx, createData) => {
    console.log("Initializing Angular Worker with context", ctx, "and createData", createData);
    return new AngularWorker(ctx, createData);
  });
};