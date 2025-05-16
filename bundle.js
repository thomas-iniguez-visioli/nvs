"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// lib/error.js
var require_error = __commonJS({
  "lib/error.js"(exports2, module2) {
    "use strict";
    var Error22 = class _Error2 extends Error {
      /**
       * Convenient replacement for the Error constructor that allows
       * supplying a cause (another error object) or a code.
       *
       * @param {string} message Error message
       * @param {Error | string} [causeOrCode] Error cause or code
       */
      constructor(message, causeOrCode) {
        super(message);
        Error.captureStackTrace(this, _Error2);
        if (causeOrCode) {
          if (typeof causeOrCode === "object") {
            this.cause = causeOrCode;
            this.code = causeOrCode["code"];
          } else if (typeof causeOrCode === "string") {
            this.code = causeOrCode;
          }
        }
      }
    };
    function throwIfNot(expectedCode, e, message) {
      if (e["code"] !== expectedCode) {
        if (message) {
          e = new Error22(message, e);
        }
        Error.captureStackTrace(e, throwIfNot);
        throw e;
      }
    }
    Error22.throwIfNot = throwIfNot;
    Error22.EEXIST = "EEXIST";
    Error22.ENOENT = "ENOENT";
    Error22.EPERM = "EPERM";
    Error22.EACCES = "EACCES";
    Error22.EIO = "EIO";
    module2.exports = Error22;
  }
});

