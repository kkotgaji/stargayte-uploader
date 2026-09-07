// 홈페이지(stargayte) 저장소에서 파서·회원 매칭·슬롯 규약 소스를 web/src 아래로 베껴 온다.
// 등록기는 홈페이지와 "같은 절차"여야 하므로 원본을 손대지 않고 그대로 복사하고, 어느
// 커밋에서 왔는지 web/SOURCE를 남긴다.  사용: node scripts/sync-web.mjs ../stargayte
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";

const FILES = [
  "src/utils/replayParser.ts", "src/utils/replayTechNames.ts", "src/utils/replayTactics.ts",
  "src/utils/replayNames.ts", "src/utils/date.ts", "src/utils/replayMemberMatch.ts",
  // types/index.ts가 TruthMix 꼴을 여기서 가져온다(타입만).
  "src/utils/statsMix.ts",
  "src/constants/computerSlot.ts", "src/constants/unregisteredSlot.ts",
  "src/types/index.ts", "src/types/screp-js.d.ts",
];
const from = process.argv[2] ?? "../stargayte";
const here = new URL("../", import.meta.url).pathname;
for (const f of FILES) {
  const dst = join(here, "web", f);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(join(from, f), dst);
}
const rev = execSync(`git log -1 --format=%H -- ${FILES.join(" ")}`, { cwd: from }).toString().trim();
writeFileSync(join(here, "web", "SOURCE"), `stargayte ${rev}\n${FILES.join("\n")}\n`);
console.log(`web/ ← stargayte@${rev.slice(0, 7)} (${FILES.length} files)`);
