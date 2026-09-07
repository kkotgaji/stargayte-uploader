# 인수인계 (새 세션이 먼저 읽는 문서)

이 저장소는 스타게이트(kkotgaji/stargayte 웹 · kkotgaji/stargayte-api 서버)의 **윈도우 자동
등록기**다. 답변은 **한국어**로 한다. 커밋 메시지에 모델 이름을 넣지 않는다.

## 1. 구조(2026-09-07 셋째 세션에서 사용자가 고른 것 — "(a)로 ㄱㄱ")
등록기는 **사이트의 헤드리스 진입점 `/uploader.html`을 숨은 BrowserWindow로 띄워** 파일을
넘기고 결과만 받는다. 파서·회원 매칭·규칙·서버 계약은 전부 사이트(stargayte 저장소
`src/uploader/register.ts`·`main.ts`·`bridge.d.ts`, 루트 `uploader.html`, `vite.config.ts`의
두 번째 진입점)에 있다. 이유: 전 구조(사이트 소스를 등록기에 베껴 두기)는 사이트가 바뀔
때마다 사본이 조용히 어긋났다. 이제 사이트가 배포되면 등록기는 재설치 없이 새 절차를 쓴다.
로그인도 그 페이지 것(세션은 숨은 창의 localStorage, persist 파티션). CORS는 애초에 문제가
아니었다(Electron 메인=Node) — 지금은 사이트 출처에서 부르니 더더욱 아니다.

## 2. 사용자가 정한 규칙(사이트 `register.ts`·`replayDraft.ts`가 갖는다)
1. 승자를 못 가린 경기 → 결과 모름(`unknown`). (`not_held`는 '미실시'라 뜻이 다르다.)
2. 회원과 안 이어지는 참가자 → 비회원 슬롯.
3. 리플레이 해시 유일성 검사는 안 한다. 시작 시각 중복 → 머지(더 긴 저장본이면 파일 교체+재굽기).
4. **회원 2명 규칙**: 양 팀 합쳐 서로 다른 회원 2명은 있어야 등록. 한 팀에 한 명씩일 필요 없음.
   사이트 검토창은 자동 제외(되돌릴 수 있음), 등록기는 건너뜀.
5. 유즈맵·팀 못 나눔·관전자 추정·2분 미만 → 건너뜀. 컴퓨터 낀 경기 → 등록.
6. Electron, NSIS 원클릭, 윈도우 시작 시 자동 실행. 처음 설치하면 2026-07-01(KST) 이후 리플레이를
   한 번 훑어 올린다. 다 올리고 나면 오른쪽 아래 토스트 "리플레이 N건을 스타게이트에 등록했습니다." 한 번.
7. 운영 사이트는 https://stargayte.vercel.app (API는 https://stargayte-api.up.railway.app). 빌드 기본값이
   그것이고 `UPLOADER_SITE_BASE`로 바꿀 수 있다(로컬 vite dev에 붙일 때).

## 3. 이 저장소의 파일
`src/main.ts` 트레이·처리 루프, `src/page.ts` 숨은 사이트 창(로드 재시도·job 왕복·세션 이벤트),
`src/preload.ts` 다리(사이트 `bridge.d.ts`와 짝 — 바꾸면 둘 다), `src/watcher.ts` 폴더 감시,
`src/store.ts` 처리 장부, `src/toast.ts` 오버레이 토스트, `src/config.ts` 시각·재시도 상수.
번들은 22KB(전엔 파서를 품어 3.2MB).

## 4. 검증한 것
- 사이트: `npm run build` 통과(uploader 청크 4KB + replayDraft 46KB, 파서는 동적 청크).
- 사이트 `/uploader.html`을 Playwright로 로컬 API(sqlite)에 붙여 검증: 로그인 폼 → 틀린 비밀번호
  오류 → 로그인 → 회원 2명 리플레이 "✔ 등록" → 같은 파일 "↻ 기존 경기 갱신" → 회원 0명 "건너뜀
  (회원이 2명 미만)" → 새로고침 뒤 세션 복원. 다리 모드(가짜 `window.stargayteUploader`)로
  ready 이벤트·job 결과·로그아웃까지 확인. 스크립트는 세션 스크래치에만 있었다(저장소엔 없음).
- 등록기: tsc·esbuild 통과. **윈도우에서 실제 실행은 아직 못 했다**(리눅스 세션).

## 5. 서버 쪽
바꿀 것이 없다. 전 구조용 `POST /api/auth/app-login`은 사용자 지시로 걷었다(stargayte-api 브랜치를
main과 같게 되돌림). 등록기는 사이트가 쓰는 API를 사이트 출처에서 그대로 부른다.

## 6. 설치본 배포
`.github/workflows/release.yml` — `v*` 태그 푸시 또는 "Run workflow" → 윈도우 러너(exe)·맥 러너(dmg 유니버설)
→ `v<package.json 버전>` Release에 둘 다 붙인다(release 잡 하나가 모아서 올린다 — 두 잡이 같은 Release를
동시에 만들면 경합한다). 이 세션의 git 프록시는 태그 푸시를 막으므로(403) workflow_dispatch로 돌렸다.
**맥은 무서명**(사용자 결정, 클럽에 맥 유저가 있다): electron-builder는 인증서가 없으면 서명을 통째로
건너뛰어 Apple Silicon에서 "손상됨"이 되므로 `scripts/afterPack.cjs`가 ad-hoc 서명(`codesign -s -`)을
입힌다. 사용자는 처음 한 번 "그래도 열기". 맥 리플레이 폴더는 `config.ts`의 `replayDirOf`
(`~/Library/Application Support/Blizzard/StarCraft/Maps/Replays/AutoSave`, 클럽 맥 유저가 확인한 경로).
맥 실기 검증은 못 했다(리눅스 세션). 자동 업데이트는 안 한다(사용자 결정: 수동).

## 7. 남은 일
- [x] 사이트 PR #1 main 머지·Vercel 배포됨 — 사용자가 https://stargayte.vercel.app/uploader.html 로그인 화면 확인.
- [ ] 윈도우·맥에서 실제 실행 검증(트레이·숨은 창 로그인·토스트·자동 실행·맥 "그래도 열기" 흐름).

## 8. 명령
```
npm install && npm run typecheck
npm run build                                       # 운영 사이트 주소로
UPLOADER_SITE_BASE=http://localhost:5173 npm start   # 로컬 사이트(vite dev)에 붙여 띄우기
git tag v0.x.y && git push origin v0.x.y             # 설치본 Release
```
