import { readdirSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const directory = resolve(root, "supabase/functions")
const entries = readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => resolve(directory, entry.name, "index.ts"))
  .filter(existsSync)
if (!entries.length) throw new Error("검사할 Edge Function을 찾지 못했습니다.")
// check는 함수 본문을 실행하지 않습니다. 검사기만 고정 버전으로 사용합니다.
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error("npm run typecheck:functions로 실행해 주세요.")
const result = spawnSync(process.execPath, [npmCli, "exec", "--yes", "--package=deno@2.9.6", "--", "deno", "check",
  "--config", resolve(root, "scripts/edge-typecheck/deno.json"), "--frozen-lockfile", ...entries],
  { cwd: root, stdio: "inherit" })
if (result.error) throw result.error
process.exit(result.status ?? 1)
