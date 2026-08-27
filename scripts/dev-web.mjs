// Created on 2026-08-25
// Updated on 2026-08-25
// @author: https://github.com/Linmoqian
/**
 * 统一启动 Web 后端与 Vite 前端，并在退出时回收两个子进程。
 */

import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const services = [
  { name: "server", cwd: path.join(projectRoot, "server"), args: ["start"] },
  { name: "app", cwd: path.join(projectRoot, "app"), args: ["dev"] },
];
const children = [];
let stopping = false;

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 250);
}

for (const service of services) {
  const child = spawn(pnpmCommand, service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[错误] ${service.name} 启动失败：${error.message}`);
    stopAll(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.log(`[信息] ${service.name} 已退出，正在停止其他服务。`);
      stopAll(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

console.log("[信息] Web 后端：http://127.0.0.1:8788");
console.log("[信息] Vite 前端：http://localhost:3223");
