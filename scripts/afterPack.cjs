// electron-builder afterPack — 맥 빌드에 임시(ad-hoc) 서명을 입힌다(electron-builder.yml의 mac 주석).
// 인증서가 없어 electron-builder가 서명을 건너뛰면 Apple Silicon에서 "손상됨"으로 열리지 않는다.
//
// 유니버설 빌드는 x64·arm64를 따로 싼 뒤(…-x64-temp, …-arm64-temp) 하나로 합치는데, 그 둘에 먼저
// 서명하면 서명 파일(CodeResources)이 서로 달라져 합치기가 거부된다("identical SHAs" 오류) —
// 합쳐진 최종 앱에만 서명한다.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (/-temp$/.test(context.appOutDir)) return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  console.log(`[afterPack] ad-hoc signed: ${app}`);
};