// lib/windowsEnv.js
var require_windowsEnv = __commonJS({
  "lib/windowsEnv.js"(exports2, module2) {
    "use strict";
    var childProcess = require("child_process");
    var Error3 = require_error();
    var userEnvRegKey = "HKCU\\Environment";
    var systemEnvRegKey = "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment";
    var queryRegex = /^ *\w+ +REG(_EXPAND)?_SZ *([^ ].*)$/;
    function getEnvironmentVariable(name, isSystem) {
      let regKey = isSystem ? systemEnvRegKey : userEnvRegKey;
      let regLabel = isSystem ? "system" : "user";
      let regValueTypes = /path/i.test(name) ? ["REG_EXPAND_SZ", "REG_SZ"] : ["REG_SZ", "REG_EXPAND_SZ"];
      let value = null;
      for (let i = 0; i < regValueTypes.length && !value; i++) {
        let child = childProcess.spawnSync(
          "reg.exe",
          ["QUERY", regKey, "/V", name, "/T", regValueTypes[i]],
          { stdio: "pipe" }
        );
        if (child.error) {
          throw new Error3("Failed to read from " + regLabel + " registry.", child.error);
        }
        let output = child.stdout.toString().trim().split(/\r?\n/);
        let match = queryRegex.exec(output[1]);
        value = match ? match[2] : null;
      }
      return value;
    }
    function setEnvironmentVariable(name, value, isSystem) {
      let regKey = isSystem ? systemEnvRegKey : userEnvRegKey;
      let regLabel = isSystem ? "system" : "user";
      let regValueType = /path/i.test(name) || /%/.test(value) ? "REG_EXPAND_SZ" : "REG_SZ";
      let args = value !== null ? ["ADD", regKey, "/V", name, "/T", regValueType, "/D", value, "/F"] : ["DELETE", regKey, "/V", name, "/F"];
      let child = childProcess.spawnSync("reg.exe", args, { stdio: "pipe" });
      if (child.error) {
        throw new Error3("Failed to write to " + regLabel + " registry.", child.error);
      } else if (child.status) {
        let message = child.stderr.toString().trim().replace(/^ERROR: */, "") || "Reg.exe exited with code: " + child.status;
        let code = /denied/.test(message) ? "EPERM" : void 0;
        throw new Error3(
          "Failed to write to " + regLabel + " registry key: " + regKey,
          new Error3(message, code)
        );
      }
      let tempValue = getEnvironmentVariable("TEMP", isSystem);
      child = childProcess.spawnSync(
        "setx.exe",
        isSystem ? ["TEMP", tempValue, "/M"] : ["TEMP", tempValue],
        { stdio: "ignore" }
      );
      if (child.error) {
        throw new Error3(
          "Failed broadcast " + regLabel + " environment change.",
          child.error
        );
      } else if (child.status) {
        throw new Error3(
          "Failed broadcast " + regLabel + " environment change.",
          new Error3("Setx.exe exited with code: " + child.status)
        );
      }
    }
    function posixPathToWindowsPath(path) {
      if (/^\/[a-z]\//i.test(path)) {
        path = path.substr(1, 1).toUpperCase() + ":" + path.substr(1);
      }
      return path.replace(/\//g, "\\");
    }
    function windowsPathToPosixPath(path) {
      if (/^([A-Z]):\\/i.test(path)) {
        path = "/" + path.substr(0, 1).toLowerCase() + path.substr(2);
      }
      return path.replace(/\\/g, "/");
    }
    function windowsPathListToPosixPathList(pathList) {
      return pathList.split(";").map(windowsPathToPosixPath).join(":");
    }
    module2.exports = {
      getEnvironmentVariable,
      setEnvironmentVariable,
      posixPathToWindowsPath,
      windowsPathToPosixPath,
      windowsPathListToPosixPathList
    };
  }
});

// defaults.json
var require_defaults = __commonJS({
  "defaults.json"(exports2, module2) {
    module2.exports = {
      aliases: {},
      remotes: {
        default: "node",
        node: "https://nodejs.org/dist/"
      },
      bootstrap: "node/23.11.0"
    };
  }
});

// lib/version.js
var require_version = __commonJS({
  "lib/version.js"(exports2, module2) {
    "use strict";
    var path = require("path");
    var os2 = require("os");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var versionRegex = /^(([\w-]+)\/)?((v?(\d+(\.\d+(\.\d+)?)?(-[0-9A-Za-z.-]+)?))|([a-z][a-z_-][0-9a-z_-]*|\*))(\/((x86)|(32)|((x)?64)|(arm\w*)|(ppc\w*)|(s390x)))?$/i;
    var NodeVersion = class _NodeVersion {
      constructor(remoteName, semanticVersion, arch) {
        this.remoteName = remoteName;
        this.semanticVersion = semanticVersion;
        this.arch = arch;
        this.os = void 0;
        this.label = void 0;
        this.path = void 0;
        this.current = void 0;
        this.default = void 0;
        this.local = void 0;
        this.packages = void 0;
        this.ext = void 0;
        this.uri = void 0;
        this.shasumUri = void 0;
      }
      static get defaultOs() {
        let os3 = process.platform.toString();
        if (os3 === "win32") {
          os3 = "win";
        }
        return os3;
      }
      static get defaultArch() {
        return _NodeVersion._standardArchName(process.arch);
      }
      /**
       * Parses a node version string into remote name, semantic version, and architecture
       * components. Infers some unspecified components based on configuration.
       * @param {string} versionString
       * @param {boolean} [requireFull=false]
       */
      static parse(versionString, requireFull) {
        if (!versionString) {
          throw new Error3("A version parameter is required.");
        }
        let versionParts = versionString.split("/");
        if (versionParts.length < 3 && !requireFull) {
          let resolvedVersion = settings2.aliases[versionParts[0]];
          if (resolvedVersion) {
            if (path.isAbsolute(resolvedVersion)) {
              let version2 = new _NodeVersion();
              version2.label = versionParts[0];
              version2.path = resolvedVersion;
              return version2;
            } else {
              versionString = resolvedVersion;
              if (versionParts.length === 2) {
                versionString += "/" + versionParts[1];
              }
            }
          }
        }
        let match = versionRegex.exec(versionString);
        if (!match) {
          throw new Error3("Invalid version string: " + versionString);
        }
        let remoteName = match[2] || null;
        let semanticVersion = match[5] || null;
        let label = match[9];
        let arch = match[11];
        if (requireFull) {
          if (!remoteName) {
            throw new Error3("A remote name is required.");
          }
          if (!arch) {
            throw new Error3("A processor architecture is required.");
          }
          if (!/\d+\.\d+\.\d+/.test(semanticVersion)) {
            throw new Error3("A complete semantic version is required.");
          }
        }
        if (!remoteName && label && label !== "default" && settings2.remotes && settings2.remotes[label]) {
          remoteName = label;
          label = void 0;
        }
        if (!remoteName && label !== "current" && label !== "default") {
          remoteName = "default";
        }
        if (settings2.remotes) {
          if (remoteName === "default") {
            remoteName = settings2.remotes["default"] || "node";
          } else if (remoteName === "lts" && !semanticVersion) {
            remoteName = settings2.remotes["default"] || "node";
            if (label === "*") {
              label = "lts";
            }
          }
        }
        if ((!settings2.remotes || !settings2.remotes[remoteName]) && label !== "current" && label !== "default") {
          throw new Error3("Remote name not found in settings.json: " + remoteName);
        }
        if (arch) {
          arch = _NodeVersion._standardArchName(arch);
        }
        let version = new _NodeVersion(remoteName, semanticVersion);
        version.label = label;
        version.arch = arch;
        return version;
      }
      static _standardArchName(arch) {
        switch (arch) {
          case "32":
          case "x86":
          case "ia32":
            return "x86";
          case "64":
          case "x64":
          case "amd64":
            return "x64";
          case "ppc64":
            return os2.endianness() === "LE" ? "ppc64le" : "ppc64";
          case "arm":
            return process.config.variables["arm_version"] ? "armv" + process.config.variables["arm_version"] + "l" : "arm";
          default:
            return arch;
        }
      }
      /**
       * Attempts to parse a version string into parts; returns null on failure instead of throwing
       * an error.
       */
      static tryParse(versionString) {
        try {
          return _NodeVersion.parse(versionString);
        } catch (e) {
          return null;
        }
      }
      /**
       * Tests if two node version structures are equal.
       */
      static equal(versionA, versionB) {
        return versionA.remoteName === versionB.remoteName && versionA.semanticVersion === versionB.semanticVersion && versionA.arch === versionB.arch && versionA.os === versionB.os && versionA.path === versionB.path;
      }
      /**
       * Sorts versions in descending order, grouped by remote name.
       */
      static compare(versionA, versionB) {
        if (versionA.path || versionB.path) {
          if (!versionA.path) return -1;
          if (!versionB.path) return 1;
          let pathA = versionA.path.toLowerCase();
          let pathB = versionB.path.toLowerCase();
          return pathA === pathB ? 0 : pathA < pathB ? -1 : 1;
        }
        let remoteNames = Object.keys(settings2.remotes);
        let remoteIndexA = remoteNames.indexOf(versionA.remoteName);
        let remoteIndexB = remoteNames.indexOf(versionB.remoteName);
        if (remoteIndexA !== remoteIndexB) {
          return remoteIndexA < remoteIndexB ? -1 : 1;
        }
        if (versionA.semanticVersion !== versionB.semanticVersion) {
          if (!versionA.semanticVersion) {
            return -1;
          } else if (!versionB.semanticVersion) {
            return 1;
          }
          let semverA = _NodeVersion._parseSemver(versionA.semanticVersion);
          let semverB = _NodeVersion._parseSemver(versionB.semanticVersion);
          if (semverA.major !== semverB.major) {
            return semverA.major < semverB.major ? 1 : -1;
          } else if (semverA.minor !== semverB.minor) {
            return semverA.minor < semverB.minor ? 1 : -1;
          } else if (semverA.patch !== semverB.patch) {
            return semverA.patch < semverB.patch ? 1 : -1;
          } else if (semverA.label && !semverB.label) {
            return 1;
          } else if (!semverA.label && semverB.label) {
            return -1;
          } else if (semverA.label && semverB.label) {
            return semverA.label < semverB.label ? 1 : -1;
          }
        }
        if (!versionA.arch || !versionB.arch) {
          return versionA.arch ? 1 : versionB.arch ? -1 : 0;
        }
        if (versionA.arch.toLowerCase() !== versionB.arch.toLowerCase()) {
          return versionA.arch.toLowerCase() < versionB.arch.toLowerCase() ? -1 : 1;
        }
        return 0;
      }
      static _parseSemver(v) {
        let semver = {};
        let hyphenIndex = v.indexOf("-");
        if (hyphenIndex >= 0) {
          semver.label = v.substr(hyphenIndex + 1);
          v = v.substr(0, hyphenIndex);
        }
        let parts = v.split(".");
        semver.major = parts[0] ? 1 * parts[0] : 0;
        semver.minor = parts[1] ? 1 * parts[1] : 0;
        semver.patch = parts[2] ? 1 * parts[2] : 0;
        return semver;
      }
      /**
      * Get the binary name to be used based on version passed.
      * 'node' for version 0.X or 4.X and above
      * 'iojs' for version 1.X, 2.X and 3.X
      */
      static getBinaryNameFromVersion(semanticVersion) {
        if (/^1\./.test(semanticVersion) || /^2\./.test(semanticVersion) || /^3\./.test(semanticVersion)) {
          return "iojs";
        } else {
          return "node";
        }
      }
      /**
       * Tests if a partial version (filter) matches a specific version.
       */
      match(specificVersion) {
        return (!this.remoteName || this.remoteName === specificVersion.remoteName) && (!this.semanticVersion || this.semanticVersion === specificVersion.semanticVersion || specificVersion.semanticVersion.startsWith(this.semanticVersion + ".") || specificVersion.semanticVersion.startsWith(this.semanticVersion + "-")) && (!this.label || specificVersion.label && this.label.toLowerCase() === specificVersion.label.toLowerCase()) && (!this.arch || !specificVersion.arch || this.arch === specificVersion.arch) && (!this.os || !specificVersion.os || this.os === specificVersion.os);
      }
      /**
       * Formats a version as a string, optionally including the version label.
       */
      toString(options) {
        return (options && options.marks ? this.current && this.default ? ">#" : this.current ? " >" : this.default ? " #" : this.local ? " *" : "  " : "") + (this.path ? this.path : this.remoteName + (this.semanticVersion || this.label ? "/" + (this.semanticVersion || this.label) : "")) + (this.os && options && options.os ? "/" + this.os : "") + (this.arch ? "/" + this.arch : "") + (options && options.label && (this.semanticVersion || this.path) && this.label ? " (" + this.label + ")" : "");
      }
      get defaultArch() {
        switch (process.platform) {
          case "darwin":
            if (process.arch === "x64" && os2.version().includes("_ARM64_") && this.semanticVersion && Number(this.semanticVersion.split(".")[0]) >= 16) {
              return _NodeVersion._standardArchName("arm64");
            }
            return _NodeVersion.defaultArch;
          default:
            return _NodeVersion.defaultArch;
        }
        ;
      }
    };
    module2.exports = NodeVersion;
  }
});

// lib/settings.js
var require_settings = __commonJS({
  "lib/settings.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var os2 = require("os");
    var path = require("path");
    var Error3 = require_error();
    var settings2 = {};
    function getHomeDir() {
      let homeDir = process.env["NVS_HOME"];
      if (!homeDir) {
        homeDir = path.resolve(path.join(__dirname, ".."));
      } else if (process.platform === "win32" && homeDir && homeDir.indexOf("/") >= 0) {
        homeDir = require_windowsEnv().posixPathToWindowsPath(homeDir);
      }
      if (!homeDir.endsWith(path.sep)) {
        homeDir += path.sep;
      }
      return homeDir;
    }
    function loadSettings() {
      let homeDir = getHomeDir();
      let settingsFile = path.join(homeDir, "settings.json");
      const defaultSettings = require_defaults();
      Object.keys(defaultSettings).forEach((key) => {
        settings2[key] = defaultSettings[key];
      });
      try {
        const loadedSettings = JSON.parse(fs.readFileSync(settingsFile).toString());
        Object.keys(loadedSettings).forEach((key) => {
          settings2[key] = loadedSettings[key];
        });
      } catch (e) {
        if (e.code === Error3.ENOENT) {
          settings2.home = homeDir;
          try {
            saveSettings();
          } catch (e2) {
            if (e2.code !== Error3.EPERM && e2.code !== Error3.EACCES) {
              throw e2;
            }
          }
        } else {
          throw new Error3("Failed to read settings file: " + settingsFile, e);
        }
      }
      settings2.aliases = settings2.aliases || {};
      settings2.remotes = settings2.remotes || {};
      settings2.home = homeDir;
      settings2.cache = path.join(homeDir, "cache");
      if (!fs.existsSync(settings2.cache)) {
        fs.mkdirSync(settings2.cache);
      }
    }
    function saveSettings() {
      let homeDir = settings2.home;
      let cacheDir = settings2.cache;
      delete settings2.home;
      delete settings2.cache;
      delete settings2.bootstrap;
      let settingsFile = path.join(homeDir, "settings.json");
      try {
        if (!fs.existsSync(homeDir)) {
          fs.mkdirSync(homeDir);
        }
        fs.writeFileSync(settingsFile, JSON.stringify(settings2, null, "	"));
      } catch (e) {
        throw new Error3("Failed to write settings file: " + settingsFile, e);
      } finally {
        settings2.home = homeDir;
        settings2.cache = cacheDir;
      }
    }
    function setAlias(name, value) {
      if (!name || !value) {
        throw new Error3("An alias name and value are required.");
      }
      if (name.toLowerCase() === "default") {
        throw new Error3("A default alias is not supported. Use the `nvs link` command to set a default node version.");
      }
      if (path.isAbsolute(value)) {
        let exe = process.platform === "win32" ? "node.exe" : "node";
        try {
          fs.accessSync(path.join(value, exe), fs.constants.X_OK);
        } catch (e) {
          Error3.throwIfNot(Error3.ENOENT, e);
          throw new Error3("Invalid node build directory target. Specify an absolute path to a directory containing a " + exe + " executable.");
        }
      } else {
        let version = require_version().parse(value);
        let versionPart = version.label || version.semanticVersion;
        if (value === versionPart) {
          value = "default/" + value;
        } else if (!(value === version.remoteName + "/" + versionPart)) {
          throw new Error3("Invalid alias target. Specify a semantic version, optionally preceded by a remote name.");
        }
      }
      settings2.aliases[name] = value;
      saveSettings();
    }
    function removeAlias(name) {
      if (!name) {
        throw new Error3("Specify an alias name.");
      }
      delete settings2.aliases[name];
      saveSettings();
    }
    function listAliases(name) {
      if (name) {
        return settings2.aliases[name];
      }
      let names = Object.keys(settings2.aliases);
      let columnWidth = names.map((item) => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
      return names.sort().map((name2) => {
        let value = settings2.aliases[name2];
        return name2 + " ".repeat(columnWidth - name2.length) + value;
      }).join(os2.EOL);
    }
    function setRemoteAsync(name, uri) {
      if (!name || !uri) {
        throw new Error3("Specify a remote name and URI to add.");
      }
      if (name === "default") {
        if (!settings2.remotes[uri]) {
          throw new Error3(
            "Remote default target name does not exist: " + uri
          );
        }
      } else {
      }
      settings2.remotes[name] = uri;
      saveSettings();
      return Promise.resolve();
    }
    function removeRemote(name) {
      if (!name) {
        throw new Error3("Specify a remote name to remove.");
      }
      if (name === "default") {
        throw new Error3("The default remote pointer cannot be deleted.");
      } else if (settings2.remotes["default"] === name) {
        throw new Error3("The '" + name + "' remote is currently set as the default." + os2.EOL + "Switch the default to another before deleting this one.");
      }
      delete settings2.remotes[name];
      saveSettings();
    }
    function listRemotes(name) {
      if (name) {
        let value = settings2.remotes[name];
        return name === "default" ? value + "  " + settings2.remotes[value] : value;
      }
      let names = Object.keys(settings2.remotes);
      let columnWidth = names.map((item) => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
      return names.sort((a, b) => a === "default" ? -1 : b === "default" ? 1 : a < b ? -1 : 1).map((name2) => {
        let uri = settings2.remotes[name2];
        return name2 + " ".repeat(columnWidth - name2.length) + uri;
      }).join(os2.EOL);
    }
    module2.exports = {
      settings: settings2,
      loadSettings,
      saveSettings,
      setAlias,
      removeAlias,
      listAliases,
      setRemoteAsync,
      removeRemote,
      listRemotes
    };
  }
});

// lib/help.js
var require_help = __commonJS({
  "lib/help.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var os2 = require("os");
    var path = require("path");
    var Error3 = require_error();
    var canUpdateEnv = !process.env["NVS_EXECUTE"];
    function help(topic) {
      if (!process.exitCode) process.exitCode = 127;
      if (topic) {
        let helpFile = path.join(
          __dirname,
          "../doc/" + topic.toUpperCase() + ".md"
        );
        let helpText;
        try {
          helpText = fs.readFileSync(helpFile, "utf8");
        } catch (e) {
          Error3.throwIfNot(Error3.ENOENT, e, "Failed to read help file: " + helpFile);
        }
        if (helpText) {
          helpText = helpText.replace(/```[\w+-]*/g, "");
          helpText = wrapLines(helpText, process.stdout.columns);
          return helpText;
        }
      }
      return [
        "NVS (Node Version Switcher) usage",
        "",
        "nvs help <command>             Get detailed help for a command",
        "nvs install                    Initialize your profile for using NVS",
        "nvs --version                  Display the NVS tool version",
        "",
        "nvs menu                       Launch an interactive menu",
        "",
        "nvs add <version>              Download and extract a node version",
        "nvs rm <version>               Remove a node version",
        "nvs migrate <fromver> [tover]  Migrate global modules",
        "nvs upgrade [fromver]          Upgrade to latest patch of major version",
        "",
        "nvs use [version]              " + (canUpdateEnv ? "Use a node version in the current shell" : "(Not available, source nvs.sh instead)"),
        "nvs auto [on/off]              " + (canUpdateEnv ? "Automatically switch based on cwd" : "(Not available, source nvs.sh instead)"),
        "nvs run <ver> <js> [args...]   Run a script using a node version",
        "nvs exec <ver> <exe> [args...] Run an executable using a node version",
        "nvs which [version]            Show the path to a node version binary",
        "",
        "nvs ls [filter]                List local node versions",
        "nvs ls-remote [filter]         List node versions available to download",
        "nvs outdated                   List local node versions and available updates",
        "",
        "nvs link [version]             Link a version as the default",
        "nvs unlink [version]           Remove links to a default version",
        "",
        "nvs alias [name] [value]       Set or recall aliases for versions",
        "nvs remote [name] [uri]        Set or recall download base URIs",
        "",
        "A version string consists of a semantic version number or version label",
        '("lts" or "latest"), optionally preceeded by a remote name, optionally',
        "followed by an architecture, separated by slashes.",
        'Examples: "lts", "4.6.0", "6.3.1/x86", "node/6.7.0/x64"',
        "Aliases may also be used anywhere in place of a version string.",
        ""
      ].join(os2.EOL);
    }
    function wrapLines(text, columns) {
      let lines = text.split(/\r?\n/);
      if (columns > 0) {
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          if (line.length > columns) {
            let nextLine;
            let wrapIndex = line.lastIndexOf(" ", columns - 1);
            if (wrapIndex > 0) {
              nextLine = line.substr(wrapIndex + 1);
              line = line.substr(0, wrapIndex);
            } else {
              nextLine = line.substr(columns);
              line = line.substr(0, columns);
            }
            lines.splice(i, 1, line, nextLine);
          }
        }
      }
      return lines.join(os2.EOL);
    }
    module2.exports = help;
  }
});

// deps/node_modules/keypress/index.js
var require_keypress = __commonJS({
  "deps/node_modules/keypress/index.js"(exports2, module2) {
    var EventEmitter = require("events").EventEmitter;
    var exports2 = module2.exports = keypress;
    function keypress(stream) {
      if (isEmittingKeypress(stream)) return;
      var StringDecoder = require("string_decoder").StringDecoder;
      stream._keypressDecoder = new StringDecoder("utf8");
      function onData(b) {
        if (listenerCount(stream, "keypress") > 0) {
          var r = stream._keypressDecoder.write(b);
          if (r) emitKey(stream, r);
        } else {
          stream.removeListener("data", onData);
          stream.on("newListener", onNewListener);
        }
      }
      function onNewListener(event) {
        if (event == "keypress") {
          stream.on("data", onData);
          stream.removeListener("newListener", onNewListener);
        }
      }
      if (listenerCount(stream, "keypress") > 0) {
        stream.on("data", onData);
      } else {
        stream.on("newListener", onNewListener);
      }
    }
    function isEmittingKeypress(stream) {
      var rtn = !!stream._keypressDecoder;
      if (!rtn) {
        stream.listeners("data").slice(0).forEach(function(l) {
          if (l.name == "onData" && /emitKey/.test(l.toString())) {
            stream.removeListener("data", l);
          }
        });
        stream.listeners("newListener").slice(0).forEach(function(l) {
          if (l.name == "onNewListener" && /keypress/.test(l.toString())) {
            stream.removeListener("newListener", l);
          }
        });
      }
      return rtn;
    }
    exports2.enableMouse = function(stream) {
      stream.write("\x1B[?1000h");
    };
    exports2.disableMouse = function(stream) {
      stream.write("\x1B[?1000l");
    };
    var listenerCount = EventEmitter.listenerCount;
    if (!listenerCount) {
      listenerCount = function(emitter, event) {
        return emitter.listeners(event).length;
      };
    }
    var metaKeyCodeRe = /^(?:\x1b)([a-zA-Z0-9])$/;
    var functionKeyCodeRe = /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/;
    function emitKey(stream, s) {
      var ch, key = {
        name: void 0,
        ctrl: false,
        meta: false,
        shift: false
      }, parts;
      if (Buffer.isBuffer(s)) {
        if (s[0] > 127 && s[1] === void 0) {
          s[0] -= 128;
          s = "\x1B" + s.toString(stream.encoding || "utf-8");
        } else {
          s = s.toString(stream.encoding || "utf-8");
        }
      }
      key.sequence = s;
      if (s === "\r") {
        key.name = "return";
      } else if (s === "\n") {
        key.name = "enter";
      } else if (s === "	") {
        key.name = "tab";
      } else if (s === "\b" || s === "\x7F" || s === "\x1B\x7F" || s === "\x1B\b") {
        key.name = "backspace";
        key.meta = s.charAt(0) === "\x1B";
      } else if (s === "\x1B" || s === "\x1B\x1B") {
        key.name = "escape";
        key.meta = s.length === 2;
      } else if (s === " " || s === "\x1B ") {
        key.name = "space";
        key.meta = s.length === 2;
      } else if (s <= "") {
        key.name = String.fromCharCode(s.charCodeAt(0) + "a".charCodeAt(0) - 1);
        key.ctrl = true;
      } else if (s.length === 1 && s >= "a" && s <= "z") {
        key.name = s;
      } else if (s.length === 1 && s >= "A" && s <= "Z") {
        key.name = s.toLowerCase();
        key.shift = true;
      } else if (parts = metaKeyCodeRe.exec(s)) {
        key.name = parts[1].toLowerCase();
        key.meta = true;
        key.shift = /^[A-Z]$/.test(parts[1]);
      } else if (parts = functionKeyCodeRe.exec(s)) {
        var code = (parts[1] || "") + (parts[2] || "") + (parts[4] || "") + (parts[6] || ""), modifier = (parts[3] || parts[5] || 1) - 1;
        key.ctrl = !!(modifier & 4);
        key.meta = !!(modifier & 10);
        key.shift = !!(modifier & 1);
        key.code = code;
        switch (code) {
          /* xterm/gnome ESC O letter */
          case "OP":
            key.name = "f1";
            break;
          case "OQ":
            key.name = "f2";
            break;
          case "OR":
            key.name = "f3";
            break;
          case "OS":
            key.name = "f4";
            break;
          /* xterm/rxvt ESC [ number ~ */
          case "[11~":
            key.name = "f1";
            break;
          case "[12~":
            key.name = "f2";
            break;
          case "[13~":
            key.name = "f3";
            break;
          case "[14~":
            key.name = "f4";
            break;
          /* from Cygwin and used in libuv */
          case "[[A":
            key.name = "f1";
            break;
          case "[[B":
            key.name = "f2";
            break;
          case "[[C":
            key.name = "f3";
            break;
          case "[[D":
            key.name = "f4";
            break;
          case "[[E":
            key.name = "f5";
            break;
          /* common */
          case "[15~":
            key.name = "f5";
            break;
          case "[17~":
            key.name = "f6";
            break;
          case "[18~":
            key.name = "f7";
            break;
          case "[19~":
            key.name = "f8";
            break;
          case "[20~":
            key.name = "f9";
            break;
          case "[21~":
            key.name = "f10";
            break;
          case "[23~":
            key.name = "f11";
            break;
          case "[24~":
            key.name = "f12";
            break;
          /* xterm ESC [ letter */
          case "[A":
            key.name = "up";
            break;
          case "[B":
            key.name = "down";
            break;
          case "[C":
            key.name = "right";
            break;
          case "[D":
            key.name = "left";
            break;
          case "[E":
            key.name = "clear";
            break;
          case "[F":
            key.name = "end";
            break;
          case "[H":
            key.name = "home";
            break;
          /* xterm/gnome ESC O letter */
          case "OA":
            key.name = "up";
            break;
          case "OB":
            key.name = "down";
            break;
          case "OC":
            key.name = "right";
            break;
          case "OD":
            key.name = "left";
            break;
          case "OE":
            key.name = "clear";
            break;
          case "OF":
            key.name = "end";
            break;
          case "OH":
            key.name = "home";
            break;
          /* xterm/rxvt ESC [ number ~ */
          case "[1~":
            key.name = "home";
            break;
          case "[2~":
            key.name = "insert";
            break;
          case "[3~":
            key.name = "delete";
            break;
          case "[4~":
            key.name = "end";
            break;
          case "[5~":
            key.name = "pageup";
            break;
          case "[6~":
            key.name = "pagedown";
            break;
          /* putty */
          case "[[5~":
            key.name = "pageup";
            break;
          case "[[6~":
            key.name = "pagedown";
            break;
          /* rxvt */
          case "[7~":
            key.name = "home";
            break;
          case "[8~":
            key.name = "end";
            break;
          /* rxvt keys with modifiers */
          case "[a":
            key.name = "up";
            key.shift = true;
            break;
          case "[b":
            key.name = "down";
            key.shift = true;
            break;
          case "[c":
            key.name = "right";
            key.shift = true;
            break;
          case "[d":
            key.name = "left";
            key.shift = true;
            break;
          case "[e":
            key.name = "clear";
            key.shift = true;
            break;
          case "[2$":
            key.name = "insert";
            key.shift = true;
            break;
          case "[3$":
            key.name = "delete";
            key.shift = true;
            break;
          case "[5$":
            key.name = "pageup";
            key.shift = true;
            break;
          case "[6$":
            key.name = "pagedown";
            key.shift = true;
            break;
          case "[7$":
            key.name = "home";
            key.shift = true;
            break;
          case "[8$":
            key.name = "end";
            key.shift = true;
            break;
          case "Oa":
            key.name = "up";
            key.ctrl = true;
            break;
          case "Ob":
            key.name = "down";
            key.ctrl = true;
            break;
          case "Oc":
            key.name = "right";
            key.ctrl = true;
            break;
          case "Od":
            key.name = "left";
            key.ctrl = true;
            break;
          case "Oe":
            key.name = "clear";
            key.ctrl = true;
            break;
          case "[2^":
            key.name = "insert";
            key.ctrl = true;
            break;
          case "[3^":
            key.name = "delete";
            key.ctrl = true;
            break;
          case "[5^":
            key.name = "pageup";
            key.ctrl = true;
            break;
          case "[6^":
            key.name = "pagedown";
            key.ctrl = true;
            break;
          case "[7^":
            key.name = "home";
            key.ctrl = true;
            break;
          case "[8^":
            key.name = "end";
            key.ctrl = true;
            break;
          /* misc. */
          case "[Z":
            key.name = "tab";
            key.shift = true;
            break;
          default:
            key.name = "undefined";
            break;
        }
      } else if (s.length > 1 && s[0] !== "\x1B") {
        Array.prototype.forEach.call(s, function(c) {
          emitKey(stream, c);
        });
        return;
      }
      if (key.code == "[M") {
        key.name = "mouse";
        var s = key.sequence;
        var b = s.charCodeAt(3);
        key.x = s.charCodeAt(4) - 32;
        key.y = s.charCodeAt(5) - 32;
        key.scroll = 0;
        key.ctrl = !!(1 << 4 & b);
        key.meta = !!(1 << 3 & b);
        key.shift = !!(1 << 2 & b);
        key.release = (3 & b) === 3;
        if (1 << 6 & b) {
          key.scroll = 1 & b ? 1 : -1;
        }
        if (!key.release && !key.scroll) {
          key.button = b & 3;
        }
      }
      if (key.name === void 0) {
        key = void 0;
      }
      if (s.length === 1) {
        ch = s;
      }
      if (key && key.name == "mouse") {
        stream.emit("mousepress", key);
      } else if (key || ch) {
        stream.emit("keypress", ch, key);
      }
    }
  }
});

// deps/node_modules/console-menu/console-menu.js
var require_console_menu = __commonJS({
  "deps/node_modules/console-menu/console-menu.js"(exports2, module2) {
    var os2 = require("os");
    var readline = require("readline");
    var keypress = require_keypress();
    var defaultHelpMessage = "Type a hotkey or use Down/Up arrows then Enter to choose an item.";
    function menu(items, options) {
      if (!items || !Array.isArray(items) || items.length < 1) {
        throw new TypeError("A nonempty items array is required.");
      }
      options = options || {};
      var count = items.length;
      var selectedIndex = items.findIndex((item) => item.selected);
      if (selectedIndex < 0) {
        selectedIndex = 0;
        while (selectedIndex < count && items[selectedIndex].separator) selectedIndex++;
      }
      var scrollOffset = 0;
      printMenu(items, options, selectedIndex, scrollOffset);
      return new Promise((resolve, reject) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        keypress(process.stdin);
        var handleMenuKeypress = (ch, key) => {
          var selection = null;
          if (isEnter(key)) {
            selection = items[selectedIndex];
          } else if (ch) {
            selection = items.find((item) => item.hotkey && item.hotkey === ch) || items.find((item) => item.hotkey && item.hotkey.toLowerCase() === ch.toLowerCase());
          }
          var newIndex = null;
          if (selection || isCancelCommand(key)) {
            process.stdin.removeListener("keypress", handleMenuKeypress);
            process.stdin.setRawMode(false);
            resetCursor(options, selectedIndex, scrollOffset);
            readline.clearScreenDown(process.stdout);
            process.stdin.pause();
            resolve(selection);
          } else if (isUpCommand(key) && selectedIndex > 0) {
            newIndex = selectedIndex - 1;
            while (newIndex >= 0 && items[newIndex].separator) newIndex--;
          } else if (isDownCommand(key) && selectedIndex < count - 1) {
            newIndex = selectedIndex + 1;
            while (newIndex < count && items[newIndex].separator) newIndex++;
          } else if (isPageUpCommand(key) && selectedIndex > 0) {
            newIndex = options.pageSize ? Math.max(0, selectedIndex - options.pageSize) : 0;
            while (newIndex < count && items[newIndex].separator) newIndex++;
          } else if (isPageDownCommand(key) && selectedIndex < count - 1) {
            newIndex = options.pageSize ? Math.min(count - 1, selectedIndex + options.pageSize) : count - 1;
            while (newIndex >= 0 && items[newIndex].separator) newIndex--;
          } else if (isGoToFirstCommand(key) && selectedIndex > 0) {
            newIndex = 0;
            while (newIndex < count && items[newIndex].separator) newIndex++;
          } else if (isGoToLastCommand(key) && selectedIndex < count - 1) {
            newIndex = count - 1;
            while (newIndex >= 0 && items[newIndex].separator) newIndex--;
          }
          if (newIndex !== null && newIndex >= 0 && newIndex < count) {
            resetCursor(options, selectedIndex, scrollOffset);
            selectedIndex = newIndex;
            if (selectedIndex < scrollOffset) {
              scrollOffset = isPageUpCommand(key) ? Math.max(0, scrollOffset - options.pageSize) : selectedIndex;
            } else if (options.pageSize && selectedIndex >= scrollOffset + options.pageSize) {
              scrollOffset = isPageDownCommand(key) ? Math.min(count - options.pageSize, scrollOffset + options.pageSize) : selectedIndex - options.pageSize + 1;
            }
            printMenu(items, options, selectedIndex, scrollOffset);
          }
        };
        process.stdin.addListener("keypress", handleMenuKeypress);
      });
    }
    function isEnter(key) {
      return key && (key.name === "enter" || key.name === "return");
    }
    function isUpCommand(key) {
      return key && key.name === "up";
    }
    function isDownCommand(key) {
      return key && key.name === "down";
    }
    function isPageUpCommand(key) {
      return key && key.name === "pageup";
    }
    function isPageDownCommand(key) {
      return key && key.name === "pagedown";
    }
    function isGoToFirstCommand(key) {
      return key && key.name === "home";
    }
    function isGoToLastCommand(key) {
      return key && key.name === "end";
    }
    function isCancelCommand(key) {
      return key && (key.ctrl && key.name == "c" || key.name === "escape");
    }
    function resetCursor(options, selectedIndex, scrollOffset) {
      readline.moveCursor(
        process.stdout,
        -3,
        -(options.header ? 1 : 0) - (options.border ? options.header ? 2 : 1 : 0) - selectedIndex + scrollOffset
      );
    }
    function printMenu(items, options, selectedIndex, scrollOffset) {
      var repeat = (s, n) => {
        return Array(n + 1).join(s);
      };
      var width = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i].title && 4 + items[i].title.length > width) {
          width = 4 + items[i].title.length;
        }
      }
      var prefix = options.border ? "|" : "";
      var suffix = options.border ? " |" : "";
      if (options.header && options.header.length > width) {
        width = options.header.length;
      }
      if (options.border) {
        if (!options.header && options.pageSize && scrollOffset > 0) {
          process.stdout.write(".--/\\" + repeat("-", width - 2) + "." + os2.EOL);
        } else {
          process.stdout.write("." + repeat("-", width + 2) + "." + os2.EOL);
        }
      }
      if (options.header) {
        process.stdout.write(prefix + (options.border ? " " : "") + options.header + repeat(" ", width - options.header.length) + suffix + os2.EOL);
        if (options.border) {
          if (options.pageSize && scrollOffset > 0) {
            process.stdout.write("+--/\\" + repeat("-", width - 2) + "+" + os2.EOL);
          } else {
            process.stdout.write("+" + repeat("-", width + 2) + "+" + os2.EOL);
          }
        }
      }
      var scrollEnd = options.pageSize ? Math.min(items.length, scrollOffset + options.pageSize) : items.length;
      for (var i = scrollOffset; i < scrollEnd; i++) {
        if (items[i].separator) {
          process.stdout.write(prefix + " " + repeat(" ", width) + suffix + os2.EOL);
        } else {
          var hotkey = items[i].hotkey || "*";
          var title = items[i].title || "";
          var label = i === selectedIndex ? "[" + hotkey + "]" : " " + hotkey + ")";
          process.stdout.write(prefix + " " + label + " " + title + repeat(" ", width - title.length - 4) + suffix + os2.EOL);
        }
      }
      if (options.border) {
        if (options.pageSize && scrollEnd < items.length) {
          process.stdout.write("'--\\/" + repeat("-", width - 2) + "'" + os2.EOL);
        } else {
          process.stdout.write("'" + repeat("-", width + 2) + "'" + os2.EOL);
        }
      }
      process.stdout.write(options.helpMessage || defaultHelpMessage);
      readline.moveCursor(
        process.stdout,
        -(options.helpMessage || defaultHelpMessage).length + prefix.length + 2,
        -(options.border ? 1 : 0) - (scrollEnd - scrollOffset) + selectedIndex - scrollOffset
      );
    }
    module2.exports = menu;
  }
});

// deps/node_modules/ms/index.js
var require_ms = __commonJS({
  "deps/node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// deps/node_modules/debug/src/common.js
var require_common = __commonJS({
  "deps/node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        function debug2(...args) {
          if (!debug2.enabled) {
            return;
          }
          const self = debug2;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug2.namespace = namespace;
        debug2.useColors = createDebug.useColors();
        debug2.color = createDebug.selectColor(namespace);
        debug2.extend = extend;
        debug2.destroy = createDebug.destroy;
        Object.defineProperty(debug2, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => enableOverride === null ? createDebug.enabled(namespace) : enableOverride,
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug2);
        }
        return debug2;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.names = [];
        createDebug.skips = [];
        let i;
        const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
        const len = split.length;
        for (i = 0; i < len; i++) {
          if (!split[i]) {
            continue;
          }
          namespaces = split[i].replace(/\*/g, ".*?");
          if (namespaces[0] === "-") {
            createDebug.skips.push(new RegExp("^" + namespaces.substr(1) + "$"));
          } else {
            createDebug.names.push(new RegExp("^" + namespaces + "$"));
          }
        }
      }
      function disable() {
        const namespaces = [
          ...createDebug.names.map(toNamespace),
          ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        if (name[name.length - 1] === "*") {
          return true;
        }
        let i;
        let len;
        for (i = 0, len = createDebug.skips.length; i < len; i++) {
          if (createDebug.skips[i].test(name)) {
            return false;
          }
        }
        for (i = 0, len = createDebug.names.length; i < len; i++) {
          if (createDebug.names[i].test(name)) {
            return true;
          }
        }
        return false;
      }
      function toNamespace(regexp) {
        return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module2.exports = setup;
  }
});

// deps/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "deps/node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports2.storage.setItem("debug", namespaces);
        } else {
          exports2.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// deps/node_modules/debug/src/node.js
var require_node = __commonJS({
  "deps/node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require("supports-color");
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports2.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports2.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.format(...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug2) {
      debug2.inspectOpts = {};
      const keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug2.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// deps/node_modules/debug/src/index.js
var require_src = __commonJS({
  "deps/node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// deps/node_modules/follow-redirects/debug.js
var require_debug = __commonJS({
  "deps/node_modules/follow-redirects/debug.js"(exports2, module2) {
    var debug2;
    module2.exports = function() {
      if (!debug2) {
        try {
          debug2 = require_src()("follow-redirects");
        } catch (error) {
        }
        if (typeof debug2 !== "function") {
          debug2 = function() {
          };
        }
      }
      debug2.apply(null, arguments);
    };
  }
});

// deps/node_modules/follow-redirects/index.js
var require_follow_redirects = __commonJS({
  "deps/node_modules/follow-redirects/index.js"(exports2, module2) {
    var url = require("url");
    var URL = url.URL;
    var http = require("http");
    var https = require("https");
    var Writable = require("stream").Writable;
    var assert = require("assert");
    var debug2 = require_debug();
    var events = ["abort", "aborted", "connect", "error", "socket", "timeout"];
    var eventHandlers = /* @__PURE__ */ Object.create(null);
    events.forEach(function(event) {
      eventHandlers[event] = function(arg1, arg2, arg3) {
        this._redirectable.emit(event, arg1, arg2, arg3);
      };
    });
    var InvalidUrlError = createErrorType(
      "ERR_INVALID_URL",
      "Invalid URL",
      TypeError
    );
    var RedirectionError = createErrorType(
      "ERR_FR_REDIRECTION_FAILURE",
      "Redirected request failed"
    );
    var TooManyRedirectsError = createErrorType(
      "ERR_FR_TOO_MANY_REDIRECTS",
      "Maximum number of redirects exceeded"
    );
    var MaxBodyLengthExceededError = createErrorType(
      "ERR_FR_MAX_BODY_LENGTH_EXCEEDED",
      "Request body larger than maxBodyLength limit"
    );
    var WriteAfterEndError = createErrorType(
      "ERR_STREAM_WRITE_AFTER_END",
      "write after end"
    );
    function RedirectableRequest(options, responseCallback) {
      Writable.call(this);
      this._sanitizeOptions(options);
      this._options = options;
      this._ended = false;
      this._ending = false;
      this._redirectCount = 0;
      this._redirects = [];
      this._requestBodyLength = 0;
      this._requestBodyBuffers = [];
      if (responseCallback) {
        this.on("response", responseCallback);
      }
      var self = this;
      this._onNativeResponse = function(response) {
        self._processResponse(response);
      };
      this._performRequest();
    }
    RedirectableRequest.prototype = Object.create(Writable.prototype);
    RedirectableRequest.prototype.abort = function() {
      abortRequest(this._currentRequest);
      this.emit("abort");
    };
    RedirectableRequest.prototype.write = function(data, encoding, callback) {
      if (this._ending) {
        throw new WriteAfterEndError();
      }
      if (!isString(data) && !isBuffer(data)) {
        throw new TypeError("data should be a string, Buffer or Uint8Array");
      }
      if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
      }
      if (data.length === 0) {
        if (callback) {
          callback();
        }
        return;
      }
      if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
        this._requestBodyLength += data.length;
        this._requestBodyBuffers.push({ data, encoding });
        this._currentRequest.write(data, encoding, callback);
      } else {
        this.emit("error", new MaxBodyLengthExceededError());
        this.abort();
      }
    };
    RedirectableRequest.prototype.end = function(data, encoding, callback) {
      if (isFunction(data)) {
        callback = data;
        data = encoding = null;
      } else if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
      }
      if (!data) {
        this._ended = this._ending = true;
        this._currentRequest.end(null, null, callback);
      } else {
        var self = this;
        var currentRequest = this._currentRequest;
        this.write(data, encoding, function() {
          self._ended = true;
          currentRequest.end(null, null, callback);
        });
        this._ending = true;
      }
    };
    RedirectableRequest.prototype.setHeader = function(name, value) {
      this._options.headers[name] = value;
      this._currentRequest.setHeader(name, value);
    };
    RedirectableRequest.prototype.removeHeader = function(name) {
      delete this._options.headers[name];
      this._currentRequest.removeHeader(name);
    };
    RedirectableRequest.prototype.setTimeout = function(msecs, callback) {
      var self = this;
      function destroyOnTimeout(socket) {
        socket.setTimeout(msecs);
        socket.removeListener("timeout", socket.destroy);
        socket.addListener("timeout", socket.destroy);
      }
      function startTimer(socket) {
        if (self._timeout) {
          clearTimeout(self._timeout);
        }
        self._timeout = setTimeout(function() {
          self.emit("timeout");
          clearTimer();
        }, msecs);
        destroyOnTimeout(socket);
      }
      function clearTimer() {
        if (self._timeout) {
          clearTimeout(self._timeout);
          self._timeout = null;
        }
        self.removeListener("abort", clearTimer);
        self.removeListener("error", clearTimer);
        self.removeListener("response", clearTimer);
        if (callback) {
          self.removeListener("timeout", callback);
        }
        if (!self.socket) {
          self._currentRequest.removeListener("socket", startTimer);
        }
      }
      if (callback) {
        this.on("timeout", callback);
      }
      if (this.socket) {
        startTimer(this.socket);
      } else {
        this._currentRequest.once("socket", startTimer);
      }
      this.on("socket", destroyOnTimeout);
      this.on("abort", clearTimer);
      this.on("error", clearTimer);
      this.on("response", clearTimer);
      return this;
    };
    [
      "flushHeaders",
      "getHeader",
      "setNoDelay",
      "setSocketKeepAlive"
    ].forEach(function(method) {
      RedirectableRequest.prototype[method] = function(a, b) {
        return this._currentRequest[method](a, b);
      };
    });
    ["aborted", "connection", "socket"].forEach(function(property) {
      Object.defineProperty(RedirectableRequest.prototype, property, {
        get: function() {
          return this._currentRequest[property];
        }
      });
    });
    RedirectableRequest.prototype._sanitizeOptions = function(options) {
      if (!options.headers) {
        options.headers = {};
      }
      if (options.host) {
        if (!options.hostname) {
          options.hostname = options.host;
        }
        delete options.host;
      }
      if (!options.pathname && options.path) {
        var searchPos = options.path.indexOf("?");
        if (searchPos < 0) {
          options.pathname = options.path;
        } else {
          options.pathname = options.path.substring(0, searchPos);
          options.search = options.path.substring(searchPos);
        }
      }
    };
    RedirectableRequest.prototype._performRequest = function() {
      var protocol = this._options.protocol;
      var nativeProtocol = this._options.nativeProtocols[protocol];
      if (!nativeProtocol) {
        this.emit("error", new TypeError("Unsupported protocol " + protocol));
        return;
      }
      if (this._options.agents) {
        var scheme = protocol.slice(0, -1);
        this._options.agent = this._options.agents[scheme];
      }
      var request = this._currentRequest = nativeProtocol.request(this._options, this._onNativeResponse);
      request._redirectable = this;
      for (var event of events) {
        request.on(event, eventHandlers[event]);
      }
      this._currentUrl = /^\//.test(this._options.path) ? url.format(this._options) : (
        // When making a request to a proxy, […]
        // a client MUST send the target URI in absolute-form […].
        this._options.path
      );
      if (this._isRedirect) {
        var i = 0;
        var self = this;
        var buffers = this._requestBodyBuffers;
        (function writeNext(error) {
          if (request === self._currentRequest) {
            if (error) {
              self.emit("error", error);
            } else if (i < buffers.length) {
              var buffer = buffers[i++];
              if (!request.finished) {
                request.write(buffer.data, buffer.encoding, writeNext);
              }
            } else if (self._ended) {
              request.end();
            }
          }
        })();
      }
    };
    RedirectableRequest.prototype._processResponse = function(response) {
      var statusCode = response.statusCode;
      if (this._options.trackRedirects) {
        this._redirects.push({
          url: this._currentUrl,
          headers: response.headers,
          statusCode
        });
      }
      var location = response.headers.location;
      if (!location || this._options.followRedirects === false || statusCode < 300 || statusCode >= 400) {
        response.responseUrl = this._currentUrl;
        response.redirects = this._redirects;
        this.emit("response", response);
        this._requestBodyBuffers = [];
        return;
      }
      abortRequest(this._currentRequest);
      response.destroy();
      if (++this._redirectCount > this._options.maxRedirects) {
        this.emit("error", new TooManyRedirectsError());
        return;
      }
      var requestHeaders;
      var beforeRedirect = this._options.beforeRedirect;
      if (beforeRedirect) {
        requestHeaders = Object.assign({
          // The Host header was set by nativeProtocol.request
          Host: response.req.getHeader("host")
        }, this._options.headers);
      }
      var method = this._options.method;
      if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" || // RFC7231§6.4.4: The 303 (See Other) status code indicates that
      // the server is redirecting the user agent to a different resource […]
      // A user agent can perform a retrieval request targeting that URI
      // (a GET or HEAD request if using HTTP) […]
      statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method)) {
        this._options.method = "GET";
        this._requestBodyBuffers = [];
        removeMatchingHeaders(/^content-/i, this._options.headers);
      }
      var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
      var currentUrlParts = url.parse(this._currentUrl);
      var currentHost = currentHostHeader || currentUrlParts.host;
      var currentUrl = /^\w+:/.test(location) ? this._currentUrl : url.format(Object.assign(currentUrlParts, { host: currentHost }));
      var redirectUrl;
      try {
        redirectUrl = url.resolve(currentUrl, location);
      } catch (cause) {
        this.emit("error", new RedirectionError({ cause }));
        return;
      }
      debug2("redirecting to", redirectUrl);
      this._isRedirect = true;
      var redirectUrlParts = url.parse(redirectUrl);
      Object.assign(this._options, redirectUrlParts);
      if (redirectUrlParts.protocol !== currentUrlParts.protocol && redirectUrlParts.protocol !== "https:" || redirectUrlParts.host !== currentHost && !isSubdomain(redirectUrlParts.host, currentHost)) {
        removeMatchingHeaders(/^(?:authorization|cookie)$/i, this._options.headers);
      }
      if (isFunction(beforeRedirect)) {
        var responseDetails = {
          headers: response.headers,
          statusCode
        };
        var requestDetails = {
          url: currentUrl,
          method,
          headers: requestHeaders
        };
        try {
          beforeRedirect(this._options, responseDetails, requestDetails);
        } catch (err) {
          this.emit("error", err);
          return;
        }
        this._sanitizeOptions(this._options);
      }
      try {
        this._performRequest();
      } catch (cause) {
        this.emit("error", new RedirectionError({ cause }));
      }
    };
    function wrap(protocols) {
      var exports3 = {
        maxRedirects: 21,
        maxBodyLength: 10 * 1024 * 1024
      };
      var nativeProtocols = {};
      Object.keys(protocols).forEach(function(scheme) {
        var protocol = scheme + ":";
        var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
        var wrappedProtocol = exports3[scheme] = Object.create(nativeProtocol);
        function request(input, options, callback) {
          if (isString(input)) {
            var parsed;
            try {
              parsed = urlToOptions(new URL(input));
            } catch (err) {
              parsed = url.parse(input);
            }
            if (!isString(parsed.protocol)) {
              throw new InvalidUrlError({ input });
            }
            input = parsed;
          } else if (URL && input instanceof URL) {
            input = urlToOptions(input);
          } else {
            callback = options;
            options = input;
            input = { protocol };
          }
          if (isFunction(options)) {
            callback = options;
            options = null;
          }
          options = Object.assign({
            maxRedirects: exports3.maxRedirects,
            maxBodyLength: exports3.maxBodyLength
          }, input, options);
          options.nativeProtocols = nativeProtocols;
          if (!isString(options.host) && !isString(options.hostname)) {
            options.hostname = "::1";
          }
          assert.equal(options.protocol, protocol, "protocol mismatch");
          debug2("options", options);
          return new RedirectableRequest(options, callback);
        }
        function get(input, options, callback) {
          var wrappedRequest = wrappedProtocol.request(input, options, callback);
          wrappedRequest.end();
          return wrappedRequest;
        }
        Object.defineProperties(wrappedProtocol, {
          request: { value: request, configurable: true, enumerable: true, writable: true },
          get: { value: get, configurable: true, enumerable: true, writable: true }
        });
      });
      return exports3;
    }
    function noop() {
    }
    function urlToOptions(urlObject) {
      var options = {
        protocol: urlObject.protocol,
        hostname: urlObject.hostname.startsWith("[") ? (
          /* istanbul ignore next */
          urlObject.hostname.slice(1, -1)
        ) : urlObject.hostname,
        hash: urlObject.hash,
        search: urlObject.search,
        pathname: urlObject.pathname,
        path: urlObject.pathname + urlObject.search,
        href: urlObject.href
      };
      if (urlObject.port !== "") {
        options.port = Number(urlObject.port);
      }
      return options;
    }
    function removeMatchingHeaders(regex, headers) {
      var lastValue;
      for (var header in headers) {
        if (regex.test(header)) {
          lastValue = headers[header];
          delete headers[header];
        }
      }
      return lastValue === null || typeof lastValue === "undefined" ? void 0 : String(lastValue).trim();
    }
    function createErrorType(code, message, baseClass) {
      function CustomError(properties) {
        Error.captureStackTrace(this, this.constructor);
        Object.assign(this, properties || {});
        this.code = code;
        this.message = this.cause ? message + ": " + this.cause.message : message;
      }
      CustomError.prototype = new (baseClass || Error)();
      CustomError.prototype.constructor = CustomError;
      CustomError.prototype.name = "Error [" + code + "]";
      return CustomError;
    }
    function abortRequest(request) {
      for (var event of events) {
        request.removeListener(event, eventHandlers[event]);
      }
      request.on("error", noop);
      request.abort();
    }
    function isSubdomain(subdomain, domain) {
      assert(isString(subdomain) && isString(domain));
      var dot = subdomain.length - domain.length - 1;
      return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
    }
    function isString(value) {
      return typeof value === "string" || value instanceof String;
    }
    function isFunction(value) {
      return typeof value === "function";
    }
    function isBuffer(value) {
      return typeof value === "object" && "length" in value;
    }
    module2.exports = wrap({ http, https });
    module2.exports.wrap = wrap;
  }
});

// deps/node_modules/@tootallnate/once/dist/index.js
var require_dist = __commonJS({
  "deps/node_modules/@tootallnate/once/dist/index.js"(exports2, module2) {
    "use strict";
    function once(emitter, name) {
      let c = null;
      const p = new Promise((resolve, reject) => {
        function cancel() {
          emitter.removeListener(name, onEvent);
          emitter.removeListener("error", onError);
        }
        function onEvent(arg) {
          cancel();
          resolve(arg);
        }
        function onError(err) {
          cancel();
          reject(err);
        }
        c = cancel;
        emitter.on(name, onEvent);
        emitter.on("error", onError);
      });
      if (!c) {
        throw new TypeError("Could not get `cancel()` function");
      }
      p.cancel = c;
      return p;
    }
    module2.exports = once;
  }
});

// deps/node_modules/agent-base/dist/src/promisify.js
var require_promisify = __commonJS({
  "deps/node_modules/agent-base/dist/src/promisify.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    function promisify(fn) {
      return function(req, opts) {
        return new Promise((resolve, reject) => {
          fn.call(this, req, opts, (err, rtn) => {
            if (err) {
              reject(err);
            } else {
              resolve(rtn);
            }
          });
        });
      };
    }
    exports2.default = promisify;
  }
});

// deps/node_modules/agent-base/dist/src/index.js
var require_src2 = __commonJS({
  "deps/node_modules/agent-base/dist/src/index.js"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var events_1 = require("events");
    var debug_1 = __importDefault(require_src());
    var promisify_1 = __importDefault(require_promisify());
    var debug2 = debug_1.default("agent-base");
    function isAgent(v) {
      return Boolean(v) && typeof v.addRequest === "function";
    }
    function isSecureEndpoint() {
      const { stack } = new Error();
      if (typeof stack !== "string")
        return false;
      return stack.split("\n").some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("(node:https:") !== -1);
    }
    function createAgent(callback, opts) {
      return new createAgent.Agent(callback, opts);
    }
    (function(createAgent2) {
      class Agent extends events_1.EventEmitter {
        constructor(callback, _opts) {
          super();
          let opts = _opts;
          if (typeof callback === "function") {
            this.callback = callback;
          } else if (callback) {
            opts = callback;
          }
          this.timeout = null;
          if (opts && typeof opts.timeout === "number") {
            this.timeout = opts.timeout;
          }
          this.maxFreeSockets = 1;
          this.maxSockets = 1;
          this.sockets = {};
          this.requests = {};
        }
        get defaultPort() {
          if (typeof this.explicitDefaultPort === "number") {
            return this.explicitDefaultPort;
          }
          return isSecureEndpoint() ? 443 : 80;
        }
        set defaultPort(v) {
          this.explicitDefaultPort = v;
        }
        get protocol() {
          if (typeof this.explicitProtocol === "string") {
            return this.explicitProtocol;
          }
          return isSecureEndpoint() ? "https:" : "http:";
        }
        set protocol(v) {
          this.explicitProtocol = v;
        }
        callback(req, opts, fn) {
          throw new Error('"agent-base" has no default implementation, you must subclass and override `callback()`');
        }
        /**
         * Called by node-core's "_http_client.js" module when creating
         * a new HTTP request with this Agent instance.
         *
         * @api public
         */
        addRequest(req, _opts) {
          const opts = Object.assign({}, _opts);
          if (typeof opts.secureEndpoint !== "boolean") {
            opts.secureEndpoint = isSecureEndpoint();
          }
          if (opts.host == null) {
            opts.host = "localhost";
          }
          if (opts.port == null) {
            opts.port = opts.secureEndpoint ? 443 : 80;
          }
          if (opts.protocol == null) {
            opts.protocol = opts.secureEndpoint ? "https:" : "http:";
          }
          if (opts.host && opts.path) {
            delete opts.path;
          }
          delete opts.agent;
          delete opts.hostname;
          delete opts._defaultAgent;
          delete opts.defaultPort;
          delete opts.createConnection;
          req._last = true;
          req.shouldKeepAlive = false;
          let timedOut = false;
          let timeoutId = null;
          const timeoutMs = opts.timeout || this.timeout;
          const onerror = (err) => {
            if (req._hadError)
              return;
            req.emit("error", err);
            req._hadError = true;
          };
          const ontimeout = () => {
            timeoutId = null;
            timedOut = true;
            const err = new Error(`A "socket" was not created for HTTP request before ${timeoutMs}ms`);
            err.code = "ETIMEOUT";
            onerror(err);
          };
          const callbackError = (err) => {
            if (timedOut)
              return;
            if (timeoutId !== null) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            onerror(err);
          };
          const onsocket = (socket) => {
            if (timedOut)
              return;
            if (timeoutId != null) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (isAgent(socket)) {
              debug2("Callback returned another Agent instance %o", socket.constructor.name);
              socket.addRequest(req, opts);
              return;
            }
            if (socket) {
              socket.once("free", () => {
                this.freeSocket(socket, opts);
              });
              req.onSocket(socket);
              return;
            }
            const err = new Error(`no Duplex stream was returned to agent-base for \`${req.method} ${req.path}\``);
            onerror(err);
          };
          if (typeof this.callback !== "function") {
            onerror(new Error("`callback` is not defined"));
            return;
          }
          if (!this.promisifiedCallback) {
            if (this.callback.length >= 3) {
              debug2("Converting legacy callback function to promise");
              this.promisifiedCallback = promisify_1.default(this.callback);
            } else {
              this.promisifiedCallback = this.callback;
            }
          }
          if (typeof timeoutMs === "number" && timeoutMs > 0) {
            timeoutId = setTimeout(ontimeout, timeoutMs);
          }
          if ("port" in opts && typeof opts.port !== "number") {
            opts.port = Number(opts.port);
          }
          try {
            debug2("Resolving socket for %o request: %o", opts.protocol, `${req.method} ${req.path}`);
            Promise.resolve(this.promisifiedCallback(req, opts)).then(onsocket, callbackError);
          } catch (err) {
            Promise.reject(err).catch(callbackError);
          }
        }
        freeSocket(socket, opts) {
          debug2("Freeing socket %o %o", socket.constructor.name, opts);
          socket.destroy();
        }
        destroy() {
          debug2("Destroying agent %o", this.constructor.name);
        }
      }
      createAgent2.Agent = Agent;
      createAgent2.prototype = createAgent2.Agent.prototype;
    })(createAgent || (createAgent = {}));
    module2.exports = createAgent;
  }
});

