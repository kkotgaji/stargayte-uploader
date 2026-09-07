// electron-builder afterPack — 맥 빌드에 임시(ad-hoc) 서명을 입힌다(electron-builder.yml의 mac 주석).
// 인증서가 없어 electron-builder가 서명을 건너뛰면 Apple Silicon에서 "손상됨"으로 열리지 않는다.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  console.log(`[afterPack] ad-hoc signed: ${app}`);
};
