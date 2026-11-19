// Optional real-browser harness; no credentials, app server or new dependencies required.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const ts = require("typescript");
const bundled = require("next/dist/compiled/webpack/webpack");
bundled.init();
const cache = path.resolve("node_modules/.cache");
fs.mkdirSync(cache, { recursive: true });
const output = fs.mkdtempSync(path.join(cache, "oakhaven-session-qa-"));
const loader = path.join(output, "ts-loader.cjs");
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
bundled.webpack({
  mode: "development", target: "web", devtool: false,
  entry: path.resolve("tests/browser/session-ownership.tsx"),
  output: { path: output, filename: "bundle.js" },
  resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": path.resolve("src") } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: [loader] }] },
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); res.end(fs.readFileSync(path.join(output, "bundle.js"))); }
    else { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<!doctype html><title>Session ownership QA</title><div id="root"></div><pre id="result">RUNNING</pre><script src="/bundle.js"></script>'); }
  });
  server.listen(3021, "127.0.0.1", () => console.log("Synthetic session QA: http://127.0.0.1:3021"));
});
