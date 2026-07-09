const fs = require("fs");
const path = require("path");

function resolveOptional(packageName) {
  try {
    return require.resolve(packageName);
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") return null;
    throw error;
  }
}

function patchFile(filePath, replacements, label) {
  if (!filePath) {
    console.log(`[patch-usocket-node24] ${label} not installed, skipping`);
    return;
  }

  let source = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const { before, after, marker } of replacements) {
    if (source.includes(marker || after)) continue;
    if (!source.includes(before)) {
      throw new Error(`[patch-usocket-node24] Expected pattern not found in ${filePath}`);
    }
    source = source.replace(before, after);
    changed = true;
  }

  if (!changed) {
    console.log(`[patch-usocket-node24] ${label} already patched`);
    return;
  }

  fs.writeFileSync(filePath, source);
  console.log(`[patch-usocket-node24] patched ${path.relative(process.cwd(), filePath)}`);
}

const usocketEntry = resolveOptional("usocket");
patchFile(
  usocketEntry && path.resolve(usocketEntry),
  [
    {
      before: "if (util.isError(r)) {",
      after: "if (r instanceof Error || (util.types && util.types.isNativeError(r))) {",
      marker: "isNativeError(r)",
    },
  ],
  "usocket"
);

const dbusConnectionEntry = resolveOptional("dbus-next/lib/connection");
patchFile(
  dbusConnectionEntry && path.resolve(dbusConnectionEntry),
  [
    {
      before: `          if (params.abstract) {
            const usocket = require('usocket');
            const sock = new usocket.USocket({ path: '\\u0000' + params.abstract });
            sock.supportsUnixFd = negotiateUnixFd;
            return sock;
          }`,
      after: `          if (params.abstract) {
            if (!negotiateUnixFd) {
              return net.createConnection('\\u0000' + params.abstract);
            }
            const usocket = require('usocket');
            const sock = new usocket.USocket({ path: '\\u0000' + params.abstract });
            sock.supportsUnixFd = negotiateUnixFd;
            return sock;
          }`,
      marker: "return net.createConnection('\\u0000' + params.abstract);",
    },
    {
      before: `          if (params.path) {
            try {
              const usocket = require('usocket');
              const sock = new usocket.USocket({ path: params.path });
              sock.supportsUnixFd = negotiateUnixFd;
              return sock;
            } catch (err) {
              // TODO: maybe emit warning?
              return net.createConnection(params.path);
            }
          }`,
      after: `          if (params.path) {
            if (!negotiateUnixFd) {
              return net.createConnection(params.path);
            }
            try {
              const usocket = require('usocket');
              const sock = new usocket.USocket({ path: params.path });
              sock.supportsUnixFd = negotiateUnixFd;
              return sock;
            } catch (err) {
              // TODO: maybe emit warning?
              return net.createConnection(params.path);
            }
          }`,
      marker: "if (!negotiateUnixFd) {\n              return net.createConnection(params.path);",
    },
  ],
  "dbus-next connection"
);