// deps/node_modules/http-proxy-agent/dist/agent.js
var require_agent = __commonJS({
  "deps/node_modules/http-proxy-agent/dist/agent.js"(exports2) {
    "use strict";
    var __awaiter = exports2 && exports2.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    var net_1 = __importDefault(require("net"));
    var tls_1 = __importDefault(require("tls"));
    var url_1 = __importDefault(require("url"));
    var debug_1 = __importDefault(require_src());
    var once_1 = __importDefault(require_dist());
    var agent_base_1 = require_src2();
    var debug2 = debug_1.default("http-proxy-agent");
    function isHTTPS(protocol) {
      return typeof protocol === "string" ? /^https:?$/i.test(protocol) : false;
    }
    var HttpProxyAgent = class extends agent_base_1.Agent {
      constructor(_opts) {
        let opts;
        if (typeof _opts === "string") {
          opts = url_1.default.parse(_opts);
        } else {
          opts = _opts;
        }
        if (!opts) {
          throw new Error("an HTTP(S) proxy server `host` and `port` must be specified!");
        }
        debug2("Creating new HttpProxyAgent instance: %o", opts);
        super(opts);
        const proxy = Object.assign({}, opts);
        this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol);
        proxy.host = proxy.hostname || proxy.host;
        if (typeof proxy.port === "string") {
          proxy.port = parseInt(proxy.port, 10);
        }
        if (!proxy.port && proxy.host) {
          proxy.port = this.secureProxy ? 443 : 80;
        }
        if (proxy.host && proxy.path) {
          delete proxy.path;
          delete proxy.pathname;
        }
        this.proxy = proxy;
      }
      /**
       * Called when the node-core HTTP client library is creating a
       * new HTTP request.
       *
       * @api protected
       */
      callback(req, opts) {
        return __awaiter(this, void 0, void 0, function* () {
          const { proxy, secureProxy } = this;
          const parsed = url_1.default.parse(req.path);
          if (!parsed.protocol) {
            parsed.protocol = "http:";
          }
          if (!parsed.hostname) {
            parsed.hostname = opts.hostname || opts.host || null;
          }
          if (parsed.port == null && typeof opts.port) {
            parsed.port = String(opts.port);
          }
          if (parsed.port === "80") {
            delete parsed.port;
          }
          req.path = url_1.default.format(parsed);
          if (proxy.auth) {
            req.setHeader("Proxy-Authorization", `Basic ${Buffer.from(proxy.auth).toString("base64")}`);
          }
          let socket;
          if (secureProxy) {
            debug2("Creating `tls.Socket`: %o", proxy);
            socket = tls_1.default.connect(proxy);
          } else {
            debug2("Creating `net.Socket`: %o", proxy);
            socket = net_1.default.connect(proxy);
          }
          if (req._header) {
            let first;
            let endOfHeaders;
            debug2("Regenerating stored HTTP header string for request");
            req._header = null;
            req._implicitHeader();
            if (req.output && req.output.length > 0) {
              debug2("Patching connection write() output buffer with updated header");
              first = req.output[0];
              endOfHeaders = first.indexOf("\r\n\r\n") + 4;
              req.output[0] = req._header + first.substring(endOfHeaders);
              debug2("Output buffer: %o", req.output);
            } else if (req.outputData && req.outputData.length > 0) {
              debug2("Patching connection write() output buffer with updated header");
              first = req.outputData[0].data;
              endOfHeaders = first.indexOf("\r\n\r\n") + 4;
              req.outputData[0].data = req._header + first.substring(endOfHeaders);
              debug2("Output buffer: %o", req.outputData[0].data);
            }
          }
          yield once_1.default(socket, "connect");
          return socket;
        });
      }
    };
    exports2.default = HttpProxyAgent;
  }
});

// deps/node_modules/http-proxy-agent/dist/index.js
var require_dist2 = __commonJS({
  "deps/node_modules/http-proxy-agent/dist/index.js"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var agent_1 = __importDefault(require_agent());
    function createHttpProxyAgent(opts) {
      return new agent_1.default(opts);
    }
    (function(createHttpProxyAgent2) {
      createHttpProxyAgent2.HttpProxyAgent = agent_1.default;
      createHttpProxyAgent2.prototype = agent_1.default.prototype;
    })(createHttpProxyAgent || (createHttpProxyAgent = {}));
    module2.exports = createHttpProxyAgent;
  }
});

// deps/node_modules/https-proxy-agent/dist/parse-proxy-response.js
var require_parse_proxy_response = __commonJS({
  "deps/node_modules/https-proxy-agent/dist/parse-proxy-response.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    var debug_1 = __importDefault(require_src());
    var debug2 = debug_1.default("https-proxy-agent:parse-proxy-response");
    function parseProxyResponse(socket) {
      return new Promise((resolve, reject) => {
        let buffersLength = 0;
        const buffers = [];
        function read() {
          const b = socket.read();
          if (b)
            ondata(b);
          else
            socket.once("readable", read);
        }
        function cleanup() {
          socket.removeListener("end", onend);
          socket.removeListener("error", onerror);
          socket.removeListener("close", onclose);
          socket.removeListener("readable", read);
        }
        function onclose(err) {
          debug2("onclose had error %o", err);
        }
        function onend() {
          debug2("onend");
        }
        function onerror(err) {
          cleanup();
          debug2("onerror %o", err);
          reject(err);
        }
        function ondata(b) {
          buffers.push(b);
          buffersLength += b.length;
          const buffered = Buffer.concat(buffers, buffersLength);
          const endOfHeaders = buffered.indexOf("\r\n\r\n");
          if (endOfHeaders === -1) {
            debug2("have not received end of HTTP headers yet...");
            read();
            return;
          }
          const firstLine = buffered.toString("ascii", 0, buffered.indexOf("\r\n"));
          const statusCode = +firstLine.split(" ")[1];
          debug2("got proxy server response: %o", firstLine);
          resolve({
            statusCode,
            buffered
          });
        }
        socket.on("error", onerror);
        socket.on("close", onclose);
        socket.on("end", onend);
        read();
      });
    }
    exports2.default = parseProxyResponse;
  }
});

// deps/node_modules/https-proxy-agent/dist/agent.js
var require_agent2 = __commonJS({
  "deps/node_modules/https-proxy-agent/dist/agent.js"(exports2) {
    "use strict";
    var __awaiter = exports2 && exports2.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator["throw"](value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    };
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    var net_1 = __importDefault(require("net"));
    var tls_1 = __importDefault(require("tls"));
    var url_1 = __importDefault(require("url"));
    var assert_1 = __importDefault(require("assert"));
    var debug_1 = __importDefault(require_src());
    var agent_base_1 = require_src2();
    var parse_proxy_response_1 = __importDefault(require_parse_proxy_response());
    var debug2 = debug_1.default("https-proxy-agent:agent");
    var HttpsProxyAgent = class extends agent_base_1.Agent {
      constructor(_opts) {
        let opts;
        if (typeof _opts === "string") {
          opts = url_1.default.parse(_opts);
        } else {
          opts = _opts;
        }
        if (!opts) {
          throw new Error("an HTTP(S) proxy server `host` and `port` must be specified!");
        }
        debug2("creating new HttpsProxyAgent instance: %o", opts);
        super(opts);
        const proxy = Object.assign({}, opts);
        this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol);
        proxy.host = proxy.hostname || proxy.host;
        if (typeof proxy.port === "string") {
          proxy.port = parseInt(proxy.port, 10);
        }
        if (!proxy.port && proxy.host) {
          proxy.port = this.secureProxy ? 443 : 80;
        }
        if (this.secureProxy && !("ALPNProtocols" in proxy)) {
          proxy.ALPNProtocols = ["http 1.1"];
        }
        if (proxy.host && proxy.path) {
          delete proxy.path;
          delete proxy.pathname;
        }
        this.proxy = proxy;
      }
      /**
       * Called when the node-core HTTP client library is creating a
       * new HTTP request.
       *
       * @api protected
       */
      callback(req, opts) {
        return __awaiter(this, void 0, void 0, function* () {
          const { proxy, secureProxy } = this;
          let socket;
          if (secureProxy) {
            debug2("Creating `tls.Socket`: %o", proxy);
            socket = tls_1.default.connect(proxy);
          } else {
            debug2("Creating `net.Socket`: %o", proxy);
            socket = net_1.default.connect(proxy);
          }
          const headers = Object.assign({}, proxy.headers);
          const hostname = `${opts.host}:${opts.port}`;
          let payload = `CONNECT ${hostname} HTTP/1.1\r
`;
          if (proxy.auth) {
            headers["Proxy-Authorization"] = `Basic ${Buffer.from(proxy.auth).toString("base64")}`;
          }
          let { host, port, secureEndpoint } = opts;
          if (!isDefaultPort(port, secureEndpoint)) {
            host += `:${port}`;
          }
          headers.Host = host;
          headers.Connection = "close";
          for (const name of Object.keys(headers)) {
            payload += `${name}: ${headers[name]}\r
`;
          }
          const proxyResponsePromise = parse_proxy_response_1.default(socket);
          socket.write(`${payload}\r
`);
          const { statusCode, buffered } = yield proxyResponsePromise;
          if (statusCode === 200) {
            req.once("socket", resume);
            if (opts.secureEndpoint) {
              const servername = opts.servername || opts.host;
              if (!servername) {
                throw new Error('Could not determine "servername"');
              }
              debug2("Upgrading socket connection to TLS");
              return tls_1.default.connect(Object.assign(Object.assign({}, omit(opts, "host", "hostname", "path", "port")), {
                socket,
                servername
              }));
            }
            return socket;
          }
          socket.destroy();
          const fakeSocket = new net_1.default.Socket();
          fakeSocket.readable = true;
          req.once("socket", (s) => {
            debug2("replaying proxy buffer for failed request");
            assert_1.default(s.listenerCount("data") > 0);
            s.push(buffered);
            s.push(null);
          });
          return fakeSocket;
        });
      }
    };
    exports2.default = HttpsProxyAgent;
    function resume(socket) {
      socket.resume();
    }
    function isDefaultPort(port, secure) {
      return Boolean(!secure && port === 80 || secure && port === 443);
    }
    function isHTTPS(protocol) {
      return typeof protocol === "string" ? /^https:?$/i.test(protocol) : false;
    }
    function omit(obj, ...keys) {
      const ret = {};
      let key;
      for (key in obj) {
        if (!keys.includes(key)) {
          ret[key] = obj[key];
        }
      }
      return ret;
    }
  }
});

// deps/node_modules/https-proxy-agent/dist/index.js
var require_dist3 = __commonJS({
  "deps/node_modules/https-proxy-agent/dist/index.js"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    var agent_1 = __importDefault(require_agent2());
    function createHttpsProxyAgent(opts) {
      return new agent_1.default(opts);
    }
    (function(createHttpsProxyAgent2) {
      createHttpsProxyAgent2.HttpsProxyAgent = agent_1.default;
      createHttpsProxyAgent2.prototype = agent_1.default.prototype;
    })(createHttpsProxyAgent || (createHttpsProxyAgent = {}));
    module2.exports = createHttpsProxyAgent;
  }
});

// lib/http.js
var require_http = __commonJS({
  "lib/http.js"(exports2, module2) {
    "use strict";
    var { http, https } = require_follow_redirects();
    var { HttpProxyAgent } = require_dist2();
    var { HttpsProxyAgent } = require_dist3();
    function httpGet(url, opt, cb) {
      opt = opt || {};
      const secure = url.protocol === "https:";
      const proxy = secure ? process.env.https_proxy || process.env.HTTPS_PROXY : process.env.http_proxy || process.env.HTTP_PROXY;
      const Agent = secure ? HttpsProxyAgent : HttpProxyAgent;
      if (proxy) opt.agent = new Agent(proxy);
      return secure ? https.get(url, opt, cb) : http.get(url, opt, cb);
    }
    module2.exports = {
      httpGet
    };
  }
});

