import ls from "@angular/language-service/bundles/language-service.js";
import { initialize } from "monaco-editor/esm/vs/common/initialize.js";
import { typescript } from "monaco-editor/esm/vs/language/typescript/lib/typescriptServices.js";
import { TypeScriptWorker } from "monaco-editor/esm/vs/language/typescript/ts.worker.js";
import { getLanguageService as getHTMLLanguageService } from "monaco-editor/esm/external/vscode-html-languageservice/lib/esm/htmlLanguageService.js";
import { TextDocument } from "monaco-editor/esm/external/vscode-languageserver-textdocument/lib/esm/main.js";
import path from "path-browserify-esm";

const stripFileProtocol = (p) => p.replace(/^file:\/\//, "");
const hasFileProtocol = (p) => p.startsWith("file://");
const addFileProtocol = (p) => "file://" + p;

const pathHandlers = {
  isAbsolute: (original) => (p) => hasFileProtocol(p) || original(p),

  resolve:
    (original) =>
    (...args) => {
      const cleaned = args.map((a) =>
        typeof a === "string" ? stripFileProtocol(a) : a
      );
      if (cleaned.length === 0 || !cleaned[0].startsWith("/")) {
        cleaned.unshift("/");
      }
      return addFileProtocol(original(...cleaned));
    },

  join:
    (original) =>
    (...args) => {
      const hadProtocol = args.some((a) => hasFileProtocol(a));
      const result = original(...args.map((a) => stripFileProtocol(a)));
      return hadProtocol ? addFileProtocol(result) : result;
    },

  relative: (original) => (from, to) =>
    original(stripFileProtocol(from), stripFileProtocol(to)),

  dirname: (original) => (p) =>
    hasFileProtocol(p)
      ? addFileProtocol(original(stripFileProtocol(p)))
      : original(p),

  basename: (original) => (p, ext) => original(stripFileProtocol(p), ext),

  extname: (original) => (p) => original(stripFileProtocol(p)),

  normalize: (original) => (p) =>
    hasFileProtocol(p)
      ? addFileProtocol(original(stripFileProtocol(p)))
      : original(p),
};

const wrappedPath = new Proxy(path, {
  get: (target, prop) => {
    const original = target[prop];
    if (typeof original !== "function") return original;
    if (prop in pathHandlers) return pathHandlers[prop](original);
    return original.bind ? original.bind(target) : original;
  },
});

function buildFileAccessor(worker) {
  const readFile = (fileName) => worker.getScriptText(fileName);
  const fileExists = (fileName) => worker.getScriptText(fileName) !== undefined;

  return {
    readFile,
    fileExists,
    readFileSync: (filePath) => {
      const content = readFile(filePath);
      if (content === undefined) {
        const error = new Error(
          `ENOENT: no such file or directory, open '${filePath}'`
        );
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
    existsSync: (filePath) => fileExists(filePath),
  };
}

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

function buildFsWrap(fileAccessor) {
  return {
    readFileSync: fileAccessor.readFileSync,
    existsSync: fileAccessor.existsSync,
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

function buildRequireWrap(fileAccessor) {
  const assert = buildAssert();
  const fs = buildFsWrap(fileAccessor);

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

function scriptKindFromExtension(fileName) {
  const ext = fileName.substring(fileName.lastIndexOf("."));
  if (ext === ".tsx" || ext === ".jsx") return typescript.ScriptKind.TSX;
  if (ext === ".js") return typescript.ScriptKind.JS;
  if (
    ext === ".html" ||
    ext === ".css" ||
    ext === ".scss" ||
    ext === ".less" ||
    ext === ".sass"
  )
    return typescript.ScriptKind.External;
  return typescript.ScriptKind.TS;
}

function buildProject(worker, virtualScriptInfos, fileAccessor) {
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
    readFile: fileAccessor.readFile,
    fileExists: fileAccessor.fileExists,
    // The language service used the createSourceFile function from the typescript services for its ngtypecheck files.
    // This probably means this will never be called so noop is fine, but making a note.
    writeFile: () => {},
    newLine: "\n",
    realpath: (p) => p,
  };

  const scriptInfoCache = new Map();

  const getScriptInfo = (fileName) => {
    if (virtualScriptInfos.has(fileName))
      return virtualScriptInfos.get(fileName);

    if (scriptInfoCache.has(fileName)) {
      if (fileAccessor.fileExists(fileName))
        return scriptInfoCache.get(fileName);
      scriptInfoCache.delete(fileName);
      return undefined;
    }

    if (!fileAccessor.fileExists(fileName)) return undefined;

    const info = new typescript.server.ScriptInfo(
      scriptInfoHost,
      fileName,
      scriptKindFromExtension(fileName),
      false,
      fileName
    );
    info.open(fileAccessor.readFile(fileName));
    scriptInfoCache.set(fileName, info);
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
    virtualScriptInfos.set(fileName, info);
    return info;
  };

  const project = {
    projectKind: typescript.server.ProjectKind.Inferred,
    getLanguageService: () => worker._languageService,
    getCompilationSettings: () => worker.getCompilationSettings(),
    getCompilerOptions: () => worker.getCompilationSettings(),
    getScriptFileNames: () => worker.getScriptFileNames(),
    getCurrentDirectory: () => "file:///",
    readFile: fileAccessor.readFile,
    fileExists: fileAccessor.fileExists,
    getScriptVersion: (fileName) => worker.getScriptVersion(fileName),
    readDirectory: () => [],
    // Need to read more about this to understand if this is right. Works for now so don't touch until then.
    getProjectName: () => "file:///inferred",
    getProjectReferences: () => null,
    getScriptInfo,
    containsScriptInfo: (scriptInfo) =>
      worker.getScriptFileNames().includes(scriptInfo.fileName),
    isRoot: (scriptInfo) =>
      worker.getScriptFileNames().includes(scriptInfo.fileName),
    addRoot: (scriptInfo) => {
      if (!virtualScriptInfos.has(scriptInfo.fileName)) return;
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
      getOrCreateScriptInfoForNormalizedPath: (
        fileName,
        openedByClient,
        fileContent,
        scriptKind
      ) => {
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
    // After looking it doesn't look like the standard tsworker does any caching of its own.
    // Admittedly the angular worker does seem to request more often, but it doesn't seem to add overhead.
    // So I'm going to skip this, but I'm leaving this as a note if the angular worker ends up being slow.
    //this.fetchingFromCache = false;
    this._angularLanguageService = null;
    this._virtualScriptInfos = new Map();
    this._htmlLanguageService = getHTMLLanguageService({
      useDefaultDataProvider: true,
    });
  }

  getScriptFileNames() {
    return [
      ...new Set([
        ...super.getScriptFileNames(),
        ...this._virtualScriptInfos.keys(),
      ]),
    ];
  }

  getScriptText(fileName) {
    const real = super._getScriptText(fileName);
    if (real !== undefined) return real;
    const snap = this._virtualScriptInfos.get(fileName)?.getSnapshot();
    return snap?.getText(0, snap.getLength());
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

  getTextDocument(uri) {
    let models = this._ctx.getMirrorModels();
    for (let model of models) {
      if (model.uri.toString() === uri) {
        return TextDocument.create(
          uri,
          "html",
          model.version,
          model.getValue()
        );
      }
    }
    return null;
  }

  getAngularLanguageService() {
    if (this._angularLanguageService) return this._angularLanguageService;

    const fileAccessor = buildFileAccessor(this);
    const requireWrap = buildRequireWrap(fileAccessor);

    document = { baseURI: "file:///" };
    require = requireWrap;
    process = buildProcessWrap();

    const plugin = ls({ typescript });

    const project = buildProject(this, this._virtualScriptInfos, fileAccessor);

    this._angularLanguageService = plugin.create({
      // TODO: Make this configurable.
      project,
      languageService: this._languageService,
      languageServiceHost: this,
      config: {
        angularOnly: false,
        forceStrictTemplates: true,
      },
      serverHost: {
        readFile: fileAccessor.readFile,
      },
    });

    return this._angularLanguageService;
  }

  async getSemanticDiagnostics(fileName) {
    try {
      console.log("getSemanticDiagnostics " + fileName);
      const diagnostics =
        this.getAngularLanguageService().getSemanticDiagnostics(fileName);
      const clearedDiagnostics = TypeScriptWorker.clearFiles(diagnostics).map(
        (d) => {
          // Strip this, can't be serialized and isn't used anyways.
          d.sourceFile = undefined;
          return d;
        }
      );
      return clearedDiagnostics;
    } catch (error) {
      console.warn("Angular diagnostics unavailable for", fileName, error);
      const diagnostics =
        this._languageService.getSemanticDiagnostics(fileName);
      return TypeScriptWorker.clearFiles(diagnostics);
    }
  }

  async getCompletionsAtPosition(fileName, position) {
    return (
      this.getAngularLanguageService().getCompletionsAtPosition(
        fileName,
        position,
        undefined
      ) ??
      this._languageService.getCompletionsAtPosition(
        fileName,
        position,
        undefined
      )
    );
  }

  async getQuickInfoAtPosition(fileName, position) {
    return (
      this.getAngularLanguageService().getQuickInfoAtPosition(
        fileName,
        position
      ) ?? this._languageService.getQuickInfoAtPosition(fileName, position)
    );
  }

  async getDefinitionAtPosition(fileName, position) {
    try {
      const result = this.getAngularLanguageService().getDefinitionAndBoundSpan(
        fileName,
        position
      );
      if (result?.definitions?.length) return result.definitions;
    } catch {}
    return (
      this._languageService.getDefinitionAtPosition(fileName, position) ?? []
    );
  }

  async getTypeDefinitionAtPosition(fileName, position) {
    try {
      const result =
        this.getAngularLanguageService().getTypeDefinitionAtPosition(
          fileName,
          position
        );
      if (result?.length) return result;
    } catch {}
    return (
      this._languageService.getTypeDefinitionAtPosition(fileName, position) ??
      []
    );
  }

  async getCompletionEntryDetails(
    fileName,
    position,
    entryName,
    formatOptions,
    preferences,
    data
  ) {
    try {
      const result = this.getAngularLanguageService().getCompletionEntryDetails(
        fileName,
        position,
        entryName,
        formatOptions,
        preferences,
        data
      );
      if (result) return result;
    } catch {}
    return this._languageService.getCompletionEntryDetails(
      fileName,
      position,
      entryName,
      formatOptions,
      preferences
    );
  }

  async getSignatureHelpItems(fileName, position, options) {
    try {
      const result = this.getAngularLanguageService().getSignatureHelpItems(
        fileName,
        position,
        options
      );
      if (result) return result;
    } catch {}
    return this._languageService.getSignatureHelpItems(
      fileName,
      position,
      options
    );
  }

  async getCodeFixesAtPosition(
    fileName,
    start,
    end,
    errorCodes,
    formatOptions,
    preferences
  ) {
    try {
      const ngFixes = this.getAngularLanguageService().getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences
      );
      if (ngFixes?.length) return ngFixes;
    } catch {}
    return (
      this._languageService.getCodeFixesAtPosition(
        fileName,
        start,
        end,
        errorCodes,
        formatOptions,
        preferences
      ) ?? []
    );
  }

  async getSuggestionDiagnostics(fileName) {
    try {
      const diagnostics =
        this.getAngularLanguageService().getSuggestionDiagnostics(fileName);
      return TypeScriptWorker.clearFiles(diagnostics).map((d) => {
        d.sourceFile = undefined;
        return d;
      });
    } catch {}
    return TypeScriptWorker.clearFiles(
      this._languageService.getSuggestionDiagnostics(fileName)
    );
  }

  async getEncodedSemanticClassifications(fileName, span, format) {
    try {
      const result =
        this.getAngularLanguageService().getEncodedSemanticClassifications(
          fileName,
          span,
          format
        );
      if (result?.spans?.length) return result;
    } catch {}
    return this._languageService.getEncodedSemanticClassifications(
      fileName,
      span,
      format
    );
  }

  async getOutliningSpans(fileName) {
    try {
      const result =
        this.getAngularLanguageService().getOutliningSpans(fileName);
      if (result?.length) return result;
    } catch {}
    return this._languageService.getOutliningSpans(fileName);
  }

  async doValidation(uri) {
    let document = this.getTextDocument(uri);
    // Angular needs the compilation settings for html validation.
    // We're fine without the initial check here, it will revalidate later.
    if (!document || !this.getCompilationSettings()) return [];

    const info = this._virtualScriptInfos.get(uri);
    if (info) {
      info.open(document.getText());
    } else {
      const scriptKind = scriptKindFromExtension(uri);
      const newInfo = new typescript.server.ScriptInfo(
        { useCaseSensitiveFileNames: false },
        uri,
        scriptKind,
        false,
        uri
      );
      newInfo.open(document.getText());
      this._virtualScriptInfos.set(uri, newInfo);
    }

    try {
      const diagnostics =
        this.getAngularLanguageService().getSemanticDiagnostics(uri);
      if (!diagnostics || diagnostics.length === 0) return [];

      return diagnostics.map((d) => {
        const start = document.positionAt(d.start ?? 0);
        const end = document.positionAt((d.start ?? 0) + (d.length ?? 0));
        const message =
          typeof d.messageText === "string"
            ? d.messageText
            : d.messageText.messageText;
        const severityMap = { 0: 2, 1: 1, 2: 4, 3: 3 };
        return {
          range: { start, end },
          message,
          severity: severityMap[d.category] ?? 1,
          code: d.code,
          source: "angular",
        };
      });
    } catch (error) {
      console.warn("Angular template validation unavailable for", uri, error);
      return [];
    }
  }

  async doComplete(uri, position) {
    let document = this.getTextDocument(uri);
    if (!document) return null;
    let htmlDocument = this._htmlLanguageService.parseHTMLDocument(document);
    return this._htmlLanguageService.doComplete(
      document,
      position,
      htmlDocument
    );
  }

  async format(uri, range, options) {
    let document = this.getTextDocument(uri);
    if (!document) return [];
    return this._htmlLanguageService.format(document, range, options);
  }

  async doHover(uri, position) {
    let document = this.getTextDocument(uri);
    if (!document) return null;
    let htmlDocument = this._htmlLanguageService.parseHTMLDocument(document);
    return this._htmlLanguageService.doHover(document, position, htmlDocument);
  }

  async findDocumentHighlights(uri, position) {
    let document = this.getTextDocument(uri);
    if (!document) return [];
    let htmlDocument = this._htmlLanguageService.parseHTMLDocument(document);
    return this._htmlLanguageService.findDocumentHighlights(
      document,
      position,
      htmlDocument
    );
  }

  async findDocumentLinks(uri) {
    let document = this.getTextDocument(uri);
    if (!document) return [];
    return this._htmlLanguageService.findDocumentLinks(document, null);
  }

  async findDocumentSymbols(uri) {
    let document = this.getTextDocument(uri);
    if (!document) return [];
    let htmlDocument = this._htmlLanguageService.parseHTMLDocument(document);
    return this._htmlLanguageService.findDocumentSymbols(
      document,
      htmlDocument
    );
  }

  async getFoldingRanges(uri, context) {
    let document = this.getTextDocument(uri);
    if (!document) return [];
    return this._htmlLanguageService.getFoldingRanges(document, context);
  }

  async getSelectionRanges(uri, positions) {
    let document = this.getTextDocument(uri);
    if (!document) return [];
    return this._htmlLanguageService.getSelectionRanges(document, positions);
  }

  async doRename(uri, position, newName) {
    let document = this.getTextDocument(uri);
    if (!document) return null;
    let htmlDocument = this._htmlLanguageService.parseHTMLDocument(document);
    return this._htmlLanguageService.doRename(
      document,
      position,
      newName,
      htmlDocument
    );
  }
}

self.onmessage = () => {
  initialize((ctx, createData) => {
    return new AngularWorker(ctx, createData);
  });
};
