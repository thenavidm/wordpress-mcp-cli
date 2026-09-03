/**
 * Speak the real MCP protocol to the built server and check what comes back.
 *
 * The unit tests exercise the pieces. This proves the assembled binary starts,
 * completes a handshake with the SDK version actually installed, and advertises
 * the tool count the README claims. Those are the failures that survive a green
 * suite and reach a user.
 */
import { spawn } from "node:child_process";

const EXPECTED_TOOLS = 42;
const EXPECTED_READ_ONLY_TOOLS = 22;

function talk(env) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist/index.js"], { env: { ...process.env, ...env } });
    const out = {};
    let buffer = "";
    const send = (msg) => child.stdin.write(`${JSON.stringify(msg)}\n`);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for the server"));
    }, 20000);

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.id === 1) {
          out.serverInfo = msg.result.serverInfo;
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
        }
        if (msg.id === 2) {
          out.tools = msg.result.tools;
          send({ jsonrpc: "2.0", id: 3, method: "resources/list" });
        }
        if (msg.id === 3) {
          out.resources = msg.result.resources;
          send({ jsonrpc: "2.0", id: 4, method: "prompts/list" });
        }
        if (msg.id === 4) {
          out.prompts = msg.result.prompts;
          clearTimeout(timer);
          child.kill();
          resolve(out);
        }
      }
    });

    child.on("error", reject);
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "ci", version: "1" },
      },
    });
  });
}

const normal = await talk({});
if (normal.tools.length !== EXPECTED_TOOLS) {
  throw new Error(`expected ${EXPECTED_TOOLS} tools, got ${normal.tools.length}`);
}
if (!normal.resources.length || !normal.prompts.length) {
  throw new Error("resources and prompts should both be advertised");
}
console.log(`handshake ok: ${normal.tools.length} tools, ${normal.resources.length} resources, ${normal.prompts.length} prompts`);

const readOnly = await talk({ WORDPRESS_READ_ONLY: "1" });
if (readOnly.tools.length !== EXPECTED_READ_ONLY_TOOLS) {
  throw new Error(`read-only should expose ${EXPECTED_READ_ONLY_TOOLS} tools, got ${readOnly.tools.length}`);
}
const leaked = readOnly.tools.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name);
if (leaked.length) {
  throw new Error(`read-only mode still advertises writes: ${leaked.join(", ")}`);
}
console.log(`read-only ok: ${readOnly.tools.length} tools, no writes advertised`);

// The standing context cost, so the README's figure is reproducible rather than
// remembered. This is the payload every MCP client is handed on every turn.
console.log(
  `tools/list payload: ${JSON.stringify(normal.tools).length} characters, ` +
    `${JSON.stringify(readOnly.tools).length} read-only`,
);