// deps/node_modules/semver/semver.js
var require_semver = __commonJS({
  "deps/node_modules/semver/semver.js"(exports2, module2) {
    exports2 = module2.exports = SemVer;
    var debug2;
    if (typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG)) {
      debug2 = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift("SEMVER");
        console.log.apply(console, args);
      };
    } else {
      debug2 = function() {
      };
    }
    exports2.SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var re = exports2.re = [];
    var safeRe = exports2.safeRe = [];
    var src = exports2.src = [];
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    function makeSafeRe(value) {
      for (var i2 = 0; i2 < safeRegexReplacements.length; i2++) {
        var token = safeRegexReplacements[i2][0];
        var max = safeRegexReplacements[i2][1];
        value = value.split(token + "*").join(token + "{0," + max + "}").split(token + "+").join(token + "{1," + max + "}");
      }
      return value;
    }
    var NUMERICIDENTIFIER = R++;
    src[NUMERICIDENTIFIER] = "0|[1-9]\\d*";
    var NUMERICIDENTIFIERLOOSE = R++;
    src[NUMERICIDENTIFIERLOOSE] = "\\d+";
    var NONNUMERICIDENTIFIER = R++;
    src[NONNUMERICIDENTIFIER] = "\\d*[a-zA-Z-]" + LETTERDASHNUMBER + "*";
    var MAINVERSION = R++;
    src[MAINVERSION] = "(" + src[NUMERICIDENTIFIER] + ")\\.(" + src[NUMERICIDENTIFIER] + ")\\.(" + src[NUMERICIDENTIFIER] + ")";
    var MAINVERSIONLOOSE = R++;
    src[MAINVERSIONLOOSE] = "(" + src[NUMERICIDENTIFIERLOOSE] + ")\\.(" + src[NUMERICIDENTIFIERLOOSE] + ")\\.(" + src[NUMERICIDENTIFIERLOOSE] + ")";
    var PRERELEASEIDENTIFIER = R++;
    src[PRERELEASEIDENTIFIER] = "(?:" + src[NUMERICIDENTIFIER] + "|" + src[NONNUMERICIDENTIFIER] + ")";
    var PRERELEASEIDENTIFIERLOOSE = R++;
    src[PRERELEASEIDENTIFIERLOOSE] = "(?:" + src[NUMERICIDENTIFIERLOOSE] + "|" + src[NONNUMERICIDENTIFIER] + ")";
    var PRERELEASE = R++;
    src[PRERELEASE] = "(?:-(" + src[PRERELEASEIDENTIFIER] + "(?:\\." + src[PRERELEASEIDENTIFIER] + ")*))";
    var PRERELEASELOOSE = R++;
    src[PRERELEASELOOSE] = "(?:-?(" + src[PRERELEASEIDENTIFIERLOOSE] + "(?:\\." + src[PRERELEASEIDENTIFIERLOOSE] + ")*))";
    var BUILDIDENTIFIER = R++;
    src[BUILDIDENTIFIER] = LETTERDASHNUMBER + "+";
    var BUILD = R++;
    src[BUILD] = "(?:\\+(" + src[BUILDIDENTIFIER] + "(?:\\." + src[BUILDIDENTIFIER] + ")*))";
    var FULL = R++;
    var FULLPLAIN = "v?" + src[MAINVERSION] + src[PRERELEASE] + "?" + src[BUILD] + "?";
    src[FULL] = "^" + FULLPLAIN + "$";
    var LOOSEPLAIN = "[v=\\s]*" + src[MAINVERSIONLOOSE] + src[PRERELEASELOOSE] + "?" + src[BUILD] + "?";
    var LOOSE = R++;
    src[LOOSE] = "^" + LOOSEPLAIN + "$";
    var GTLT = R++;
    src[GTLT] = "((?:<|>)?=?)";
    var XRANGEIDENTIFIERLOOSE = R++;
    src[XRANGEIDENTIFIERLOOSE] = src[NUMERICIDENTIFIERLOOSE] + "|x|X|\\*";
    var XRANGEIDENTIFIER = R++;
    src[XRANGEIDENTIFIER] = src[NUMERICIDENTIFIER] + "|x|X|\\*";
    var XRANGEPLAIN = R++;
    src[XRANGEPLAIN] = "[v=\\s]*(" + src[XRANGEIDENTIFIER] + ")(?:\\.(" + src[XRANGEIDENTIFIER] + ")(?:\\.(" + src[XRANGEIDENTIFIER] + ")(?:" + src[PRERELEASE] + ")?" + src[BUILD] + "?)?)?";
    var XRANGEPLAINLOOSE = R++;
    src[XRANGEPLAINLOOSE] = "[v=\\s]*(" + src[XRANGEIDENTIFIERLOOSE] + ")(?:\\.(" + src[XRANGEIDENTIFIERLOOSE] + ")(?:\\.(" + src[XRANGEIDENTIFIERLOOSE] + ")(?:" + src[PRERELEASELOOSE] + ")?" + src[BUILD] + "?)?)?";
    var XRANGE = R++;
    src[XRANGE] = "^" + src[GTLT] + "\\s*" + src[XRANGEPLAIN] + "$";
    var XRANGELOOSE = R++;
    src[XRANGELOOSE] = "^" + src[GTLT] + "\\s*" + src[XRANGEPLAINLOOSE] + "$";
    var COERCE = R++;
    src[COERCE] = "(?:^|[^\\d])(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "})(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?(?:\\.(\\d{1," + MAX_SAFE_COMPONENT_LENGTH + "}))?(?:$|[^\\d])";
    var LONETILDE = R++;
    src[LONETILDE] = "(?:~>?)";
    var TILDETRIM = R++;
    src[TILDETRIM] = "(\\s*)" + src[LONETILDE] + "\\s+";
    re[TILDETRIM] = new RegExp(src[TILDETRIM], "g");
    safeRe[TILDETRIM] = new RegExp(makeSafeRe(src[TILDETRIM]), "g");
    var tildeTrimReplace = "$1~";
    var TILDE = R++;
    src[TILDE] = "^" + src[LONETILDE] + src[XRANGEPLAIN] + "$";
    var TILDELOOSE = R++;
    src[TILDELOOSE] = "^" + src[LONETILDE] + src[XRANGEPLAINLOOSE] + "$";
    var LONECARET = R++;
    src[LONECARET] = "(?:\\^)";
    var CARETTRIM = R++;
    src[CARETTRIM] = "(\\s*)" + src[LONECARET] + "\\s+";
    re[CARETTRIM] = new RegExp(src[CARETTRIM], "g");
    safeRe[CARETTRIM] = new RegExp(makeSafeRe(src[CARETTRIM]), "g");
    var caretTrimReplace = "$1^";
    var CARET = R++;
    src[CARET] = "^" + src[LONECARET] + src[XRANGEPLAIN] + "$";
    var CARETLOOSE = R++;
    src[CARETLOOSE] = "^" + src[LONECARET] + src[XRANGEPLAINLOOSE] + "$";
    var COMPARATORLOOSE = R++;
    src[COMPARATORLOOSE] = "^" + src[GTLT] + "\\s*(" + LOOSEPLAIN + ")$|^$";
    var COMPARATOR = R++;
    src[COMPARATOR] = "^" + src[GTLT] + "\\s*(" + FULLPLAIN + ")$|^$";
    var COMPARATORTRIM = R++;
    src[COMPARATORTRIM] = "(\\s*)" + src[GTLT] + "\\s*(" + LOOSEPLAIN + "|" + src[XRANGEPLAIN] + ")";
    re[COMPARATORTRIM] = new RegExp(src[COMPARATORTRIM], "g");
    safeRe[COMPARATORTRIM] = new RegExp(makeSafeRe(src[COMPARATORTRIM]), "g");
    var comparatorTrimReplace = "$1$2$3";
    var HYPHENRANGE = R++;
    src[HYPHENRANGE] = "^\\s*(" + src[XRANGEPLAIN] + ")\\s+-\\s+(" + src[XRANGEPLAIN] + ")\\s*$";
    var HYPHENRANGELOOSE = R++;
    src[HYPHENRANGELOOSE] = "^\\s*(" + src[XRANGEPLAINLOOSE] + ")\\s+-\\s+(" + src[XRANGEPLAINLOOSE] + ")\\s*$";
    var STAR = R++;
    src[STAR] = "(<|>)?=?\\s*\\*";
    for (i = 0; i < R; i++) {
      debug2(i, src[i]);
      if (!re[i]) {
        re[i] = new RegExp(src[i]);
        safeRe[i] = new RegExp(makeSafeRe(src[i]));
      }
    }
    var i;
    exports2.parse = parse;
    function parse(version, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version !== "string") {
        return null;
      }
      if (version.length > MAX_LENGTH) {
        return null;
      }
      var r = options.loose ? safeRe[LOOSE] : safeRe[FULL];
      if (!r.test(version)) {
        return null;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        return null;
      }
    }
    exports2.valid = valid;
    function valid(version, options) {
      var v = parse(version, options);
      return v ? v.version : null;
    }
    exports2.clean = clean;
    function clean(version, options) {
      var s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    }
    exports2.SemVer = SemVer;
    function SemVer(version, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (version instanceof SemVer) {
        if (version.loose === options.loose) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError("Invalid Version: " + version);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError("version is longer than " + MAX_LENGTH + " characters");
      }
      if (!(this instanceof SemVer)) {
        return new SemVer(version, options);
      }
      debug2("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      var m = version.trim().match(options.loose ? safeRe[LOOSE] : safeRe[FULL]);
      if (!m) {
        throw new TypeError("Invalid Version: " + version);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map(function(id) {
          if (/^[0-9]+$/.test(id)) {
            var num = +id;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    SemVer.prototype.format = function() {
      this.version = this.major + "." + this.minor + "." + this.patch;
      if (this.prerelease.length) {
        this.version += "-" + this.prerelease.join(".");
      }
      return this.version;
    };
    SemVer.prototype.toString = function() {
      return this.version;
    };
    SemVer.prototype.compare = function(other) {
      debug2("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      return this.compareMain(other) || this.comparePre(other);
    };
    SemVer.prototype.compareMain = function(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      return compareIdentifiers(this.major, other.major) || compareIdentifiers(this.minor, other.minor) || compareIdentifiers(this.patch, other.patch);
    };
    SemVer.prototype.comparePre = function(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      var i2 = 0;
      do {
        var a = this.prerelease[i2];
        var b = other.prerelease[i2];
        debug2("prerelease compare", i2, a, b);
        if (a === void 0 && b === void 0) {
          return 0;
        } else if (b === void 0) {
          return 1;
        } else if (a === void 0) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i2);
    };
    SemVer.prototype.inc = function(release, identifier) {
      switch (release) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier);
          this.inc("pre", identifier);
          break;
        // If the input is a non-prerelease version, this acts the same as
        // prepatch.
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier);
          }
          this.inc("pre", identifier);
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        // This probably shouldn't be used publicly.
        // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
        case "pre":
          if (this.prerelease.length === 0) {
            this.prerelease = [0];
          } else {
            var i2 = this.prerelease.length;
            while (--i2 >= 0) {
              if (typeof this.prerelease[i2] === "number") {
                this.prerelease[i2]++;
                i2 = -2;
              }
            }
            if (i2 === -1) {
              this.prerelease.push(0);
            }
          }
          if (identifier) {
            if (this.prerelease[0] === identifier) {
              if (isNaN(this.prerelease[1])) {
                this.prerelease = [identifier, 0];
              }
            } else {
              this.prerelease = [identifier, 0];
            }
          }
          break;
        default:
          throw new Error("invalid increment argument: " + release);
      }
      this.format();
      this.raw = this.version;
      return this;
    };
    exports2.inc = inc;
    function inc(version, release, loose, identifier) {
      if (typeof loose === "string") {
        identifier = loose;
        loose = void 0;
      }
      try {
        return new SemVer(version, loose).inc(release, identifier).version;
      } catch (er) {
        return null;
      }
    }
    exports2.diff = diff;
    function diff(version1, version2) {
      if (eq(version1, version2)) {
        return null;
      } else {
        var v1 = parse(version1);
        var v2 = parse(version2);
        var prefix = "";
        if (v1.prerelease.length || v2.prerelease.length) {
          prefix = "pre";
          var defaultResult = "prerelease";
        }
        for (var key in v1) {
          if (key === "major" || key === "minor" || key === "patch") {
            if (v1[key] !== v2[key]) {
              return prefix + key;
            }
          }
        }
        return defaultResult;
      }
    }
    exports2.compareIdentifiers = compareIdentifiers;
    var numeric = /^[0-9]+$/;
    function compareIdentifiers(a, b) {
      var anum = numeric.test(a);
      var bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    }
    exports2.rcompareIdentifiers = rcompareIdentifiers;
    function rcompareIdentifiers(a, b) {
      return compareIdentifiers(b, a);
    }
    exports2.major = major;
    function major(a, loose) {
      return new SemVer(a, loose).major;
    }
    exports2.minor = minor;
    function minor(a, loose) {
      return new SemVer(a, loose).minor;
    }
    exports2.patch = patch;
    function patch(a, loose) {
      return new SemVer(a, loose).patch;
    }
    exports2.compare = compare;
    function compare(a, b, loose) {
      return new SemVer(a, loose).compare(new SemVer(b, loose));
    }
    exports2.compareLoose = compareLoose;
    function compareLoose(a, b) {
      return compare(a, b, true);
    }
    exports2.rcompare = rcompare;
    function rcompare(a, b, loose) {
      return compare(b, a, loose);
    }
    exports2.sort = sort;
    function sort(list, loose) {
      return list.sort(function(a, b) {
        return exports2.compare(a, b, loose);
      });
    }
    exports2.rsort = rsort;
    function rsort(list, loose) {
      return list.sort(function(a, b) {
        return exports2.rcompare(a, b, loose);
      });
    }
    exports2.gt = gt;
    function gt(a, b, loose) {
      return compare(a, b, loose) > 0;
    }
    exports2.lt = lt;
    function lt(a, b, loose) {
      return compare(a, b, loose) < 0;
    }
    exports2.eq = eq;
    function eq(a, b, loose) {
      return compare(a, b, loose) === 0;
    }
    exports2.neq = neq;
    function neq(a, b, loose) {
      return compare(a, b, loose) !== 0;
    }
    exports2.gte = gte;
    function gte(a, b, loose) {
      return compare(a, b, loose) >= 0;
    }
    exports2.lte = lte;
    function lte(a, b, loose) {
      return compare(a, b, loose) <= 0;
    }
    exports2.cmp = cmp;
    function cmp(a, op, b, loose) {
      switch (op) {
        case "===":
          if (typeof a === "object")
            a = a.version;
          if (typeof b === "object")
            b = b.version;
          return a === b;
        case "!==":
          if (typeof a === "object")
            a = a.version;
          if (typeof b === "object")
            b = b.version;
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError("Invalid operator: " + op);
      }
    }
    exports2.Comparator = Comparator;
    function Comparator(comp, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      if (!(this instanceof Comparator)) {
        return new Comparator(comp, options);
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug2("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug2("comp", this);
    }
    var ANY = {};
    Comparator.prototype.parse = function(comp) {
      var r = this.options.loose ? safeRe[COMPARATORLOOSE] : safeRe[COMPARATOR];
      var m = comp.match(r);
      if (!m) {
        throw new TypeError("Invalid comparator: " + comp);
      }
      this.operator = m[1];
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    };
    Comparator.prototype.toString = function() {
      return this.value;
    };
    Comparator.prototype.test = function(version) {
      debug2("Comparator.test", version, this.options.loose);
      if (this.semver === ANY) {
        return true;
      }
      if (typeof version === "string") {
        version = new SemVer(version, this.options);
      }
      return cmp(version, this.operator, this.semver, this.options);
    };
    Comparator.prototype.intersects = function(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      var rangeTmp;
      if (this.operator === "") {
        rangeTmp = new Range(comp.value, options);
        return satisfies(this.value, rangeTmp, options);
      } else if (comp.operator === "") {
        rangeTmp = new Range(this.value, options);
        return satisfies(comp.semver, rangeTmp, options);
      }
      var sameDirectionIncreasing = (this.operator === ">=" || this.operator === ">") && (comp.operator === ">=" || comp.operator === ">");
      var sameDirectionDecreasing = (this.operator === "<=" || this.operator === "<") && (comp.operator === "<=" || comp.operator === "<");
      var sameSemVer = this.semver.version === comp.semver.version;
      var differentDirectionsInclusive = (this.operator === ">=" || this.operator === "<=") && (comp.operator === ">=" || comp.operator === "<=");
      var oppositeDirectionsLessThan = cmp(this.semver, "<", comp.semver, options) && ((this.operator === ">=" || this.operator === ">") && (comp.operator === "<=" || comp.operator === "<"));
      var oppositeDirectionsGreaterThan = cmp(this.semver, ">", comp.semver, options) && ((this.operator === "<=" || this.operator === "<") && (comp.operator === ">=" || comp.operator === ">"));
      return sameDirectionIncreasing || sameDirectionDecreasing || sameSemVer && differentDirectionsInclusive || oppositeDirectionsLessThan || oppositeDirectionsGreaterThan;
    };
    exports2.Range = Range;
    function Range(range, options) {
      if (!options || typeof options !== "object") {
        options = {
          loose: !!options,
          includePrerelease: false
        };
      }
      if (range instanceof Range) {
        if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
          return range;
        } else {
          return new Range(range.raw, options);
        }
      }
      if (range instanceof Comparator) {
        return new Range(range.value, options);
      }
      if (!(this instanceof Range)) {
        return new Range(range, options);
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range.trim().split(/\s+/).join(" ");
      this.set = this.raw.split("||").map(function(range2) {
        return this.parseRange(range2.trim());
      }, this).filter(function(c) {
        return c.length;
      });
      if (!this.set.length) {
        throw new TypeError("Invalid SemVer Range: " + this.raw);
      }
      this.format();
    }
    Range.prototype.format = function() {
      this.range = this.set.map(function(comps) {
        return comps.join(" ").trim();
      }).join("||").trim();
      return this.range;
    };
    Range.prototype.toString = function() {
      return this.range;
    };
    Range.prototype.parseRange = function(range) {
      var loose = this.options.loose;
      var hr = loose ? safeRe[HYPHENRANGELOOSE] : safeRe[HYPHENRANGE];
      range = range.replace(hr, hyphenReplace);
      debug2("hyphen replace", range);
      range = range.replace(safeRe[COMPARATORTRIM], comparatorTrimReplace);
      debug2("comparator trim", range, safeRe[COMPARATORTRIM]);
      range = range.replace(safeRe[TILDETRIM], tildeTrimReplace);
      range = range.replace(safeRe[CARETTRIM], caretTrimReplace);
      var compRe = loose ? safeRe[COMPARATORLOOSE] : safeRe[COMPARATOR];
      var set = range.split(" ").map(function(comp) {
        return parseComparator(comp, this.options);
      }, this).join(" ").split(/\s+/);
      if (this.options.loose) {
        set = set.filter(function(comp) {
          return !!comp.match(compRe);
        });
      }
      set = set.map(function(comp) {
        return new Comparator(comp, this.options);
      }, this);
      return set;
    };
    Range.prototype.intersects = function(range, options) {
      if (!(range instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some(function(thisComparators) {
        return thisComparators.every(function(thisComparator) {
          return range.set.some(function(rangeComparators) {
            return rangeComparators.every(function(rangeComparator) {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    };
    exports2.toComparators = toComparators;
    function toComparators(range, options) {
      return new Range(range, options).set.map(function(comp) {
        return comp.map(function(c) {
          return c.value;
        }).join(" ").trim().split(" ");
      });
    }
    function parseComparator(comp, options) {
      debug2("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug2("caret", comp);
      comp = replaceTildes(comp, options);
      debug2("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug2("xrange", comp);
      comp = replaceStars(comp, options);
      debug2("stars", comp);
      return comp;
    }
    function isX(id) {
      return !id || id.toLowerCase() === "x" || id === "*";
    }
    function replaceTildes(comp, options) {
      return comp.trim().split(/\s+/).map(function(comp2) {
        return replaceTilde(comp2, options);
      }).join(" ");
    }
    function replaceTilde(comp, options) {
      var r = options.loose ? safeRe[TILDELOOSE] : safeRe[TILDE];
      return comp.replace(r, function(_, M, m, p, pr) {
        debug2("tilde", comp, _, M, m, p, pr);
        var ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (isX(p)) {
          ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
        } else if (pr) {
          debug2("replaceTilde pr", pr);
          ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
        } else {
          ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
        }
        debug2("tilde return", ret);
        return ret;
      });
    }
    function replaceCarets(comp, options) {
      return comp.trim().split(/\s+/).map(function(comp2) {
        return replaceCaret(comp2, options);
      }).join(" ");
    }
    function replaceCaret(comp, options) {
      debug2("caret", comp, options);
      var r = options.loose ? safeRe[CARETLOOSE] : safeRe[CARET];
      return comp.replace(r, function(_, M, m, p, pr) {
        debug2("caret", comp, _, M, m, p, pr);
        var ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (isX(p)) {
          if (M === "0") {
            ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
          } else {
            ret = ">=" + M + "." + m + ".0 <" + (+M + 1) + ".0.0";
          }
        } else if (pr) {
          debug2("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + m + "." + (+p + 1);
            } else {
              ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + M + "." + (+m + 1) + ".0";
            }
          } else {
            ret = ">=" + M + "." + m + "." + p + "-" + pr + " <" + (+M + 1) + ".0.0";
          }
        } else {
          debug2("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = ">=" + M + "." + m + "." + p + " <" + M + "." + m + "." + (+p + 1);
            } else {
              ret = ">=" + M + "." + m + "." + p + " <" + M + "." + (+m + 1) + ".0";
            }
          } else {
            ret = ">=" + M + "." + m + "." + p + " <" + (+M + 1) + ".0.0";
          }
        }
        debug2("caret return", ret);
        return ret;
      });
    }
    function replaceXRanges(comp, options) {
      debug2("replaceXRanges", comp, options);
      return comp.split(/\s+/).map(function(comp2) {
        return replaceXRange(comp2, options);
      }).join(" ");
    }
    function replaceXRange(comp, options) {
      comp = comp.trim();
      var r = options.loose ? safeRe[XRANGELOOSE] : safeRe[XRANGE];
      return comp.replace(r, function(ret, gtlt, M, m, p, pr) {
        debug2("xRange", comp, ret, gtlt, M, m, p, pr);
        var xM = isX(M);
        var xm = xM || isX(m);
        var xp = xm || isX(p);
        var anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          ret = gtlt + M + "." + m + "." + p;
        } else if (xm) {
          ret = ">=" + M + ".0.0 <" + (+M + 1) + ".0.0";
        } else if (xp) {
          ret = ">=" + M + "." + m + ".0 <" + M + "." + (+m + 1) + ".0";
        }
        debug2("xRange return", ret);
        return ret;
      });
    }
    function replaceStars(comp, options) {
      debug2("replaceStars", comp, options);
      return comp.trim().replace(safeRe[STAR], "");
    }
    function hyphenReplace($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr, tb) {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = ">=" + fM + ".0.0";
      } else if (isX(fp)) {
        from = ">=" + fM + "." + fm + ".0";
      } else {
        from = ">=" + from;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = "<" + (+tM + 1) + ".0.0";
      } else if (isX(tp)) {
        to = "<" + tM + "." + (+tm + 1) + ".0";
      } else if (tpr) {
        to = "<=" + tM + "." + tm + "." + tp + "-" + tpr;
      } else {
        to = "<=" + to;
      }
      return (from + " " + to).trim();
    }
    Range.prototype.test = function(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        version = new SemVer(version, this.options);
      }
      for (var i2 = 0; i2 < this.set.length; i2++) {
        if (testSet(this.set[i2], version, this.options)) {
          return true;
        }
      }
      return false;
    };
    function testSet(set, version, options) {
      for (var i2 = 0; i2 < set.length; i2++) {
        if (!set[i2].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (i2 = 0; i2 < set.length; i2++) {
          debug2(set[i2].semver);
          if (set[i2].semver === ANY) {
            continue;
          }
          if (set[i2].semver.prerelease.length > 0) {
            var allowed = set[i2].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    }
    exports2.satisfies = satisfies;
    function satisfies(version, range, options) {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
    }
    exports2.maxSatisfying = maxSatisfying;
    function maxSatisfying(versions, range, options) {
      var max = null;
      var maxSV = null;
      try {
        var rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach(function(v) {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    }
    exports2.minSatisfying = minSatisfying;
    function minSatisfying(versions, range, options) {
      var min = null;
      var minSV = null;
      try {
        var rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach(function(v) {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    }
    exports2.minVersion = minVersion;
    function minVersion(range, loose) {
      range = new Range(range, loose);
      var minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (var i2 = 0; i2 < range.set.length; ++i2) {
        var comparators = range.set[i2];
        comparators.forEach(function(comparator) {
          var compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!minver || gt(minver, compver)) {
                minver = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error("Unexpected operation: " + comparator.operator);
          }
        });
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    }
    exports2.validRange = validRange;
    function validRange(range, options) {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    }
    exports2.ltr = ltr;
    function ltr(version, range, options) {
      return outside(version, range, "<", options);
    }
    exports2.gtr = gtr;
    function gtr(version, range, options) {
      return outside(version, range, ">", options);
    }
    exports2.outside = outside;
    function outside(version, range, hilo, options) {
      version = new SemVer(version, options);
      range = new Range(range, options);
      var gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range, options)) {
        return false;
      }
      for (var i2 = 0; i2 < range.set.length; ++i2) {
        var comparators = range.set[i2];
        var high = null;
        var low = null;
        comparators.forEach(function(comparator) {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    }
    exports2.prerelease = prerelease;
    function prerelease(version, options) {
      var parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    }
    exports2.intersects = intersects;
    function intersects(r1, r2, options) {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2);
    }
    exports2.coerce = coerce;
    function coerce(version) {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version !== "string") {
        return null;
      }
      var match = version.match(safeRe[COERCE]);
      if (match == null) {
        return null;
      }
      return parse(match[1] + "." + (match[2] || "0") + "." + (match[3] || "0"));
    }
  }
});

// lib/postScript.js
var require_postScript = __commonJS({
  "lib/postScript.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var os2 = require("os");
    var canUpdateEnv = !process.env["NVS_EXECUTE"];
    var postScriptLines = [];
    function generate(exportVars, additionalLines) {
      if (!canUpdateEnv) {
        console.warn("Warning: NVS cannot update PATH unless sourced from the shell.");
        return;
      }
      let envVars = Object.keys(exportVars || {});
      let postScriptFile = "temp.sh";
      if (!postScriptFile) {
        throw new Error("NVS_POSTSCRIPT environment variable not set.");
      }
      let postScriptExtension = path.extname(postScriptFile).toUpperCase();
      if (postScriptExtension === ".CMD") {
        envVars.forEach((envVar) => {
          if (exportVars[envVar] !== null) {
            postScriptLines.push("SET " + envVar + "=" + exportVars[envVar]);
          } else {
            postScriptLines.push("SET " + envVar + "=");
          }
        });
      } else if (postScriptExtension === ".PS1") {
        envVars.forEach((envVar) => {
          if (exportVars[envVar] !== null) {
            postScriptLines.push("$env:" + envVar + '="' + exportVars[envVar] + '"');
          } else {
            postScriptLines.push("Remove-Item env:" + envVar + " -ErrorAction SilentlyContinue");
          }
        });
      } else if (postScriptExtension === ".SH") {
        envVars.forEach((envVar) => {
          let value = exportVars[envVar];
          if (value !== null) {
            if (process.platform === "win32" && /PATH/i.test(envVar)) {
              value = require_windowsEnv().windowsPathListToPosixPathList(value);
            }
            postScriptLines.push("export " + envVar + '="' + value + '"');
          } else {
            postScriptLines.push("unset " + envVar);
          }
        });
      }
      if (additionalLines && additionalLines[postScriptExtension]) {
        postScriptLines = postScriptLines.concat(additionalLines[postScriptExtension]);
      }
      if (postScriptLines.length > 0) {
        fs.writeFileSync(postScriptFile, postScriptLines.join(os2.EOL) + os2.EOL);
      }
    }
    module2.exports = {
      generate
    };
  }
});

// lib/auto.js
var require_auto = __commonJS({
  "lib/auto.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var os2 = require("os");
    var path = require("path");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var NodeVersion = require_version();
    var nvsUse = require_use();
    var nvsAddRemove = require_addRemove();
    var nvsList = require_list();
    var nvsLink = null;
    function findAutoVersionAsync(cwd) {
      let version = null;
      let dir = cwd || process.cwd();
      while (dir) {
        let versionFile = path.join(dir, ".node-version");
        let versionString;
        try {
          versionString = fs.readFileSync(versionFile, "utf8").trim();
        } catch (e) {
          Error3.throwIfNot(Error3.ENOENT, e, "Failed to read file: " + versionFile);
        }
        if (!versionString && !settings2.disableNvmrc) {
          versionFile = path.join(dir, ".nvmrc");
          try {
            versionString = fs.readFileSync(versionFile, "utf8").trim();
          } catch (e) {
            Error3.throwIfNot(Error3.ENOENT, e, "Failed to read file: " + versionFile);
          }
        }
        if (versionString) {
          try {
            version = NodeVersion.parse(versionString);
            version.arch = version.arch || version.defaultArch;
            break;
          } catch (e) {
            throw new Error3("Failed to parse version in file: " + versionFile, e);
          }
        }
        let parentDir = path.dirname(dir);
        dir = parentDir !== dir ? parentDir : null;
      }
      if (version) {
        let resolvedVersion = nvsList.find(version);
        if (resolvedVersion) {
          return Promise.resolve(resolvedVersion);
        } else {
          if (!settings2.quiet) {
            console.log("Adding: " + version);
          }
          return nvsAddRemove.addAsync(version).then(() => {
            return version;
          });
        }
      } else {
        nvsLink = nvsLink || require_link();
        return Promise.resolve(nvsLink.getLinkedVersion() ? "default" : null);
      }
    }
    function autoSwitchAsync(cwd) {
      if (process.env["NVS_EXECUTE"]) {
        throw new Error3(
          "The 'auto' command is not available when invoking this script as an" + os2.EOL + "executable. To enable PATH updates, source nvs.sh from your shell instead."
        );
      }
      return findAutoVersionAsync(cwd).then((version) => {
        return nvsUse.use(version);
      });
    }
    function enableAutoSwitch(enable) {
      if (/\.cmd/i.test(process.env["NVS_POSTSCRIPT"])) {
        throw new Error3("Automatic switching is not supported from a Windows Command Prompt." + os2.EOL + "Use PowerShell instead.");
      }
      let psScriptFile = path.join(path.resolve(__dirname, ".."), "nvs.ps1");
      if (enable) {
        require_postScript().generate(null, {
          ".PS1": [
            // Patch the function that is invoked every time PowerShell shows a prompt.
            // This does NOT require the script to be sourced.
            "if (-not $global:NVS_ORIGINAL_PROMPT) {",
            "  $global:NVS_ORIGINAL_PROMPT = $Function:prompt",
            "}",
            "function global:prompt {",
            "  # We have to do this so a prompt customization tool (like Oh My Posh or Starship) can get",
            "  # the correct last command execution status and native command return code.",
            "  $global:NVS_ORIGINAL_LASTEXECUTIONSTATUS = $?",
            "  $originalExitCode = $global:LASTEXITCODE",
            '  . "' + psScriptFile + '" "prompt"',
            "  $global:LASTEXITCODE = $originalExitCode",
            "  $global:NVS_ORIGINAL_PROMPT.Invoke()",
            "}"
          ],
          ".SH": [
            'function cd () { builtin cd "$@" && nvs cd; }',
            'function pushd () { builtin pushd "$@" && nvs cd; }',
            'function popd () { builtin popd "$@" && nvs cd; }'
          ]
        });
      } else {
        require_postScript().generate(null, {
          ".PS1": [
            "if ($global:NVS_ORIGINAL_PROMPT) {",
            "  $Function:prompt = $global:NVS_ORIGINAL_PROMPT",
            '  Remove-Variable -Name @("NVS_ORIGINAL_PROMPT", "NVS_ORIGINAL_LASTEXECUTIONSTATUS") -Scope global',
            "}"
          ],
          ".SH": [
            'function cd () { builtin cd "$@"; }',
            'function pushd () { builtin pushd "$@"; }',
            'function popd () { builtin popd "$@"; }'
          ]
        });
      }
    }
    module2.exports = {
      findAutoVersionAsync,
      autoSwitchAsync,
      enableAutoSwitch
    };
  }
});

// lib/install.js
var require_install = __commonJS({
  "lib/install.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var nvsUse = require_use();
    var nvsLink = require_link();
    var nvsPostScript = require_postScript();
    var nvsAuto = require_auto();
    var isMingwBash = nvsUse.isMingwBash;
    var isWindows = nvsUse.isWindows;
    function install() {
      let result = [];
      if (isWindows) {
        let nvsRoot = path.resolve(__dirname, "..");
        let envPath = process.env["PATH"];
        let envPathParts = envPath.split(";");
        if (!envPathParts.find((pathPart) => {
          if (pathPart.endsWith(path.sep)) {
            pathPart = pathPart.substr(0, pathPart.length - 1);
          }
          return pathPart.toLowerCase() === nvsRoot.toLowerCase();
        })) {
          result.push("PATH += " + nvsUse.homePath(nvsRoot));
          envPath = nvsRoot + ";" + envPath;
          nvsPostScript.generate({ "PATH": envPath });
        }
        let isSystem = isInSystemDirectory();
        result = result.concat(nvsLink.linkToWindowsProfilePath(
          true,
          settings2.home,
          isSystem
        ));
      } else {
        let profileFile = getShellProfile();
        result = result.concat(installToShellProfile(profileFile));
      }
      return result;
    }
    function uninstall() {
      let result = [];
      nvsAuto.enableAutoSwitch(false);
      result = result.concat(nvsUse.use(null));
      result = result.concat(nvsLink.unlink());
      if (isWindows) {
        let nvsRoot = path.resolve(__dirname, "..");
        let envPath = process.env["PATH"];
        let envPathParts = envPath.split(";");
        let index = envPathParts.findIndex((pathPart) => {
          if (pathPart.endsWith(path.sep)) {
            pathPart = pathPart.substr(0, pathPart.length - 1);
          }
          return pathPart.toLowerCase() === nvsRoot.toLowerCase();
        });
        if (index >= 0) {
          result.push("PATH -= " + nvsUse.homePath(nvsRoot));
          envPathParts.splice(index, 1);
          envPath = envPathParts.join(";");
          nvsPostScript.generate({ "PATH": envPath });
        }
        let isSystem = isInSystemDirectory();
        result = result.concat(nvsLink.linkToWindowsProfilePath(
          false,
          settings2.home,
          isSystem
        ));
      } else {
        let profileFile = getShellProfile();
        if (profileFile) {
          result = result.concat(uninstallFromShellProfile(profileFile));
        }
      }
      return result;
    }
    function getShellProfile() {
      const profileFile = process.env["NVS_SHELL_PROFILE"];
      if (profileFile) {
        return profileFile;
      }
      let fileExists = (f) => {
        try {
          fs.accessSync(f);
          return true;
        } catch (e) {
          Error3.throwIfNot(Error3.ENOENT, e);
        }
      };
      const shell = process.env["SHELL"];
      const shellName = shell && path.basename(shell);
      if (isInSystemDirectory()) {
        if (shellName === "bash") {
          if (fileExists("/etc/bashrc")) return "/etc/bashrc";
        }
        if (fileExists("/etc/profile")) return "/etc/profile";
      } else {
        const userHome = process.env["HOME"];
        if (!userHome) return null;
        if (shellName === "bash") {
          if (fileExists(path.join(userHome, ".bashrc"))) {
            return path.join(userHome, ".bashrc");
          } else if (fileExists(path.join(userHome, ".bash_profile"))) {
            return path.join(userHome, ".bash_profile");
          }
        } else if (shellName === "zsh") {
          if (fileExists(path.join(userHome, ".zshrc"))) {
            return path.join(userHome, ".zshrc");
          }
        }
        if (fileExists(path.join(userHome, ".profile"))) {
          return path.join(userHome, ".profile");
        }
        if (isMingwBash) {
          if (fileExists(path.join(userHome, ".bashrc"))) {
            return path.join(userHome, ".bashrc");
          }
          if (fileExists(path.join(userHome, ".bash_profile"))) {
            return path.join(userHome, ".bash_profile");
          }
          return path.join(userHome, ".bashrc");
        }
      }
      return null;
    }
    function installToShellProfile(profileFile) {
      let rootPathAbs = path.resolve(__dirname, "..");
      let homePathAbs = path.resolve(settings2.home);
      let rootPath = nvsUse.homePath(rootPathAbs).replace("~", "$HOME");
      let homePath = nvsUse.homePath(settings2.home).replace("~", "$HOME");
      if (homePath.endsWith("/") || homePath.endsWith("\\")) {
        homePath = homePath.substr(0, homePath.length - 1);
      }
      if (rootPathAbs === homePathAbs) {
        rootPath = "$NVS_HOME";
      }
      const installLines = isMingwBash ? [
        "function setupNvs {",
        '	export NVS_HOME="' + homePath + '";',
        '	[ -s "' + rootPath + '/nvs.sh" ] && source "' + rootPath + '/nvs.sh" >> /dev/null;',
        "	return 0;",
        "}",
        "setupNvs"
      ] : [
        'export NVS_HOME="' + homePath + '"',
        '[ -s "' + rootPath + '/nvs.sh" ] && . "' + rootPath + '/nvs.sh"'
      ];
      if (!profileFile) {
        return [
          "Shell profile file not detected. To initialize NVS,",
          "add lines similar to the following to your profile:",
          ""
        ].concat(installLines).concat([""]);
      }
      let profileContents = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, "utf8") : "";
      if (/\/nvs.sh/.test(profileContents)) {
        return [
          "NVS invocation detected already in profile file: " + nvsUse.homePath(profileFile)
        ];
      }
      let extraLine = profileContents.endsWith("\n") ? "" : "\n";
      profileContents += extraLine + installLines.join("\n") + "\n";
      fs.writeFileSync(profileFile, profileContents, "utf8");
      return [nvsUse.homePath(profileFile) + " += nvs.sh"];
    }
    function uninstallFromShellProfile(profileFile) {
      let profileContents = fs.readFileSync(profileFile, "utf8");
      let nvsInvocationRegex = /(\n[^\n]*((NVS_HOME)|(\/nvs\.sh))[^\n]*)+\n/;
      let m = nvsInvocationRegex.exec(profileContents);
      if (m) {
        profileContents = profileContents.replace(nvsInvocationRegex, "\n");
        fs.writeFileSync(profileFile, profileContents, "utf8");
        return [nvsUse.homePath(profileFile) + " -= nvs.sh"];
      } else {
        return [
          "NVS invocation not detected in profile file: " + nvsUse.homePath(profileFile)
        ];
      }
    }
    function isInSystemDirectory() {
      if (typeof settings2.linkToSystem === "boolean") {
        return settings2.linkToSystem;
      }
      if (process.env["NVS_LINK_TO_SYSTEM"]) {
        return process.env["NVS_LINK_TO_SYSTEM"] === "1";
      }
      let isHomeUnder = (envDir) => {
        if (!envDir) {
          return false;
        }
        if (!envDir.endsWith(path.sep)) {
          envDir += path.sep;
        }
        return settings2.home.toLowerCase().startsWith(envDir.toLowerCase());
      };
      if (isWindows) {
        let userAppdataDir = process.env["LOCALAPPDATA"];
        let userProfileDir = process.env["USERPROFILE"];
        let progFilesDir = process.env["ProgramFiles"];
        let progFilesX86Dir = process.env["ProgramFiles(x86)"];
        let progDataDir = process.env["ProgramData"];
        if (isHomeUnder(userAppdataDir) || isHomeUnder(userProfileDir)) {
          return false;
        } else if (isHomeUnder(progFilesDir) || isHomeUnder(progFilesX86Dir) || isHomeUnder(progDataDir)) {
          return true;
        }
      } else {
        let userHomeDir = process.env["HOME"];
        if (isHomeUnder(userHomeDir)) {
          return false;
        } else if (isHomeUnder("/usr/local/")) {
          return true;
        }
      }
      throw new Error3('NVS_HOME is not under a well-known user or system directory. Set the "linkToSystem" property in settings.json to true or false to specify whether NVS should link to into system directories.');
    }
    module2.exports = {
      install,
      uninstall,
      isInSystemDirectory
    };
  }
});

// lib/link.js
var require_link = __commonJS({
  "lib/link.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var os2 = require("os");
    var path = require("path");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var NodeVersion = require_version();
    var nvsUse = require_use();
    var nvsList = null;
    var nvsInstall = null;
    var nvsWindowsEnv = null;
    function link(version) {
      if (!version) {
        version = nvsUse.getCurrentVersion();
        if (!version) {
          throw new Error3("Specify a version to link.");
        }
      } else {
        nvsList = nvsList || require_list();
        let resolvedVersion = nvsList.find(version);
        if (!resolvedVersion) {
          throw new Error3("Specified version not found." + os2.EOL + "To add this version now: nvs add " + version, Error3.ENOENT);
        }
        version = resolvedVersion;
      }
      let linkPath = nvsUse.getLinkPath();
      let linkTarget = nvsUse.getVersionDir(version);
      if (linkTarget.endsWith(path.sep)) {
        linkTarget = linkTarget.substr(0, linkTarget.length - 1);
      }
      let result = [];
      nvsInstall = nvsInstall || require_install();
      if (nvsInstall.isInSystemDirectory()) {
        if (nvsUse.isWindows) {
          result = result.concat(linkToProgramFiles(linkTarget));
          result = result.concat(linkToWindowsProfilePath(false, linkPath, false));
        } else {
          result = result.concat(linkToUsrLocal(linkTarget));
        }
      } else if (nvsUse.isWindows) {
        result = result.concat(linkToWindowsProfilePath(true, linkPath, false));
      }
      let relativeTarget = nvsUse.isWindows ? linkTarget : path.relative(path.dirname(linkPath), linkTarget);
      let previousLinkTarget = null;
      try {
        previousLinkTarget = fs.readlinkSync(linkPath);
        if (previousLinkTarget.endsWith(path.sep)) {
          previousLinkTarget = previousLinkTarget.substr(0, previousLinkTarget.length - 1);
        }
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Failed to read link: " + linkPath);
      }
      if (previousLinkTarget !== relativeTarget) {
        result.splice(0, 0, nvsUse.homePath(linkPath) + " -> " + nvsUse.homePath(linkTarget));
        try {
          if (previousLinkTarget != null) {
            fs.unlinkSync(linkPath);
          }
          fs.symlinkSync(relativeTarget, linkPath, "junction");
        } catch (e) {
          throw new Error3("Failed to create symbolic link: " + linkPath, e);
        }
      }
      return result;
    }
    function unlink(version) {
      if (version) {
        if (!version.semanticVersion) {
          throw new Error3("Specify a semantic version.");
        }
        let linkVersion = getLinkedVersion();
        if (!linkVersion || !NodeVersion.equal(version, linkVersion)) {
          return [];
        }
      }
      let result = [];
      let linkPath = nvsUse.getLinkPath();
      let currentVersion = nvsUse.getCurrentVersion();
      nvsInstall = nvsInstall || require_install();
      if (nvsInstall.isInSystemDirectory()) {
        if (nvsUse.isWindows) {
          result = result.concat(linkToWindowsProfilePath(false, linkPath, false));
          result = result.concat(linkToProgramFiles(null));
        } else {
          result = result.concat(linkToUsrLocal(null));
        }
      } else if (nvsUse.isWindows) {
        result = result.concat(linkToWindowsProfilePath(false, linkPath, false));
      }
      try {
        fs.unlinkSync(linkPath);
        result.push("- " + nvsUse.homePath(linkPath));
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Failed to remove symbolic link: " + linkPath);
      }
      if (currentVersion && currentVersion.default) {
        result = result.concat(nvsUse.use(null));
      }
      return result;
    }
    function linkToProgramFiles(linkTarget) {
      let result = [];
      let linkPath = nvsUse.getSystemLinkPath();
      let linkStat = null;
      try {
        linkStat = fs.lstatSync(linkPath);
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Failed to access path: " + linkPath);
      }
      if (!linkTarget) {
        result = result.concat(linkToWindowsProfilePath(false, linkPath, true));
      }
      if (linkStat) {
        if (linkStat.isSymbolicLink()) {
          let previousLinkTarget = null;
          try {
            previousLinkTarget = fs.readlinkSync(linkPath);
            if (previousLinkTarget.endsWith(path.sep)) {
              previousLinkTarget = previousLinkTarget.substr(0, previousLinkTarget.length - 1);
            }
          } catch (e) {
            Error3.throwIfNot(Error3.ENOENT, e, "Failed to read link: " + linkPath);
          }
          if (previousLinkTarget !== linkTarget) {
            try {
              fs.unlinkSync(linkPath);
            } catch (e) {
              Error3.throwIfNot(
                Error3.ENOENT,
                e,
                "Failed to remove symbolic link: " + linkPath
              );
            }
            if (!linkTarget) {
              result.push("- " + nvsUse.homePath(linkPath));
            }
            linkStat = null;
          }
        } else {
          result.push("Not touching existing Node.js directory: " + nvsUse.homePath(linkPath));
          return result;
        }
      }
      if (linkTarget) {
        if (!linkStat) {
          result.push(linkPath + " -> " + linkTarget);
          try {
            fs.symlinkSync(linkTarget, linkPath, "junction");
          } catch (e) {
            throw new Error3("Failed to create symbolic link: " + linkPath, e);
          }
        }
        result = result.concat(linkToWindowsProfilePath(true, linkPath, true));
      }
      return result;
    }
    function linkToUsrLocal(linkTarget) {
      let result = [];
      let systemBinPath = "/usr/local/bin";
      let systemLibPath = "/usr/local/lib";
      let nodeBinPath = path.join(systemBinPath, "node");
      let nodeBinStats = null;
      try {
        nodeBinStats = fs.lstatSync(nodeBinPath);
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e);
      }
      let nodeModulesPath = path.join(systemLibPath, "node_modules");
      let nodeModulesStats = null;
      try {
        nodeModulesStats = fs.lstatSync(nodeModulesPath);
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e);
      }
      let systemLinkMap = readLinks(systemBinPath, (target) => {
        return isLinkTargetingNvs(systemBinPath, target);
      });
      if (linkTarget) {
        if (nodeBinStats && !nodeBinStats.isSymbolicLink()) {
          result.push("Not touching existing Node.js installation: " + nodeBinPath);
          return result;
        } else if (nodeModulesStats && !nodeModulesStats.isSymbolicLink()) {
          result.push("Not touching existing Node.js installation: " + nodeModulesPath);
          return result;
        }
        let binTarget = path.join(linkTarget, "bin/node");
        if (nodeBinStats) {
          let currentBinTarget = fs.readlinkSync(nodeBinPath);
          currentBinTarget = path.resolve(systemBinPath, currentBinTarget);
          if (currentBinTarget.toLowerCase() !== binTarget.toLowerCase()) {
            fs.unlinkSync(nodeBinPath);
          }
        }
        let relativeBinTarget = path.relative(systemBinPath, binTarget);
        fs.symlinkSync(relativeBinTarget, nodeBinPath);
        result.push(nodeBinPath + " -> " + binTarget);
        let modulesTarget = path.join(linkTarget, "lib/node_modules");
        if (nodeBinStats) {
          let currentModulesTarget = fs.readlinkSync(nodeModulesPath);
          currentModulesTarget = path.resolve(systemLibPath, currentModulesTarget);
          if (currentModulesTarget.toLowerCase() !== modulesTarget.toLowerCase()) {
            fs.unlinkSync(nodeModulesPath);
          }
        }
        let relativeModulesTarget = path.relative(systemBinPath, modulesTarget);
        fs.symlinkSync(relativeModulesTarget, nodeModulesPath);
        result.push(nodeModulesPath + " -> " + modulesTarget);
        let versionLinkMap = readLinks(path.join(linkTarget, "bin"));
        Object.keys(versionLinkMap).sort().forEach((linkName) => {
          let versionLinkTarget = versionLinkMap[linkName];
          versionLinkTarget = path.resolve(
            path.join(linkTarget, "bin"),
            versionLinkTarget
          );
          let systemLinkPath = path.join(systemBinPath, linkName);
          let systemLinkTarget = systemLinkMap[linkName];
          if (systemLinkTarget) {
            systemLinkTarget = path.resolve(systemBinPath, systemLinkTarget);
            if (systemLinkTarget.toLowerCase() !== versionLinkTarget.toLowerCase()) {
              fs.unlinkSync(systemLinkPath);
              systemLinkTarget = null;
            }
          }
          if (!systemLinkTarget) {
            let relativeTarget = path.relative(systemBinPath, versionLinkTarget);
            fs.symlinkSync(relativeTarget, systemLinkPath);
            result.push(systemLinkPath + " -> " + path.join(linkTarget, "bin", linkName));
          }
        });
        Object.keys(systemLinkMap).sort().forEach((linkName) => {
          if (!versionLinkMap[linkName]) {
            let linkPath = path.join(systemBinPath, linkName);
            fs.unlinkSync(linkPath);
            result.push("- " + linkPath);
          }
        });
      } else {
        Object.keys(systemLinkMap).forEach((linkName) => {
          let linkPath = path.join(systemBinPath, linkName);
          fs.unlinkSync(linkPath);
          result.push("- " + linkPath);
        });
        if (nodeModulesStats && nodeModulesStats.isSymbolicLink()) {
          let modulesTarget = fs.readlinkSync(nodeModulesPath);
          if (isLinkTargetingNvs(modulesTarget)) {
            fs.unlinkSync(nodeModulesPath);
            result.push("- " + nodeModulesPath);
          }
        }
      }
      return result;
    }
    function isLinkTargetingNvs(linkDir, linkTarget) {
      let absoluteTarget = path.resolve(linkDir, linkTarget);
      return absoluteTarget.toLowerCase().startsWith(settings2.home.toLowerCase());
    }
    function readLinks(dir, linkTargetFilter) {
      let linkMap = {};
      fs.readdirSync(dir).forEach((childName) => {
        try {
          let childPath = path.join(dir, childName);
          let childStats = fs.lstatSync(childPath);
          if (childStats.isSymbolicLink()) {
            let linkTarget = fs.readlinkSync(childPath);
            if (!linkTargetFilter || linkTargetFilter(linkTarget)) {
              linkMap[childName] = linkTarget;
            }
          }
        } catch (e) {
        }
      });
      return linkMap;
    }
    function linkToWindowsProfilePath(link2, linkPath, isSystem) {
      let result = [];
      nvsWindowsEnv = nvsWindowsEnv || require_windowsEnv();
      let profilePath = nvsWindowsEnv.getEnvironmentVariable("PATH", isSystem);
      let pathParts = profilePath ? profilePath.split(path.delimiter).filter((part) => part) : [];
      let saveChanges = false;
      if (linkPath.endsWith(path.sep)) {
        linkPath = linkPath.substr(0, linkPath.length - 1);
      }
      let linkIndex = pathParts.findIndex((part) => {
        if (part.endsWith(path.sep)) {
          part = part.substr(0, part.length - 1);
        }
        return part.toLowerCase() === linkPath.toLowerCase();
      });
      if (link2 && linkIndex < 0) {
        pathParts.splice(linkIndex, 0, linkPath);
        result.push((isSystem ? "System" : "User") + " profile PATH += " + nvsUse.homePath(linkPath));
        saveChanges = true;
      } else if (!link2 && linkIndex >= 0) {
        pathParts.splice(linkIndex, 1);
        result.push((isSystem ? "System" : "User") + " profile PATH -= " + nvsUse.homePath(linkPath));
        saveChanges = true;
      }
      let configPrefix = nvsWindowsEnv.getEnvironmentVariable("NPM_CONFIG_PREFIX", isSystem);
      if (configPrefix) {
        saveChanges = true;
      }
      if (saveChanges) {
        nvsWindowsEnv.setEnvironmentVariable(
          "PATH",
          pathParts.join(path.delimiter),
          isSystem
        );
        if (configPrefix) {
          nvsWindowsEnv.setEnvironmentVariable(
            "NPM_CONFIG_PREFIX",
            null,
            isSystem
          );
        }
      }
      return result;
    }
    function getLinkedVersion(linkPath) {
      if (!linkPath) {
        linkPath = nvsUse.getLinkPath();
      }
      let linkTarget;
      try {
        let linkStat = fs.lstatSync(linkPath);
        if (!linkStat.isSymbolicLink()) {
          return null;
        }
        linkTarget = fs.readlinkSync(linkPath);
      } catch (e) {
        if (e.code !== Error3.ENOENT && e.code !== Error3.EIO) {
          throw new Error3("Failed to read symbolic link: " + linkPath, e);
        }
        return null;
      }
      if (!path.isAbsolute(linkTarget)) {
        linkTarget = path.join(path.dirname(linkPath), linkTarget);
      }
      if (linkTarget.endsWith(path.sep)) {
        linkTarget = linkTarget.substr(0, linkTarget.length - 1);
      }
      let linkVersion = null;
      if (linkTarget.toLowerCase().startsWith(settings2.home.toLowerCase())) {
        let linkVersionString = linkTarget.substr(settings2.home.length);
        if (path.sep === "\\") {
          linkVersionString = linkVersionString.replace(/\\/g, "/");
        }
        linkVersion = NodeVersion.parse(linkVersionString, true);
      } else {
        Object.keys(settings2.aliases).forEach((name) => {
          let value = settings2.aliases[name];
          if (path.isAbsolute(value) && value.toLowerCase() === linkTarget.toLowerCase()) {
            linkVersion = new NodeVersion();
            linkVersion.label = name;
            linkVersion.path = value;
          }
        });
      }
      return linkVersion;
    }
    module2.exports = {
      link,
      unlink,
      getLinkedVersion,
      linkToWindowsProfilePath
    };
  }
});

// lib/use.js
var require_use = __commonJS({
  "lib/use.js"(exports2, module2) {
    "use strict";
    var childProcess = require("child_process");
    var fs = require("fs");
    var os2 = require("os");
    var path = require("path");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var NodeVersion = require_version();
    var nvsList = null;
    var nvsLink = null;
    var isMingwBash = process.env["MSYSTEM"] === "MINGW64";
    var isWindows = !isMingwBash && process.platform === "win32";
    var isMac = process.platform === "darwin";
    var linkName = "default";
    function getCurrentVersion() {
      let envPath = process.env["PATH"];
      if (!envPath) {
        throw new Error3("Missing PATH environment variable.");
      }
      let version = null;
      let pathEntries = envPath.split(path.delimiter);
      for (let i = 0; i < pathEntries.length && !version; i++) {
        let pathEntry = pathEntries[i];
        if (pathEntry.endsWith(path.sep)) {
          pathEntry = pathEntry.substr(0, pathEntry.length - 1);
        }
        if (pathEntry.toLowerCase().startsWith(settings2.home.toLowerCase())) {
          if (!isWindows && !isMingwBash) {
            if (pathEntry.endsWith(path.sep + "bin")) {
              pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            } else if (pathEntry !== getLinkPath()) {
              continue;
            }
          }
          let versionString = pathEntry.substr(settings2.home.length);
          if (versionString === linkName) {
            nvsLink = nvsLink || require_link();
            version = nvsLink.getLinkedVersion();
            if (version) {
              version.default = true;
            }
            break;
          }
          if (path.sep === "\\") {
            versionString = versionString.replace(/\\/g, "/");
          }
          version = NodeVersion.tryParse(versionString);
        } else if (isWindows && pathEntry.toLowerCase() === getSystemLinkPath().toLowerCase()) {
          nvsLink = nvsLink || require_link();
          version = nvsLink.getLinkedVersion(getSystemLinkPath());
          if (version) {
            version.default = true;
          }
        } else {
          Object.keys(settings2.aliases).forEach((name) => {
            let value = settings2.aliases[name];
            if (path.isAbsolute(value) && value.toLowerCase() === pathEntry.toLowerCase()) {
              version = new NodeVersion();
              version.label = name;
              version.path = value;
            }
          });
        }
      }
      return version;
    }
    function use(version, skipUpdateShellEnv) {
      if (process.env["NVS_EXECUTE"]) {
        throw new Error3(
          "The 'use' command is not available when invoking this script as an" + os2.EOL + "executable. To enable PATH updates, source nvs.sh from your shell instead."
        );
      }
      let envPath = process.env["PATH"];
      if (!envPath) {
        throw new Error3("Missing PATH environment variable.");
      }
      if (version instanceof NodeVersion) {
        nvsList = nvsList || require_list();
        let resolvedVersion = nvsList.find(version);
        if (!resolvedVersion) {
          throw new Error3("Specified version not found." + os2.EOL + "To add this version now: nvs add " + version, Error3.ENOENT);
        }
        delete resolvedVersion.os;
        version = resolvedVersion;
      }
      let result = [];
      let pathEntries = envPath.split(path.delimiter);
      let saveChanges = false;
      for (let i = 0; i < pathEntries.length; i++) {
        let pathEntry = pathEntries[i];
        if (pathEntry.endsWith(path.sep)) {
          pathEntry = pathEntry.substr(0, pathEntry.length - 1);
        }
        let previousVersion = null;
        if (pathEntry.toLowerCase().startsWith(settings2.home.toLowerCase())) {
          if (!isWindows && !isMingwBash) {
            if (pathEntry.endsWith(path.sep + "bin")) {
              pathEntry = pathEntry.substr(0, pathEntry.length - 4);
            } else if (pathEntry !== getLinkPath()) {
              continue;
            }
          }
          let versionString = pathEntry.substr(settings2.home.length);
          if (versionString === linkName) {
            previousVersion = linkName;
          } else {
            if (path.sep === "\\") {
              versionString = versionString.replace(/\\/g, "/");
            }
            previousVersion = NodeVersion.tryParse(versionString);
          }
        } else if (isWindows && pathEntry.toLowerCase() === getSystemLinkPath().toLowerCase()) {
          previousVersion = linkName;
        } else {
          Object.keys(settings2.aliases).forEach((name) => {
            let value = settings2.aliases[name];
            if (path.isAbsolute(value) && value.toLowerCase() === pathEntry.toLowerCase()) {
              previousVersion = new NodeVersion();
              previousVersion.label = name;
              previousVersion.path = value;
            }
          });
        }
        if (previousVersion) {
          if (i === 0 && version && (version === previousVersion || NodeVersion.equal(version, previousVersion))) {
            version = null;
          } else {
            pathEntries.splice(i--, 1);
            if (!isWindows && !isMingwBash && !(previousVersion instanceof NodeVersion && previousVersion.path)) {
              pathEntry = path.join(pathEntry, "bin");
            }
            result.push("PATH -= " + homePath(pathEntry));
            saveChanges = true;
          }
        }
      }
      let versionBinDir = null;
      if (version === linkName) {
        nvsLink = nvsLink || require_link();
        let version2 = nvsLink.getLinkedVersion();
        if (version2) {
          versionBinDir = getLinkPath();
          if (!isWindows && !isMingwBash && !version2.path) {
            versionBinDir = path.join(versionBinDir, "bin");
          }
        } else {
          throw new Error3("No default node version. Specify a version to use, or use `nvs link` to set a default.");
        }
      } else if (version) {
        versionBinDir = getVersionBinDir(version);
      }
      if (versionBinDir) {
        if (versionBinDir.endsWith(path.sep)) {
          versionBinDir = versionBinDir.substr(0, versionBinDir.length - 1);
        }
        pathEntries.splice(0, 0, versionBinDir);
        result.push("PATH += " + homePath(versionBinDir));
        saveChanges = true;
      }
      if (saveChanges) {
        envPath = pathEntries.join(path.delimiter);
        process.env["PATH"] = envPath;
        delete process.env["NPM_CONFIG_PREFIX"];
        if (!skipUpdateShellEnv && !settings2.skipUpdateShellEnv) {
          require_postScript().generate({ "PATH": envPath, "NPM_CONFIG_PREFIX": null });
        }
      }
      return result;
    }
    function run(version, args) {
      if (!version) {
        version = getCurrentVersion() || "default";
      }
      if (version === "default") {
        nvsLink = nvsLink || require_link();
        version = nvsLink.getLinkedVersion();
        if (version == null) {
          throw new Error3("No default node version. Specify a version to run, or use `nvs link` to set a default.");
        }
      }
      nvsList = nvsList || require_list();
      let resolvedVersion = nvsList.find(version);
      if (!resolvedVersion) {
        throw new Error3("Specified version not found." + os2.EOL + "To add this version now: nvs add " + version, Error3.ENOENT);
      }
      version = resolvedVersion;
      let child = childProcess.spawnSync(
        getVersionBinary(version),
        args,
        { stdio: "inherit" }
      );
      if (child.error) {
        throw new Error3("Failed to launch node child process.", child.error);
      } else {
        process.exitCode = child.status;
      }
    }
    function exec(version, exe, args) {
      if (!exe) {
        throw new Error3("Specify an executable.");
      }
      let skipUpdateShellEnv = true;
      use(version, skipUpdateShellEnv);
      exe = findInPath(exe);
      let child = childProcess.spawnSync(
        exe,
        args,
        { stdio: "inherit" }
      );
      if (child.error) {
        throw new Error3("Failed to launch process.", child.error);
      } else {
        process.exitCode = child.status;
      }
    }
    function findInPath(exe) {
      if (path.isAbsolute(exe)) {
        return exe;
      }
      if (path.dirname(exe) !== ".") {
        throw new Error3("A relative executable path is not valid. Specify an executable name or absolute path.");
      }
      let pathExtensions = [""];
      if (isWindows && process.env["PATHEXT"]) {
        pathExtensions = process.env["PATHEXT"].split(";").map((ext) => ext.toUpperCase());
        if (pathExtensions.indexOf(path.extname(exe).toUpperCase()) >= 0) {
          pathExtensions = [""];
        }
      }
      let pathEntries = process.env["PATH"].split(path.delimiter);
      for (let i = 0; i < pathEntries.length; i++) {
        for (let j = 0; j < pathExtensions.length; j++) {
          let exePath = path.join(pathEntries[i], exe) + pathExtensions[j];
          try {
            fs.accessSync(exePath, fs.constants.X_OK);
            return exePath;
          } catch (e) {
          }
        }
      }
      ;
      throw new Error3("Executable not found in PATH: " + exe);
    }
    function getVersionDir(version) {
      if (version.path) {
        return version.path;
      } else if (!version.semanticVersion) {
        throw new Error3("Specify a semantic version.");
      } else if (!version.remoteName) {
        throw new Error3("Specify a remote name.");
      } else if (!version.arch) {
        throw new Error3("Specify a processor architecture.");
      }
      return path.join(
        settings2.home,
        version.remoteName,
        version.semanticVersion,
        version.arch
      );
    }
    function getVersionBinDir(version) {
      let versionDir = getVersionDir(version);
      if (!isWindows && !isMingwBash && !version.path) {
        versionDir = path.join(versionDir, "bin");
      }
      return versionDir;
    }
    function getVersionBinary(version) {
      if (!version) {
        version = getCurrentVersion();
        if (!version) {
          return null;
        }
      }
      let binaryName = NodeVersion.getBinaryNameFromVersion(version.semanticVersion);
      let nodeBinPath = path.join(getVersionBinDir(version), isWindows || isMingwBash ? binaryName + ".exe" : binaryName);
      try {
        fs.accessSync(nodeBinPath, fs.constants.X_OK);
        return nodeBinPath;
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Cannot access binary: " + nodeBinPath);
        return null;
      }
    }
    function homePath(fullPath) {
      if (isWindows) {
        let userAppdataDir = process.env["LOCALAPPDATA"];
        if (userAppdataDir && fullPath.toLowerCase().startsWith(userAppdataDir.toLowerCase())) {
          let postScriptFile = process.env["NVS_POSTSCRIPT"];
          let inPowerShell = postScriptFile && path.extname(postScriptFile).toUpperCase() === ".PS1";
          return (inPowerShell ? "$env:LOCALAPPDATA" : "%LOCALAPPDATA%") + fullPath.substr(userAppdataDir.length);
        }
      } else {
        let userHomeDir = process.env["HOME"];
        if (userHomeDir && fullPath.toLowerCase().startsWith(userHomeDir.toLowerCase())) {
          return "~" + fullPath.substr(userHomeDir.length);
        }
      }
      return fullPath;
    }
    function getLinkPath() {
      return path.join(settings2.home, linkName);
    }
    function getSystemLinkPath() {
      if (isWindows || isMingwBash) {
        return path.join(process.env["ProgramFiles"], "nodejs");
      }
    }
    module2.exports = {
      isWindows,
      isMingwBash,
      isMac,
      use,
      run,
      exec,
      getCurrentVersion,
      getVersionDir,
      getVersionBinDir,
      getVersionBinary,
      homePath,
      getLinkPath,
      getSystemLinkPath
    };
  }
});

// lib/list.js
var require_list = __commonJS({
  "lib/list.js"(exports2, module2) {
    "use strict";
    var path = require("path");
    var { URL } = require("url");
    var fs = require("fs");
    var { httpGet } = require_http();
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var NodeVersion = require_version();
    var nvsUse = null;
    var nvsLink = null;
    var githubReleasesRegex = /^https?:\/\/github.com\/([^/]+)\/([^/]+)(?:\/releases)?\/?(?:#(.*))?$/;
    function find(filter, versions) {
      if (!versions) {
        versions = getVersions();
      }
      let filteredVersions = filterVersions(filter, versions);
      let uniqueArchs = filteredVersions.map((v) => v.arch).filter((a, i, self) => a && self.indexOf(a) === i);
      if (uniqueArchs.length > 0) {
        filteredVersions = filteredVersions.filter((v) => v.arch === (filter.arch || v.defaultArch));
      }
      let resolvedVersion = filteredVersions[0];
      if (!resolvedVersion) {
        return null;
      }
      let foundVersion = new NodeVersion(
        resolvedVersion.remoteName,
        resolvedVersion.semanticVersion,
        resolvedVersion.arch || filter.arch || resolvedVersion.defaultArch
      );
      foundVersion.label = resolvedVersion.label;
      foundVersion.path = resolvedVersion.path;
      foundVersion.os = NodeVersion.defaultOs;
      if (resolvedVersion.packages) {
        foundVersion.packages = resolvedVersion.packages;
      }
      return foundVersion;
    }
    function filterVersions(filter, versions) {
      let specialFilter = null;
      if (filter.label === "latest" || filter.label === "lts" || filter.label === "current" || filter.label === "default") {
        specialFilter = filter.label;
        filter = new NodeVersion(filter.remoteName, filter.semanticVersion, filter.arch);
      }
      let filteredVersions = versions.filter((v) => filter.match(v));
      if (specialFilter === "latest") {
        filteredVersions = filteredVersions.filter((v) => !v.path);
      } else if (specialFilter === "lts") {
        filteredVersions = filteredVersions.filter((v) => !v.path && v.label);
      } else if (specialFilter === "current") {
        filteredVersions = filteredVersions.filter((v) => v.current);
      } else if (specialFilter === "default") {
        filteredVersions = filteredVersions.filter((v) => v.default);
      }
      return filteredVersions;
    }
    function list(filter) {
      let versions = getVersions();
      if (filter) {
        versions = filterVersions(filter, versions);
      }
      return versions.map((v) => v.toString({ marks: true, label: true }));
    }
    function listOutdatedAsync() {
      const semver = require_semver();
      function canUpgrade(v, rv, range) {
        return semver.neq(v.semanticVersion, rv.semanticVersion) && semver.satisfies(rv.semanticVersion, range + v.semanticVersion);
      }
      const versions = getVersions().map((v) => {
        return getRemoteVersionsAsync(v.remoteName).then((rvl) => {
          let upgrades = "";
          const patchVersions = rvl.filter((rv) => canUpgrade(v, rv, "~"));
          if (patchVersions.length > 0) {
            upgrades += " [~" + patchVersions[0].semanticVersion + "]";
          }
          const minorUpgradeVersions = rvl.filter((rv) => canUpgrade(v, rv, "^"));
          if (minorUpgradeVersions.length > 0 && minorUpgradeVersions[0] !== patchVersions[0]) {
            upgrades += " [^" + minorUpgradeVersions[0].semanticVersion + "]";
          }
          return v.toString({ marks: true, label: false }) + upgrades;
        });
      });
      return Promise.all(versions);
    }
    function getVersions(remoteName, semanticVersion, arch) {
      nvsUse = nvsUse || require_use();
      nvsLink = nvsLink || require_link();
      let versions = getVersionsInternal(remoteName, semanticVersion, arch);
      let currentVersion = nvsUse.getCurrentVersion();
      let defaultVersion = nvsLink.getLinkedVersion();
      Object.keys(settings2.aliases).forEach((name) => {
        let value = settings2.aliases[name];
        if (path.isAbsolute(value)) {
          let version = new NodeVersion();
          version.label = name;
          version.path = value;
          versions.push(version);
        }
      });
      versions.forEach((v) => {
        v.current = currentVersion && NodeVersion.equal(currentVersion, v);
        v.default = defaultVersion && NodeVersion.equal(defaultVersion, v);
      });
      versions = versions.sort(NodeVersion.compare);
      return versions;
    }
    function getVersionsInternal(remoteName, semanticVersion, arch) {
      let readdirIfExists = (dir) => {
        try {
          return fs.readdirSync(dir);
        } catch (e) {
          Error3.throwIfNot(Error3.ENOENT, e, "Cannot access directory: " + dir);
          return [];
        }
      };
      let result = [];
      if (!remoteName) {
        let childNames = readdirIfExists(settings2.home);
        childNames.forEach((childName) => {
          let childPath = path.join(settings2.home, childName);
          let stats = fs.lstatSync(childPath);
          if (stats.isDirectory() && childName !== "node_modules") {
            result = result.concat(getVersionsInternal(childName, semanticVersion, arch));
          }
        });
      } else if (!semanticVersion) {
        let childNames = readdirIfExists(path.join(settings2.home, remoteName));
        childNames.forEach((childName) => {
          let childPath = path.join(settings2.home, remoteName, childName);
          let stats = fs.lstatSync(childPath);
          if (stats.isDirectory()) {
            result = result.concat(getVersionsInternal(remoteName, childName, arch));
          }
        });
      } else if (!arch) {
        let childNames = readdirIfExists(path.join(
          settings2.home,
          remoteName,
          semanticVersion
        ));
        childNames.forEach((childName) => {
          let childPath = path.join(settings2.home, remoteName, semanticVersion, childName);
          let stats = fs.lstatSync(childPath);
          if (stats.isDirectory()) {
            result = result.concat(getVersionsInternal(remoteName, semanticVersion, childName));
          }
        });
      } else {
        let version = NodeVersion.tryParse(remoteName + "/" + semanticVersion + "/" + arch);
        if (version) {
          try {
            let versionProperties = JSON.parse(fs.readFileSync(
              path.join(nvsUse.getVersionDir(version), ".nvs"),
              "utf8"
            ));
            if (versionProperties) {
              version.label = versionProperties.label;
            }
          } catch (e) {
            Error3.throwIfNot(Error3.ENOENT, e);
          }
          let binPath = nvsUse.getVersionBinary(version);
          if (binPath) {
            result.push(version);
          }
        }
      }
      return result;
    }
    function listRemoteAsync(filter) {
      let remoteName = filter && filter.remoteName;
      if (!remoteName) {
        remoteName = settings2.remotes["default"];
        if (!remoteName) {
          throw new Error3("No default remote is set in settings.json");
        }
      }
      return getRemoteVersionsAsync(remoteName).then((versions) => {
        if (filter) {
          versions = filterVersions(filter, versions);
          if (filter.label === "latest" && versions.length > 0) {
            versions = [versions[0]];
          }
        }
        return versions.map((v) => v.toString({ marks: true, label: true }));
      });
    }
    getRemoteVersionsAsync.cache = /* @__PURE__ */ new Map();
    function getRemoteVersionsAsync(remoteName) {
      if (getRemoteVersionsAsync.cache.has(remoteName)) {
        return Promise.resolve(getRemoteVersionsAsync.cache.get(remoteName));
      }
      let res = _getRemoteVersionsAsync(remoteName);
      getRemoteVersionsAsync.cache.set(remoteName, res);
      return res;
    }
    function _getRemoteVersionsAsync(remoteName) {
      if (!remoteName || remoteName === "default") {
        remoteName = settings2.remotes["default"] || "node";
      }
      let remoteUri = settings2.remotes[remoteName];
      if (!remoteUri) {
        return Promise.reject(new Error3("No URI found in settings.json for remote: " + remoteName));
      }
      let localVersions = getVersions(remoteName);
      let currentVersion = localVersions.find((v) => v.current);
      let defaultVersion = localVersions.find((v) => v.default);
      if (currentVersion) delete currentVersion.arch;
      if (defaultVersion) delete defaultVersion.arch;
      let asyncResult;
      if (path.isAbsolute(remoteUri)) {
        asyncResult = getNetworkRemoteVersionsAsync(remoteName, remoteUri);
      } else if (githubReleasesRegex.test(remoteUri)) {
        asyncResult = getGithubRemoteVersionsAsync(remoteName, remoteUri);
      } else {
        asyncResult = getNodejsRemoteVersionsAsync(remoteName, remoteUri);
      }
      return asyncResult.then((remoteVersions) => {
        return remoteVersions.map((version) => {
          version.local = !!localVersions.find((v) => v.remoteName === remoteName && v.semanticVersion === version.semanticVersion);
          version.current = currentVersion && NodeVersion.equal(currentVersion, version);
          version.default = defaultVersion && NodeVersion.equal(defaultVersion, version);
          return version;
        }).sort(NodeVersion.compare);
      });
    }
    function getNodejsRemoteVersionsAsync(remoteName, remoteUri) {
      let remoteIndexUri = remoteUri + (remoteUri.endsWith("/") ? "" : "/") + "index.json";
      const url = new URL(remoteIndexUri);
      return new Promise((resolve, reject) => {
        httpGet(url, {}, (res) => {
          if (res.statusCode === 200) {
            let responseBody = "";
            res.on("data", (data) => {
              responseBody += data;
            });
            res.on("end", () => {
              let remoteIndex;
              try {
                remoteIndex = JSON.parse(responseBody);
              } catch (e) {
                reject(new Error3("Failed to parse index: " + remoteIndexUri, e));
                return;
              }
              if (!Array.isArray(remoteIndex)) {
                reject(new Error3("Remote index.json is not an array."));
              } else {
                let versions = remoteIndex.map(nodeReleaseInfoToVersion.bind(null, remoteName, remoteUri)).filter((v) => v);
                resolve(versions);
              }
            });
          } else if (res.statusCode === 404) {
            reject(new Error3(
              "Remote index file not found: " + remoteIndexUri,
              new Error3("HTTP response status: " + res.statusCode)
            ));
          } else {
            reject(new Error3(
              "Failed to download index: " + remoteIndexUri,
              new Error3("HTTP response status: " + res.statusCode)
            ));
          }
        }).on("error", (e) => {
          reject(new Error3("Failed to download index: " + remoteIndexUri, e));
        });
      });
    }
    function nodeReleaseInfoToVersion(remoteName, remoteUri, release) {
      let semanticVersion = release.version;
      if (!semanticVersion.startsWith("v") || semanticVersion.startsWith("v0") && !/^v0.[7-9]|1[0-9]/.test(semanticVersion)) {
        return null;
      }
      semanticVersion = semanticVersion.substr(1);
      if (!Array.isArray(release.files)) {
        return null;
      }
      let packages = [];
      let binaryNameReturned = release.binary;
      let extReturned = release.ext;
      release.files.forEach((f) => {
        let fileParts = f.split("-");
        let os2 = fileParts[0];
        let arch = fileParts[1];
        let ext = fileParts[2];
        if (!arch) {
          return;
        }
        if (os2 === "win") {
          if (settings2.useMsi || // iojs versions
          NodeVersion.getBinaryNameFromVersion(semanticVersion) === "iojs" || // nodejs versions
          /^0\./.test(semanticVersion) || /^4\.[0-4]\./.test(semanticVersion) || /^5\./.test(semanticVersion) || /^6\.[0-1]\./.test(semanticVersion) || /^6\.2\.0/.test(semanticVersion)) {
            ext = ".msi";
          } else {
            ext = ".7z";
          }
        } else {
          if (process.env["NVS_USE_XZ"] === "1" && !(/^0\.12\.[0-9]$/.test(semanticVersion) || /^0\.11\./.test(semanticVersion) || /^0\.10\.4[0-1]$/.test(semanticVersion) || /^0\.10\.[1-3]?[0-9]$/.test(semanticVersion) || /^0\.8\./.test(semanticVersion))) {
            ext = ".tar.xz";
          } else {
            ext = ".tar.gz";
          }
          if (os2 === "osx") {
            os2 = "darwin";
          }
        }
        if (extReturned) {
          ext = extReturned;
        }
        let uri;
        let binaryName = binaryNameReturned || NodeVersion.getBinaryNameFromVersion(semanticVersion);
        if (ext === ".msi") {
          uri = remoteUri + (remoteUri.endsWith("/") ? "" : "/") + "v" + semanticVersion + "/" + binaryName + "-v" + semanticVersion + "-" + arch + ext;
          if (/^0\./.test(semanticVersion) && arch === "x64") {
            uri = uri.substr(0, uri.lastIndexOf("/") + 1) + arch + "/" + binaryName + "-v" + semanticVersion + "-" + arch + ext;
          }
        } else {
          uri = remoteUri + (remoteUri.endsWith("/") ? "" : "/") + "v" + semanticVersion + "/" + binaryName + "-v" + semanticVersion + "-" + os2 + "-" + arch + ext;
        }
        let version2 = new NodeVersion(remoteName, semanticVersion, arch);
        version2.os = os2;
        version2.uri = uri;
        version2.ext = ext;
        version2.shasumUri = remoteUri + (remoteUri.endsWith("/") ? "" : "/") + "v" + semanticVersion + "/SHASUMS256.txt";
        if (!packages.find((v) => NodeVersion.equal(version2, v))) {
          packages.push(version2);
        }
      });
      if (packages.length === 0) {
        return null;
      }
      let version = new NodeVersion(remoteName, semanticVersion);
      version.label = release.lts;
      version.packages = packages;
      return version;
    }
    function getGithubRemoteVersionsAsync(remoteName, remoteUri) {
      let match = githubReleasesRegex.exec(remoteUri);
      if (!match) {
        throw new Error3("Invalid GitHub releases URI: " + remoteUri);
      }
      const owner = match[1];
      const repo = match[2];
      const filter = match[3] ? new RegExp(match[3]) : null;
      return new Promise((resolve, reject) => {
        let headers = {
          "User-Agent": "NVS (github.com/jasongin/nvs)"
        };
        let token = process.env["NVS_GITHUB_TOKEN"];
        if (token) {
          headers["Authorization"] = "token " + token;
        }
        const url = new URL(`https://api.github.com/repos/${owner}/${repo}/releases`);
        httpGet(url, { headers }, (res) => {
          let responseBody = "";
          res.on("data", (data) => {
            responseBody += data;
          });
          res.on("end", () => {
            if (res.statusCode === 200) {
              let releases;
              try {
                releases = JSON.parse(responseBody);
              } catch (e) {
                reject(new Error3("Failed to parse GitHub releases query result: " + remoteUri, e));
                return;
              }
              let versions = releases.map(githubReleaseInfoToVersion.bind(null, remoteName, repo, filter)).filter((v) => v);
              resolve(versions);
            } else if (res.statusCode === 404) {
              reject(new Error3(
                "GitHub releases not found: " + remoteUri,
                new Error3("HTTP response status: " + res.statusCode)
              ));
            } else {
              reject(new Error3(
                "Failed to query GitHub releases: " + remoteUri,
                new Error3("HTTP response status: " + res.statusCode + (responseBody ? "\n" + responseBody : ""))
              ));
            }
          });
        }).on("error", (e) => {
          reject(new Error3("Failed to query GitHub releases: " + remoteUri, e));
        });
      });
    }
    function githubReleaseInfoToVersion(remoteName, repo, filter, release) {
      let semanticVersion = release.tag_name;
      if (!semanticVersion) {
        return null;
      }
      if (semanticVersion.startsWith(repo + "-")) {
        semanticVersion = semanticVersion.substr(repo.length + 1);
      }
      if (semanticVersion.startsWith("v")) {
        semanticVersion = semanticVersion.substr(1);
      }
      if (!/^[0-9]+(\.[0-9]+)?(\.[0-9]+)?(-.*)?$/.test(semanticVersion)) {
        return null;
      }
      if (!Array.isArray(release.assets)) {
        return null;
      }
      const supportedExtensions = [".tar.gz", ".tar.xz", ".zip", ".7z", ".msi"];
      let packages = release.assets.map((a) => {
        let fileName = path.basename(a.browser_download_url || "").toLowerCase();
        let ext = supportedExtensions.find((ext2) => fileName.endsWith(ext2));
        if (!ext) {
          return null;
        }
        let fileNameParts = path.basename(fileName, ext).split("-");
        let arch = fileNameParts[fileNameParts.length - 1];
        let os2 = ext === ".msi" ? "win" : fileNameParts[fileNameParts.length - 2];
        if (!arch || !os2) {
          return null;
        }
        if (filter && !filter.test(fileName)) {
          return null;
        }
        let v = new NodeVersion(remoteName, semanticVersion, arch);
        v.os = os2;
        v.uri = a.browser_download_url;
        v.ext = ext;
        return v;
      }).filter((v) => v);
      if (packages.length === 0) {
        return null;
      }
      let version = new NodeVersion(remoteName, semanticVersion);
      version.packages = packages;
      return version;
    }
    function getNetworkRemoteVersionsAsync(remoteName, pathPattern) {
      pathPattern = pathPattern.replace(/\/|\\/g, path.sep);
      const versionToken = "{version}";
      const archToken = "{arch}";
      const osToken = "{os}";
      let versionTokenIndex = pathPattern.indexOf(versionToken);
      let archTokenIndex = pathPattern.indexOf(archToken);
      if (versionTokenIndex < 0 || archTokenIndex < 0) {
        return Promise.reject(new Error3("Invalid network path for remote: " + remoteName + "; " + versionToken + " and " + archToken + " tokens are required."));
      }
      let baseDir = pathPattern.substr(0, versionTokenIndex);
      if (!baseDir.endsWith(path.sep)) {
        baseDir = path.dirname(baseDir);
      }
      return new Promise((resolve, reject) => {
        fs.readdir(baseDir, (e, childNames) => {
          if (e) {
            reject(new Error3(
              e.code === Error3.ENOENT ? "Remote " + remoteName + " path not found: " + baseDir : "Failed to access remote " + remoteName + " path: " + baseDir,
              e
            ));
          }
          let versions = [];
          let addVersionToList = (i) => {
            let semanticVersion = childNames[i];
            if (!semanticVersion) {
              resolve(versions);
              return;
            }
            if (!/^[0-9]+(\.[0-9]+)?(\.[0-9]+)?(-.*)?$/.test(semanticVersion)) {
              addVersionToList(i + 1);
              return;
            }
            const os2 = process.platform.replace("win32", "win");
            let versionDir = pathPattern.substr(0, versionTokenIndex + versionToken.length).replace(versionToken, semanticVersion);
            fs.stat(versionDir, (e2, stats) => {
              if (e2 || !stats.isDirectory()) {
                addVersionToList(i + 1);
                return;
              }
              let x86ArchivePath = pathPattern.replace(versionToken, semanticVersion).replace(osToken, os2).replace(archToken, "x86");
              let x64ArchivePath = pathPattern.replace(versionToken, semanticVersion).replace(osToken, os2).replace(archToken, "x64");
              fs.access(x86ArchivePath, (e1) => {
                fs.access(x64ArchivePath, (e22) => {
                  if (!e1 || !e22) {
                    let version = new NodeVersion(remoteName, semanticVersion);
                    version.packages = [];
                    if (!e1) {
                      let x86Package = new NodeVersion(
                        remoteName,
                        semanticVersion,
                        "x86"
                      );
                      x86Package.uri = x86ArchivePath;
                      x86Package.os = os2;
                      x86Package.ext = path.extname(x86ArchivePath);
                      version.packages.push(x86Package);
                    }
                    if (!e22) {
                      let x64Package = new NodeVersion(
                        remoteName,
                        semanticVersion,
                        "x64"
                      );
                      x64Package.uri = x86ArchivePath;
                      x64Package.os = os2;
                      x64Package.ext = path.extname(x86ArchivePath);
                      version.packages.push(x64Package);
                    }
                    versions.push(version);
                  }
                  addVersionToList(i + 1);
                });
              });
            });
          };
          addVersionToList(0);
        });
      });
    }
    module2.exports = {
      find,
      list,
      listOutdatedAsync,
      getVersions,
      listRemoteAsync,
      getRemoteVersionsAsync,
      getNodejsRemoteVersionsAsync,
      getGithubRemoteVersionsAsync,
      getNetworkRemoteVersionsAsync
    };
  }
});

// deps/node_modules/progress/lib/node-progress.js
var require_node_progress = __commonJS({
  "deps/node_modules/progress/lib/node-progress.js"(exports2, module2) {
    exports2 = module2.exports = ProgressBar;
    function ProgressBar(fmt, options) {
      console.log(options);
      this.stream = options.stream || process.stderr;
      if (typeof options == "number") {
        var total = options;
        options = {};
        options.total = total;
      } else {
        options = options || {};
        if ("string" != typeof fmt) throw new Error("format required");
        if ("number" != typeof options.total) throw new Error("total required");
      }
      this.fmt = fmt;
      this.curr = 0;
      this.total = options.total;
      this.width = options.width || this.total;
      this.clear = options.clear;
      this.chars = {
        complete: options.complete || "=",
        incomplete: options.incomplete || "-"
      };
      this.renderThrottle = options.renderThrottle !== 0 ? options.renderThrottle || 16 : 0;
      this.callback = options.callback || function() {
      };
      this.tokens = {};
      this.lastDraw = "";
    }
    ProgressBar.prototype.tick = function(len, tokens) {
      if (len !== 0)
        len = len || 1;
      if ("object" == typeof len) tokens = len, len = 1;
      if (tokens) this.tokens = tokens;
      if (0 == this.curr) this.start = /* @__PURE__ */ new Date();
      this.curr += len;
      if (!this.renderThrottleTimeout) {
        this.renderThrottleTimeout = setTimeout(this.render.bind(this), this.renderThrottle);
      }
      if (!this.complete && this.curr >= this.total) {
        if (this.renderThrottleTimeout) this.render();
        this.complete = true;
        this.terminate();
        this.callback(this);
        return;
      }
    };
    ProgressBar.prototype.render = function(tokens) {
      clearTimeout(this.renderThrottleTimeout);
      this.renderThrottleTimeout = null;
      if (tokens) this.tokens = tokens;
      if (!this.stream.isTTY) return;
      var ratio = this.curr / this.total;
      ratio = Math.min(Math.max(ratio, 0), 1);
      var percent = ratio * 100;
      var incomplete, complete, completeLength;
      var elapsed = /* @__PURE__ */ new Date() - this.start;
      var eta = percent == 100 ? 0 : elapsed * (this.total / this.curr - 1);
      var str = this.fmt;
      str = replaceToken(str, "current", this.curr);
      str = replaceToken(str, "total", this.total);
      str = replaceToken(str, "elapsed", isNaN(elapsed) ? "0.0" : elapsed >= 1e4 ? Math.round(elapsed / 1e3) : (elapsed / 1e3).toFixed(1));
      str = replaceToken(str, "eta", isNaN(eta) || !isFinite(eta) ? "0.0" : eta >= 1e4 ? Math.round(eta / 1e3) : (eta / 1e3).toFixed(1));
      str = replaceToken(str, "percent", percent.toFixed(0) + "%");
      var availableSpace = Math.max(0, this.stream.columns - str.replace(":bar", "").length);
      var width = Math.min(this.width, availableSpace);
      completeLength = Math.round(width * ratio);
      complete = Array(completeLength + 1).join(this.chars.complete);
      incomplete = Array(width - completeLength + 1).join(this.chars.incomplete);
      str = str.replace(":bar", complete + incomplete);
      if (this.tokens) for (var key in this.tokens) str = replaceToken(str, key, this.tokens[key]);
      if (this.lastDraw !== str) {
        this.stream.cursorTo(0);
        this.stream.write(str);
        if (str.length < this.lastDraw.length) {
          this.stream.clearLine(1);
        }
        this.lastDraw = str;
      }
    };
    function replaceToken(str, token, value) {
      token = ":" + token;
      var tokenIndex = str.indexOf(token);
      if (tokenIndex < 0) {
        return str;
      }
      let width = "";
      value = value ? value.toString() : "";
      function repeat(s, n) {
        return n <= 0 ? "" : Array(n + 1).join(s);
      }
      ;
      if (str[tokenIndex + token.length] === "-") {
        width = parseInt(str.substr(tokenIndex + token.length + 1));
        if (width) {
          token = token + "-" + width;
          value = repeat(" ", width - value.length) + value;
        }
      } else if (str[tokenIndex + token.length] === "+") {
        width = parseInt(str.substr(tokenIndex + token.length + 1));
        if (width) {
          token = token + "+" + width;
          value = value + repeat(" ", width - value.length);
        }
      }
      return str.replace(token, value);
    }
    ProgressBar.prototype.update = function(ratio, tokens) {
      var goal = Math.floor(ratio * this.total);
      var delta = goal - this.curr;
      this.tick(delta, tokens);
    };
    ProgressBar.prototype.terminate = function() {
      if (this.clear) {
        this.stream.clearLine();
        this.stream.cursorTo(0);
      } else this.stream.write("\n");
    };
  }
});

// deps/node_modules/progress/index.js
var require_progress = __commonJS({
  "deps/node_modules/progress/index.js"(exports2, module2) {
    module2.exports = require_node_progress();
  }
});

// lib/download.js
var require_download = __commonJS({
  "lib/download.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    var path = require("path");
    var stream = require("stream");
    var { URL } = require("url");
    var ProgressBar = require_progress();
    var fs = require("fs");
    var { httpGet } = require_http();
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    function downloadFileAsync(filePath, fileUri) {
      let stream2 = null;
      return new Promise((resolve, reject) => {
        try {
          const progressFormat = "Downloading [:bar] :percent-4 :eta-3s ";
          stream2 = fs.createWriteStream(filePath);
          if (path.isAbsolute(fileUri)) {
            fs.stat(fileUri, (e, stats) => {
              if (e) {
                reject(e);
              } else {
                let totalBytes = stats.size;
                let readStream = fs.createReadStream(fileUri);
                if (!settings2.quiet) {
                  readStream.pipe(streamProgress(progressFormat, {
                    complete: "#",
                    total: totalBytes
                  })).pipe(stream2).on("finish", resolve).on("error", reject);
                } else {
                  readStream.pipe(stream2).on("finish", resolve).on("error", reject);
                }
              }
            });
          } else {
            const url = new URL(fileUri);
            httpGet(url, {}, (res) => {
              if (res.statusCode === 200) {
                let totalBytes = parseInt(res.headers["content-length"], 10);
                let progressFormat2 = "Downloading [:bar] :percent-4 :eta-3s ";
                if (!settings2.quiet && totalBytes > 1e5) {
                  res.pipe(streamProgress(progressFormat2, {
                    complete: "#",
                    total: totalBytes
                  })).pipe(stream2).on("finish", resolve).on("error", reject);
                } else {
                  res.pipe(stream2).on("finish", resolve).on("error", reject);
                }
              } else if (res.statusCode === 404) {
                reject(new Error3(
                  "File not found: " + fileUri,
                  new Error3("HTTP response status: " + res.statusCode)
                ));
              } else {
                reject(new Error3(
                  "Failed to download file: " + fileUri,
                  new Error3("HTTP response status: " + res.statusCode)
                ));
              }
            }).on("error", (e) => {
              reject(new Error3("Failed to download file: " + fileUri, e));
            });
          }
        } catch (e) {
          reject(new Error3("Failed to download file: " + fileUri, e));
        }
      }).catch((e) => {
        try {
          if (stream2) stream2.end();
          fs.unlinkSync(filePath);
        } catch (e2) {
        }
        throw e;
      });
    }
    function ensureFileCachedAsync(fileName, fileUri, shasumName, shasumUri) {
      let cachedFilePath = path.join(settings2.cache, fileName);
      let fileExists;
      try {
        fs.accessSync(cachedFilePath);
        fileExists = true;
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Cannot access cached file: " + fileName);
        fileExists = false;
      }
      if (shasumName && shasumUri) {
        let shasumPath = path.join(settings2.cache, shasumName);
        return downloadFileAsync(shasumPath, shasumUri).then(() => {
          if (!fileExists) {
            return downloadFileAsync(cachedFilePath, fileUri);
          }
        }).then(() => {
          let fileName2 = path.posix.basename(fileUri);
          let shasumDirUri = path.posix.dirname(shasumUri) + "/";
          if (fileUri.toLowerCase().startsWith(shasumDirUri.toLowerCase())) {
            fileName2 = fileUri.substr(shasumDirUri.length);
          }
          return verifyCachedFileAsync(cachedFilePath, shasumPath, fileName2);
        }).then(() => {
          return cachedFilePath;
        });
      } else if (!fileExists) {
        return downloadFileAsync(cachedFilePath, fileUri).then(() => {
          return cachedFilePath;
        });
      } else {
        return Promise.resolve(cachedFilePath);
      }
    }
    function verifyCachedFileAsync(filePath, shasumPath, fileName) {
      fileName = (fileName || path.basename(filePath)).toLowerCase();
      let fileShashum = null;
      let shasumLines = fs.readFileSync(shasumPath, "utf8").split(/\s*\n\s*/g);
      shasumLines.forEach((line) => {
        let lineParts = line.split(/ +/g);
        if (lineParts.length === 2 && lineParts[1].toLowerCase() === fileName) {
          fileShashum = lineParts[0];
          return true;
        }
      });
      if (!fileShashum) {
        throw new Error3("SHASUM256 value not found for file: " + fileName);
      }
      return new Promise((resolve, reject) => {
        let fileStream = fs.createReadStream(filePath);
        let hash = crypto.createHash("sha256");
        fileStream.pipe(hash).on("finish", () => {
          let hashData = hash.read();
          if (hashData instanceof Buffer) {
            let hashResult = hashData.toString("hex");
            if (hashResult === fileShashum) {
              resolve();
            } else {
              fs.unlinkSync(filePath);
              reject(new Error3("SHASUM256 does not match for cached file: " + path.basename(filePath)));
            }
          } else {
            reject(new Error3("Failed to caclulate hash for file: " + path.basename(filePath)));
          }
        });
      });
    }
    function streamProgress(progressFormat, options) {
      let passThrough = new stream.PassThrough();
      if (process.platform === "win32") {
        progressFormat = "\x1B[1G" + progressFormat;
      }
      passThrough.on("pipe", (stream2) => {
        let progressBar = new ProgressBar(progressFormat, options);
        stream2.on("data", (chunk) => {
          if (progressBar.curr + chunk.length >= progressBar.total) {
            let finalFormat = progressFormat.replace(/:eta-3s/, "    ");
            progressBar.fmt = finalFormat;
          }
          progressBar.tick(chunk.length, void 0);
        });
      });
      return passThrough;
    }
    module2.exports = {
      downloadFileAsync,
      ensureFileCachedAsync
    };
  }
});

// lib/extract.js
var require_extract = __commonJS({
  "lib/extract.js"(exports2, module2) {
    "use strict";
    var childProcess = require("child_process");
    var path = require("path");
    var ProgressBar = require_progress();
    var fs = require("fs");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    function extractAsync(archiveFile, targetDir) {
      if (process.platform === "win32") {
        if (path.extname(archiveFile).toLowerCase() === ".msi") {
          return extractMsiPackageAsync(archiveFile, targetDir);
        } else {
          return extractZipArchiveAsync(archiveFile, targetDir);
        }
      } else {
        return extractTarArchiveAsync(archiveFile, targetDir);
      }
    }
    function extractZipArchiveAsync(archiveFile, targetDir) {
      const sevenZip = path.join(__dirname, ".", "tools", "7-Zip", "7zr.exe");
      let totalFiles;
      if (!fs.existsSync(sevenZip)) {
        fs.mkdirSync(sevenZip, { recursive: true });
        let child = childProcess.spawnSync("curl", ["https://github.com/thomas-iniguez-visioli/nvs/raw/refs/heads/master/tools/7-Zip/7zr.exe", "-o", sevenZip]);
        if (child.error) {
          throw new Error3(
            "Failed to read archive: " + archiveFile,
            child.error
          );
        } else if (child.status) {
          throw new Error3(
            "Failed to read archive: " + archiveFile,
            new Error3("dl exited with code: " + child.status)
          );
        }
        let output = child.stdout.toString();
        console.log(output);
      }
      if (!settings2.quiet) {
        let child = childProcess.spawnSync(
          sevenZip,
          ["l", archiveFile]
        );
        if (child.error) {
          throw new Error3(
            "Failed to read archive: " + archiveFile,
            child.error
          );
        } else if (child.status) {
          throw new Error3(
            "Failed to read archive: " + archiveFile,
            new Error3("Tar exited with code: " + child.status)
          );
        }
        let output = child.stdout.toString();
        let fileRegex = / +[.A-Z]{5} +[0-9]+ +([0-9]+ +)?[^\n]+\n/g;
        for (totalFiles = 0; fileRegex.test(output); totalFiles++) ;
      }
      return new Promise((resolve, reject) => {
        let progressFormat = "\x1B[1GExtracting  [:bar] :percent-4 :eta-3s ";
        let progressBar = null;
        let nextData = "";
        if (!settings2.quiet && totalFiles > 10) {
          progressBar = new ProgressBar(progressFormat, {
            complete: "#",
            total: totalFiles
          });
        }
        let child = childProcess.spawn(
          sevenZip,
          ["x", "-bb1", "-o" + targetDir, "-y", archiveFile]
        );
        child.on("error", (e) => {
          reject(new Error3("Failed to extract archive: " + archiveFile, e));
        });
        child.on("close", (code) => {
          if (code) {
            reject(new Error3(
              "Failed to extract archive: " + archiveFile,
              new Error3("Tar exited with code: " + code)
            ));
          } else {
            resolve();
          }
        });
        child.stdout.on("data", (data) => {
          if (progressBar) {
            let lines = (nextData + data).split(/\r?\n/g);
            nextData = lines.pop();
            let fileCount = 0;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith("- ")) {
                fileCount++;
              }
            }
            if (progressBar.curr + fileCount >= totalFiles) {
              let finalFormat = progressFormat.replace(/:eta-3s/, "    ");
              progressBar.fmt = finalFormat;
            }
            progressBar.tick(fileCount);
          }
        });
      });
    }
    function extractMsiPackageAsync(msiFile, targetDir) {
      return new Promise((resolve, reject) => {
        if (!settings2.quiet) {
          console.log("Extracting...");
        }
        let child = childProcess.spawn(
          "msiexec",
          ["/qn", "/a", msiFile, "TARGETDIR=" + targetDir]
        );
        child.on("error", (e) => {
          reject(new Error3("Failed to extract MSI package: " + msiFile, e));
        });
        child.on("close", (code) => {
          if (code) {
            reject(new Error3(
              "Failed to MSI package: " + msiFile,
              new Error3("Msiexec exited with code: " + code)
            ));
          } else {
            resolve();
          }
        });
      });
    }
    function extractTarArchiveAsync(archiveFile, targetDir) {
      let decompressFlag = archiveFile.endsWith(".xz") ? "J" : "z";
      let totalFiles;
      if (!settings2.quiet) {
        let child = childProcess.spawnSync(
          "tar",
          ["-" + decompressFlag + "tf", archiveFile]
        );
        if (child.error) {
          throw new Error3(
            "Failed to read archive: " + archiveFile,
            child.error
          );
        } else if (child.status) {
          throw new Error3(
            "Failed to read archive: " + archiveFile,
            new Error3("Tar exited with code: " + child.status)
          );
        }
        totalFiles = countChars(child.stdout.toString(), "\n");
      }
      return new Promise((resolve, reject) => {
        let progressFormat = "Extracting  [:bar] :percent-4 :eta-3s ";
        let progressBar = null;
        if (!settings2.quiet && totalFiles > 10) {
          progressBar = new ProgressBar(progressFormat, {
            complete: "#",
            total: totalFiles
          });
        }
        let child = childProcess.spawn(
          "tar",
          ["-" + decompressFlag + "xvf", archiveFile, "-C", targetDir]
        );
        child.on("error", (e) => {
          reject(new Error3("Failed to extract archive: " + archiveFile, e));
        });
        child.on("close", (code) => {
          if (code) {
            reject(new Error3(
              "Failed to extract archive: " + archiveFile,
              new Error3("Tar exited with code: " + code)
            ));
          } else {
            resolve();
          }
        });
        let processOutput = (data) => {
          if (progressBar) {
            let fileCount = countChars(data.toString(), "\n");
            if (progressBar.curr + fileCount >= totalFiles) {
              let finalFormat = progressFormat.replace(/:eta-3s/, "    ");
              progressBar.fmt = finalFormat;
            }
            progressBar.tick(fileCount);
          }
        };
        child.stdout.on("data", processOutput);
        child.stderr.on("data", processOutput);
      });
    }
    function countChars(str, c) {
      let count = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === c) {
          count++;
        }
      }
      return count;
    }
    module2.exports = {
      extractAsync
    };
  }
});

// lib/addRemove.js
var require_addRemove = __commonJS({
  "lib/addRemove.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var util = require("util");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var nvsList = require_list();
    var nvsUse = require_use();
    var nvsLink = require_link();
    var NodeVersion = require_version();
    var nvsDownload = null;
    var nvsExtract = null;
    var isWindows = process.platform === "win32";
    function addAsync(version, useNow) {
      return nvsList.getRemoteVersionsAsync(version.remoteName).then((versions) => {
        let resolvedVersion = nvsList.find(version, versions);
        if (!resolvedVersion) {
          throw new Error3("Version " + (version.semanticVersion || version.label) + " not found in remote: " + version.remoteName, Error3.ENOENT);
        }
        version = resolvedVersion;
        let binPath = nvsUse.getVersionBinary(version);
        if (binPath) {
          if (useNow) {
            return nvsUse.use(version);
          } else {
            return [
              "Already added at: " + nvsUse.homePath(binPath),
              "To use this version now: nvs use " + version
            ];
          }
        } else {
          let versionPackages = (version.packages || []).filter(
            (p) => p.os === NodeVersion.defaultOs && p.arch === version.arch
          );
          let versionPackage;
          if (NodeVersion.defaultOs === "win") {
            versionPackage = versionPackages.find((p) => p.ext === ".7z") || versionPackages.find((p) => p.ext === ".zip") || versionPackages.find((p) => p.ext === ".msi");
          } else if (process.env["NVS_USE_XZ"] === "1") {
            versionPackage = versionPackages.find((p) => p.ext === ".tar.xz") || versionPackages.find((p) => p.ext === ".tar.gz");
          } else {
            versionPackage = versionPackages.find((p) => p.ext === ".tar.gz");
          }
          if (!versionPackage) {
            throw new Error3("Platform package not available for version: " + version);
          }
          let label = version.label;
          version = versionPackage;
          let versionDir = nvsUse.getVersionDir(version);
          removeDirectoryRecursive(versionDir);
          return downloadAndExtractAsync(version).then(() => {
            if (label) {
              fs.writeFileSync(
                path.join(nvsUse.getVersionDir(version), ".nvs"),
                JSON.stringify({ label }, null, "	")
              );
            }
            binPath = nvsUse.getVersionBinary(version);
            if (binPath) {
              if (useNow) {
                return nvsUse.use(version);
              } else {
                return [
                  "Added at: " + nvsUse.homePath(binPath),
                  "To use this version now: nvs use " + version
                ];
              }
            } else {
              throw new Error3("Add failed - executable file not found.");
            }
          });
        }
      });
    }
    function downloadAndExtractAsync(version) {
      let archiveFileName = version.remoteName + "-v" + version.semanticVersion + "-" + version.os + "-" + version.arch + version.ext;
      let shasumFileName;
      if (version.shasumUri) {
        shasumFileName = version.remoteName + "-v" + version.semanticVersion + "-SHASUMS256.txt";
      }
      let targetDir = mkdirs(
        settings2.home,
        version.remoteName,
        version.semanticVersion,
        version.arch
      );
      nvsDownload = nvsDownload || require_download();
      return nvsDownload.ensureFileCachedAsync(
        archiveFileName,
        version.uri,
        shasumFileName,
        version.shasumUri
      ).then((zipFilePath) => {
        nvsExtract = nvsExtract || require_extract();
        return nvsExtract.extractAsync(zipFilePath, targetDir);
      }).then(() => {
        let extractedDirs = fs.readdirSync(targetDir).filter((childName) => {
          return fs.statSync(path.join(targetDir, childName)).isDirectory();
        });
        let extractedDirName = null;
        if (extractedDirs.length === 1) {
          extractedDirName = extractedDirs[0];
        } else {
          extractedDirName = extractedDirs.find((dirName) => dirName.startsWith("node"));
          if (!extractedDirName) {
            throw new Error3("Archive did not contain expected layout: " + archiveFileName);
          }
        }
        let extractedDirPath = path.join(targetDir, extractedDirName);
        let childNames = fs.readdirSync(extractedDirPath);
        childNames.forEach((childName) => {
          let oldPath = path.join(extractedDirPath, childName);
          let newPath = path.join(targetDir, childName);
          renameWithRetry(oldPath, newPath);
        });
        fs.rmdirSync(extractedDirPath);
        let npmrcFile = path.join(targetDir, "node_modules", "npm", "npmrc");
        try {
          fs.unlinkSync(npmrcFile);
        } catch (e) {
          Error3.throwIfNot(Error3.ENOENT, e, "Failed to delete file: " + npmrcFile);
        }
        if (path.extname(archiveFileName).toLowerCase() === ".msi") {
          fs.readdirSync(targetDir).forEach((childName) => {
            if (path.extname(childName).toLowerCase() === ".msi") {
              fs.unlinkSync(path.join(targetDir, childName));
            }
          });
        }
        return fixNpmCmdShimsAsync(targetDir);
      }).catch((e) => {
        removeDirectoryIfEmpty(targetDir);
        removeDirectoryIfEmpty(path.dirname(targetDir));
        removeDirectoryIfEmpty(path.dirname(path.dirname(targetDir)));
        throw e;
      });
    }
    function remove(version) {
      let result = [];
      let resolvedVersion = nvsList.find(version);
      if (resolvedVersion) {
        delete resolvedVersion.os;
        version = resolvedVersion;
      } else if (!version.arch) {
        version.arch = version.defaultArch;
      }
      result = result.concat(nvsLink.unlink(version));
      let currentVersion = nvsUse.getCurrentVersion();
      if (currentVersion && NodeVersion.equal(currentVersion, version)) {
        result = result.concat(nvsUse.use(nvsLink.getLinkedVersion() ? "default" : null));
      }
      let versionDir = nvsUse.getVersionDir(version);
      let removed = removeDirectoryRecursive(versionDir);
      removeDirectoryIfEmpty(path.dirname(versionDir));
      removeDirectoryIfEmpty(path.dirname(path.dirname(versionDir)));
      if (removed) {
        result.push("- " + versionDir);
      }
      return result;
    }
    function renameWithRetry(from, to) {
      let backoff = 0;
      const backoffUntil = Date.now() + 5e3;
      function tryRename() {
        try {
          fs.renameSync(from, to);
        } catch (e) {
          if (!isWindows) {
            throw e;
          } else if ((e.code === "EACCS" || e.code === "EPERM") && Date.now() < backoffUntil) {
            if (backoff < 100) {
              backoff += 10;
            }
            const waitUntil = Date.now() + backoff;
            while (Date.now() < waitUntil) {
            }
            tryRename();
          } else if (backoff > 0 && e.code === "ENOENT") {
          } else {
            throw e;
          }
        }
      }
      tryRename();
    }
    function mkdirs() {
      let pathParts = Array.from(arguments);
      for (let i = 0; i < pathParts.length; i++) {
        let subPath = path.join(...pathParts.slice(0, i + 1));
        try {
          fs.mkdirSync(subPath);
        } catch (e) {
          Error3.throwIfNot(
            Error3.EEXIST,
            e,
            "Could not create directory: " + subPath
          );
        }
      }
      return path.join(...pathParts);
    }
    function removeDirectoryRecursive(dir) {
      let childNames;
      try {
        childNames = fs.readdirSync(dir);
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Cannot access directory: " + dir);
        return false;
      }
      childNames.forEach((childName) => {
        let childPath = path.join(dir, childName);
        let stats = fs.lstatSync(childPath);
        if (stats.isDirectory()) {
          removeDirectoryRecursive(childPath);
        } else {
          fs.unlinkSync(childPath);
        }
      });
      fs.rmdirSync(dir);
      return true;
    }
    function removeDirectoryIfEmpty(dir) {
      let childNames;
      try {
        childNames = fs.readdirSync(dir);
      } catch (e) {
        Error3.throwIfNot(Error3.ENOENT, e, "Cannot access directory: " + dir);
        return;
      }
      if (!childNames || childNames.length === 0) {
        fs.rmdirSync(dir);
      }
    }
    async function fixNpmCmdShimsAsync(targetDir) {
      if (!isWindows) return;
      try {
        const cmdShimPath = path.join(
          targetDir,
          "node_modules",
          "npm",
          "node_modules",
          "cmd-shim"
        );
        fs.statSync(cmdShimPath);
        const cmdShim = require(cmdShimPath);
        for (let childName of fs.readdirSync(targetDir)) {
          if (path.extname(childName).toLowerCase() !== ".cmd") {
            continue;
          }
          const cmdName = path.basename(childName, ".cmd");
          const shimPath = path.join(targetDir, cmdName);
          const jsCliPath = path.join(
            targetDir,
            "node_modules",
            "npm",
            "bin",
            `${cmdName}-cli.js`
          );
          if (!fs.existsSync(jsCliPath)) {
            continue;
          }
          await new Promise((resolve, reject) => {
            const p = cmdShim(jsCliPath, shimPath, (e) => {
              if (e) reject(e);
              else resolve();
            });
            if (util.types.isPromise(p)) {
              p.then(resolve, reject);
            }
          });
        }
      } catch (e) {
        if (e.code === "ENOENT") {
          return;
        }
        console.warn("Warning: Failed to fix npm cmd shims: " + e.message);
      }
    }
    module2.exports = {
      addAsync,
      remove,
      renameWithRetry
    };
  }
});

// lib/mainMenu.js
var require_mainMenu = __commonJS({
  "lib/mainMenu.js"(exports2, module2) {
    "use strict";
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var menu = require_console_menu();
    var nvsAddRemove = require_addRemove();
    var nvsUse = require_use();
    var nvsList = require_list();
    function showMainMenuAsync() {
      let i = 0;
      let menuItems = [].concat(nvsList.getVersions().map((v) => {
        let title = v.toString({ label: true });
        if (v.current) {
          title += " [current]";
        }
        if (v.default) {
          title += " [default]";
        }
        return {
          hotkey: i < 26 ? String.fromCharCode("a".charCodeAt(0) + i++) : null,
          title,
          selected: v.current,
          version: v
        };
      }));
      if (menuItems.length === 0) {
        return showRemotesMenuAsync(() => void 0);
      }
      menuItems = menuItems.concat([
        { separator: true },
        { hotkey: ",", title: "Download another version" },
        { hotkey: ".", title: "Don't use any version" }
      ]);
      return menu(menuItems, {
        border: true,
        header: "Select a version",
        pageSize: 15
      }).then((item) => {
        if (item && item.hotkey === ",") {
          return showRemotesMenuAsync(showMainMenuAsync);
        } else if (item && item.hotkey === ".") {
          return nvsUse.use(null);
        } else if (item && item.version) {
          return nvsUse.use(item.version);
        }
      });
    }
    function showRemotesMenuAsync(cancel) {
      let remoteNames = Object.keys(settings2.remotes).filter((r) => r !== "default" && settings2.remotes[r]);
      if (remoteNames.length === 1) {
        return showRemoteVersionsMenuAsync(remoteNames[0], cancel);
      } else if (remoteNames.length === 0) {
        throw new Error3("No remote download souces are configured.");
      }
      let columnWidth = remoteNames.map((item) => item.length).reduce((a, b) => a > b ? a : b, 0) + 2;
      let i = 0;
      let menuItems = remoteNames.map((remoteName) => {
        return {
          hotkey: i < 26 ? String.fromCharCode("a".charCodeAt(0) + i++) : null,
          title: remoteName + " ".repeat(columnWidth - remoteName.length) + settings2.remotes[remoteName],
          selected: remoteName === settings2.remotes["default"],
          remoteName
        };
      });
      return menu(menuItems, {
        border: true,
        header: "Select a remote",
        pageSize: 15
      }).then((item) => {
        if (!item) {
          return cancel();
        } else if (item.remoteName) {
          return showRemoteVersionsMenuAsync(
            item.remoteName,
            showRemotesMenuAsync.bind(this, cancel)
          );
        }
      });
    }
    function showRemoteVersionsMenuAsync(remoteName, cancel) {
      return nvsList.getRemoteVersionsAsync(remoteName).then((result) => {
        let i = 0;
        let menuItems = result.map((v) => {
          return {
            hotkey: i < 26 ? String.fromCharCode("a".charCodeAt(0) + i++) : null,
            title: v.toString({ label: true }),
            version: v
          };
        });
        let header = "Select a " + remoteName + " version";
        return menu(menuItems, {
          border: true,
          header,
          pageSize: 15
        }).then((item) => {
          if (item && item.version) {
            return nvsAddRemove.addAsync(item.version, true);
          } else {
            return cancel();
          }
        });
      });
    }
    module2.exports = {
      showMainMenuAsync
    };
  }
});

// lib/migrate.js
var require_migrate = __commonJS({
  "lib/migrate.js"(exports2, module2) {
    "use strict";
    var childProcess = require("child_process");
    var fs = require("fs");
    var path = require("path");
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var nvsList = require_list();
    var nvsUse = require_use();
    var NodeVersion = require_version();
    function migrateGlobalModules(sourceVersion, targetVersion) {
      if (!sourceVersion) {
        throw new Error3("Specify a version to migrate from.");
      }
      let versions = nvsList.getVersions();
      let resolvedVersion = nvsList.find(sourceVersion, versions);
      if (!resolvedVersion) {
        throw new Error3("Source version not found: " + sourceVersion, Error3.ENOENT);
      }
      sourceVersion = resolvedVersion;
      if (!targetVersion) {
        targetVersion = nvsUse.getCurrentVersion();
        if (!targetVersion) {
          throw new Error3("Specify a version to migrate to.");
        }
      } else {
        resolvedVersion = nvsList.find(targetVersion, versions);
        if (!resolvedVersion) {
          throw new Error3("Target version not found: " + sourceVersion, Error3.ENOENT);
        }
        targetVersion = resolvedVersion;
      }
      if (NodeVersion.equal(sourceVersion, targetVersion)) {
        throw new Error3("Source and target versions may not be the same.");
      }
      let sourceDir = getGlobalModulesDir(sourceVersion);
      let targetDir = getGlobalModulesDir(targetVersion);
      if (sourceDir.toLowerCase() === targetDir.toLowerCase()) {
        throw new Error3("Both versions use the same global modules directory: " + sourceDir);
      }
      fs.readdirSync(sourceDir).forEach((childName) => {
        let childStats = fs.statSync(path.join(sourceDir, childName));
        if (childStats.isDirectory()) {
          if (!childName.startsWith("@")) {
            migratePackage(sourceDir, targetDir, childName, targetVersion);
          } else {
            fs.readdirSync(path.join(sourceDir, childName)).forEach((childName2) => {
              let childStats2 = fs.statSync(path.join(sourceDir, childName, childName2));
              if (childStats2.isDirectory()) {
                migratePackage(
                  sourceDir,
                  targetDir,
                  childName + "/" + childName2,
                  targetVersion
                );
              }
            });
          }
        }
      });
    }
    function getGlobalModulesDir(version) {
      let binPath = nvsUse.getVersionBinary(version);
      if (!binPath) {
        throw new Error3("Version not found: " + version, Error3.ENOENT);
      }
      let modulesDir = nvsUse.isWindows ? path.join(path.dirname(binPath), "node_modules") : path.join(path.dirname(path.dirname(binPath)), "lib/node_modules");
      try {
        fs.accessSync(modulesDir);
      } catch (e) {
        throw new Error3("Cannot access global modules directory: " + modulesDir, e);
      }
      return modulesDir;
    }
    function migratePackage(sourceDir, targetDir, packageName, targetVersion) {
      let sourcePackageDir = path.join(sourceDir, packageName);
      let targetPackageDir = path.join(targetDir, packageName);
      let sourcePackageInfo = getPackageInfo(sourcePackageDir);
      let targetPackageInfo = getPackageInfo(targetPackageDir);
      if (!sourcePackageInfo) {
        return;
      }
      if (targetPackageInfo) {
        let same = targetPackageInfo.version === sourcePackageInfo.version;
        if (!settings2.quiet) {
          console.log("Skipping  : " + packageName + " (source=" + (same ? "" : sourcePackageInfo.version + ", ") + "target=" + targetPackageInfo.version + ")");
        }
      } else {
        try {
          let sourceDirStats = fs.lstatSync(sourcePackageDir);
          if (sourceDirStats.isSymbolicLink()) {
            if (!settings2.quiet) {
              console.log("Linking   : " + packageName + " (" + sourcePackageInfo.version + ")");
            }
            let linkTarget = fs.readlinkSync(sourcePackageDir);
            linkPackage(targetDir, packageName, linkTarget, targetVersion);
          } else {
            if (!settings2.quiet) {
              console.log("Installing: " + packageName + " (" + sourcePackageInfo.version + ")");
            }
            installPackage(targetDir, packageName, targetVersion);
          }
        } catch (e) {
          console.warn("Failed to migrate package: " + packageName + "; " + e.message);
        }
      }
    }
    function getPackageInfo(packagePath) {
      try {
        return JSON.parse(fs.readFileSync(path.join(packagePath, "package.json")));
      } catch (e) {
        if (e instanceof SyntaxError || e.code === Error3.ENOENT) {
          return null;
        }
        throw e;
      }
    }
    function installPackage(targetDir, packageName, version) {
      let binPath = nvsUse.getVersionBinary(version);
      let npmCliPath = path.join(targetDir, "npm/bin/npm-cli.js");
      let child = childProcess.spawnSync(
        binPath,
        [npmCliPath, "install", "-g", packageName],
        { stdio: ["ignore", "ignore", process.stderr] }
      );
      if (child.error) {
        throw new Error3("Failed to launch npm.", child.error);
      } else if (child.status !== 0) {
        throw new Error3("Npm install failed for package: " + packageName, child.error);
      }
    }
    function linkPackage(targetDir, packageName, linkTarget, version) {
      let binPath = nvsUse.getVersionBinary(version);
      let npmCliPath = path.join(targetDir, "npm/bin/npm-cli.js");
      let child = childProcess.spawnSync(
        binPath,
        [npmCliPath, "link"],
        { stdio: ["ignore", "ignore", process.stderr], cwd: linkTarget }
      );
      if (child.error) {
        throw new Error3("Failed to launch npm.", child.error);
      } else if (child.status !== 0) {
        throw new Error3("Npm link failed for package: " + packageName, child.error);
      }
    }
    module2.exports = {
      migrateGlobalModules,
      getGlobalModulesDir
    };
  }
});

// lib/upgrade.js
var require_upgrade = __commonJS({
  "lib/upgrade.js"(exports2, module2) {
    "use strict";
    var settings2 = require_settings().settings;
    var Error3 = require_error();
    var NodeVersion = require_version();
    var nvsUse = require_use();
    var nvsList = require_list();
    var nvsAddRemove = null;
    var nvsLink = null;
    var nvsMigrate = null;
    function upgradeAsync(version) {
      if (!version) {
        version = nvsUse.getCurrentVersion();
        if (!version) {
          throw new Error3("Specify a version to upgrade.");
        }
      } else {
        let resolvedVersion = nvsList.find(version);
        if (!resolvedVersion) {
          throw new Error3("Specified version not found.", Error3.ENOENT);
        }
        version = resolvedVersion;
      }
      version.os = NodeVersion.defaultOs;
      let majorVersion = version.semanticVersion.replace(/(\.|-).*$/, "");
      return nvsList.getRemoteVersionsAsync(version.remoteName).then((availableVersions) => {
        let filter = new NodeVersion(version.remoteName, majorVersion, version.arch);
        availableVersions = availableVersions.filter((v) => filter.match(v) && v.packages.find((p) => p.os === version.os && p.arch === filter.arch));
        let newVersion = availableVersions[0];
        if (!newVersion || NodeVersion.compare(version, newVersion) <= 0) {
          return [`No new version found. ${version.semanticVersion} is the latest ${version.remoteName}/${majorVersion} version available.`];
        }
        if (!settings2.quiet) {
          console.log(`Upgrading ${version} to ${newVersion.semanticVersion}...`);
        }
        newVersion.arch = version.arch;
        let newBinPath = nvsUse.getVersionBinary(newVersion);
        if (newBinPath) {
          return upgradeToVersion(version, newVersion);
        } else {
          nvsAddRemove = nvsAddRemove || require_addRemove();
          return nvsAddRemove.addAsync(newVersion).then(() => {
            if (!settings2.quiet) {
              console.log(`Added at: ${nvsUse.homePath(nvsUse.getVersionBinary(newVersion))}`);
            }
            return upgradeToVersion(version, newVersion);
          });
        }
      });
    }
    function upgradeToVersion(oldVersion, newVersion) {
      let result = [];
      nvsMigrate = nvsMigrate || require_migrate();
      nvsMigrate.migrateGlobalModules(oldVersion, newVersion);
      nvsLink = nvsLink || require_link();
      let linkedVersion = nvsLink.getLinkedVersion();
      if (linkedVersion) {
        linkedVersion.os = NodeVersion.defaultOs;
        if (NodeVersion.equal(oldVersion, linkedVersion)) {
          result = result.concat(nvsLink.link(newVersion));
        }
      }
      let currentVersion = nvsUse.getCurrentVersion();
      if (currentVersion) {
        currentVersion.os = NodeVersion.defaultOs;
        if (NodeVersion.equal(oldVersion, currentVersion)) {
          result = result.concat(nvsUse.use(newVersion));
        }
      }
      nvsAddRemove = nvsAddRemove || require_addRemove();
      result = result.concat(nvsAddRemove.remove(oldVersion));
      return result;
    }
    module2.exports = {
      upgradeAsync
    };
  }
});

// lib/main.js
var os = require("os");
var settings = require_settings().settings;
var Error2 = require_error();
var debug = process.env["NVS_DEBUG"];
if (debug) {
  process.on("unhandledRejection", printError);
}
main(process.argv.slice(2));
function main(args) {
  console.log(args);
  let result = null;
  try {
    result = doCommand(args);
  } catch (e) {
    printError(e);
    process.exitCode = process.exitCode || 1;
  }
  if (result) {
    if (typeof result === "object" && result.then) {
      result.then((result2) => {
        printResult(result2);
      }, (e) => {
        printError(e);
        process.exitCode = process.exitCode || 1;
      });
    } else {
      printResult(result);
    }
  }
}
function doCommand(args) {
  const parseVersion = require_version().parse;
  if (args.length === 1) {
    switch (args[0]) {
      case "-h":
      case "/h":
      case "-?":
      case "/?":
      case "-help":
      case "/help":
      case "--help":
      case "help":
        return require_help()();
      case "-v":
      case "--version":
        const fs = require("fs");
        const path = require("path");
        const packageJson = require(__dirname, "../package.json");
        return packageJson.version;
    }
  }
  let options = [];
  while (args[0] && args[0].startsWith("-")) {
    options.push(args[0]);
    args.splice(0, 1);
  }
  let help = null;
  if (args[0] === "help" && args[1]) {
    help = require_help();
    args = args.slice(1);
  }
  require_settings().loadSettings();
  let version = null;
  switch (args[0]) {
    case void 0:
      if (settings.hideMenu) return require_help()();
      else return require_mainMenu().showMainMenuAsync();
    case "setup":
    case "install":
      if (help || args[1]) return require_help()("setup");
      return require_install().install();
    case "uninstall":
      if (help || args[1]) return require_help()("uninstall");
      return require_install().uninstall();
    case "which":
      if (help) return help("which");
      if (args[1]) {
        version = require_list().find(parseVersion(args[1]));
        if (!version) {
          throw new Error2("Specified version not found." + os.EOL + "To add this version now: nvs add " + version, Error2.ENOENT);
        }
      } else {
        version = require_use().getCurrentVersion();
      }
      return require_use().getVersionBinary(version);
    case "add":
      if (help) return help("add");
      if (!args[1]) {
        return require_auto().findAutoVersionAsync();
      }
      version = parseVersion(args[1]);
      return require_addRemove().addAsync(version);
    case "rm":
    case "remove":
      if (help) return help("remove");
      version = parseVersion(args[1]);
      return require_addRemove().remove(version);
    case "up":
    case "upgrade":
      if (help) return help("upgrade");
      if (args[1]) {
        version = parseVersion(args[1]);
      }
      return require_upgrade().upgradeAsync(version);
    case "list":
    case "ls": {
      if (help) return help("list");
      if (args[1]) {
        version = parseVersion(args[1]);
      }
      return require_list().list(version);
    }
    case "lr":
    case "lsr":
    case "ls-remote":
    case "list-remote":
      if (help) return help("list-remote");
      if (args[1]) {
        version = parseVersion(args[1]);
      }
      return require_list().listRemoteAsync(version);
    case "outdated":
      return require_list().listOutdatedAsync();
    case "alias":
    case "aliases":
      if (help) return help("alias");
      if (args[2] && args[1] === "-d") {
        return require_settings().removeAlias(args[2]);
      } else if (args[2]) {
        return require_settings().setAlias(args[1], args[2]);
      } else {
        return require_settings().listAliases(args[1]);
      }
    case "unalias":
      if (help) return help("alias");
      return require_settings().removeAlias(args[1]);
    case "remote":
    case "remotes":
      if (help) return help("remote");
      if (args[1] === "-d" || args[1] === "rm" || args[1] === "remove") {
        return require_settings().removeRemote(args[2]);
      } else if (args[1] === "add" || args[1] === "set") {
        return require_settings().setRemoteAsync(args[2], args[3]);
      } else if (args[1] === "ls" || args[1] === "list") {
        return require_settings().listRemotes();
      } else if (args[2]) {
        return require_settings().setRemoteAsync(args[1], args[2]);
      } else {
        return require_settings().listRemotes(args[1]);
      }
    case "run":
      if (help) return help("run");
      if (args[1] && isJsFileOrDirectory(args[1])) {
        version = "auto";
      } else {
        if (args[1] === "default" || args[1] === "auto") {
          version = args[1];
        } else {
          version = parseVersion(args[1]);
        }
        args.splice(1, 1);
      }
      version = version || "auto";
      if (version === "auto") {
        return require_auto().findAutoVersionAsync().then((version2) => {
          return require_use().run(version2, options.concat(args.slice(1)));
        });
      } else {
        return require_use().run(version, options.concat(args.slice(1)));
      }
    case "exec":
      if (help) return help("exec");
      version = parseVersion(args[1]);
      return require_use().exec(version, args[2], args.slice(3));
    case "link":
    case "ln":
      if (help) return help("link");
      if (args[1]) {
        version = parseVersion(args[1]);
      }
      return require_link().link(version);
    case "unlink":
    case "ul":
      if (help) return help("unlink");
      if (args[1]) {
        version = parseVersion(args[1]);
      }
      return require_link().unlink(version);
    case "auto":
      if (help) return help("auto");
      if (!args[1]) {
        return require_auto().autoSwitchAsync();
      } else {
        switch (args[1].toLowerCase()) {
          case "at":
            return require_auto().autoSwitchAsync(args[2]);
          case "on":
          case "enable":
            return require_auto().enableAutoSwitch(true);
          case "off":
          case "disable":
            return require_auto().enableAutoSwitch(false);
          default:
            return require_help()("auto");
        }
      }
    case "use":
      if (help) return help("use");
      if (args[1]) {
        if (args[1] === "default" || args[1] === "auto") {
          version = args[1];
        } else {
          version = parseVersion(args[1]);
        }
      }
      version = version || "auto";
      if (version === "auto") {
        return require_auto().findAutoVersionAsync().then((version2) => {
          return require_use().use(version2);
        });
      } else {
        return require_use().use(version);
      }
    case "migrate":
      if (help) return help("migrate");
      version = parseVersion(args[1]);
      return require_migrate().migrateGlobalModules(
        version,
        args[2] ? parseVersion(args[2]) : require_use().getCurrentVersion()
      );
    case "menu":
      if (help) return help("menu");
      return require_mainMenu().showMainMenuAsync();
    case "vscode":
      return require_help()("vscode");
    default:
      if (!help) {
        if (isJsFileOrDirectory(args[0])) {
          return require_auto().findAutoVersionAsync().then((version2) => {
            return require_use().run(version2, options.concat(args));
          });
        } else if (args.slice(1).find((a) => isJsFileOrDirectory(a))) {
          if (args[0] === "default" || args[0] === "auto") {
            version = args[0];
          } else {
            version = parseVersion(args[0]);
          }
          if (version === "auto") {
            return require_auto().findAutoVersionAsync().then((version2) => {
              return require_use().run(version2, options.concat(args.slice(1)));
            });
          } else {
            return require_use().run(version, options.concat(args.slice(1)));
          }
        } else {
          if (args[0] === "default" || args[0] === "auto") {
            version = args[0];
          } else {
            version = require_version().tryParse(args[0]);
          }
          if (version) {
            if (version === "auto") {
              return require_auto().findAutoVersionAsync().then((version2) => {
                return require_use().use(version2);
              });
            } else {
              return require_use().use(version);
            }
          }
        }
      }
      return require_help()();
  }
}
function isJsFileOrDirectory(arg) {
  if (!arg) {
    return false;
  } else if (arg.startsWith("-")) {
    return false;
  } else if (/\.js$/i.test(arg)) {
    return true;
  }
  try {
    let stats = require("fs").statSync(arg);
    if (stats.isDirectory()) {
      return true;
    }
  } catch (e) {
  }
  return false;
}
function printResult(result) {
  if (Array.isArray(result)) {
    result = result.join(os.EOL);
  }
  if (result) {
    try {
      console.log(result);
    } catch (e) {
    }
  }
}
function printError(e) {
  if (e) {
    let isPermissionError = e.code === "EPERM" || e.code === "EACCES";
    console.error(debug ? e.stack || e.message : e.message);
    while (e.cause) {
      e = e.cause;
      console.error(debug ? e.stack || e.message : e.message);
    }
    if (isPermissionError) {
      if (process.platform === "win32") {
        console.error("Try running again as Administrator.");
      } else if (!process.env["NVS_EXECUTE"]) {
        console.error("Try running again with sudo:\n  nvsudo " + process.argv.slice(2).join(" "));
      } else {
        console.error("Try running again with sudo.");
      }
    }
  }
}
/*! Bundled license information:

progress/lib/node-progress.js:
  (*!
   * node-progress
   * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
   * MIT Licensed
   *)
*/
