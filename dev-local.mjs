/**
 * Sobe o Vite em modo dev e abre o Google Chrome quando o servidor estiver pronto.
 * Uso: node dev-local.mjs   ou   npm run start:local
 * (Windows / macOS / Linux com Node instalado)
 */
import { spawn, exec } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

if (!existsSync(join(root, "node_modules"))) {
  console.error("Instale as dependências antes: npm install");
  process.exit(1);
}

function openChrome(url) {
  if (process.platform === "darwin") {
    exec(`open -na "Google Chrome" --args --new-window "${url}"`);
  } else if (process.platform === "win32") {
    exec(`cmd /c start "" chrome "${url}"`);
  } else {
    exec(`xdg-open "${url}"`, () => {});
  }
}

let opened = false;
const isWin = process.platform === "win32";
const viteBin = join(root, "node_modules", ".bin", isWin ? "vite.cmd" : "vite");
const child = spawn(viteBin, ["dev"], {
  cwd: root,
  stdio: ["inherit", "pipe", "inherit"],
  env: { ...process.env },
});

const LOCAL_URL = /Local:\s+(https?:\/\/\S+)/;

let out = "";
child.stdout.on("data", (chunk) => {
  const s = chunk.toString();
  process.stdout.write(s);
  if (opened) return;
  out += s;
  const m = LOCAL_URL.exec(out);
  if (m) {
    opened = true;
    const url = m[1].replace(/\u001b\[[0-9;]*m/g, "");
    openChrome(url);
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
