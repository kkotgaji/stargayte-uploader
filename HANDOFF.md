# 인수인계 (새 세션이 먼저 읽는 문서)

이 저장소는 스타게이트(kkotgaji/stargayte 웹 · kkotgaji/stargayte-api 서버)의 **윈도우 자동
등록기**다. 앞선 세션들(2026-09-07)에서 사용자와 정한 것·만든 것·남은 것을 여기 적는다.
답변은 **한국어**로 한다. 커밋 메시지에 모델 이름을 넣지 않는다.

## 1. 사용자가 정한 것(고정, 사용자 설정 화면 없음)
1. 승자를 못 가린 경기 → **결과 모름(`unknown`)**으로 등록. (첫 세션은 `not_held`로 정했으나
   그 뒤 홈페이지가 `unknown`(결과 모름)을 따로 두었고 `not_held`는 '미실시'라 뜻이 다르다 —
   홈페이지와 같게 `unknown`으로 바꿨다.)
2. 회원과 안 이어지는 참가자 → 비회원 슬롯(`__unregistered__<uuid>`)으로 등록.
3. 리플레이 해시로 유일성 검사는 하지 않는다(같은 경기를 여러 사람이 올린다). 사이트의
   시작 시각(gameStartedAt) 중복 검사 → `merge-replay` 그대로.
4. 앱용 장기 토큰 → 서버 `POST /api/auth/app-login`(아래 4절).
5. Electron 허용. 가볍고 설치가 간단해야 한다(NSIS 원클릭, 윈도우 시작 시 자동 실행).
6. 처음 설치하면 **2026-07-01(KST) 이후** 리플레이를 한 번 훑어 올린다(토스트·알림으로 안내).
7. 올라갈 때 오른쪽 아래 오버레이 토스트: "리플레이 N건이 스타게이트에 업로드되었습니다."
8. 운영 API: `https://stargayte-api.up.railway.app` (빌드 때 `UPLOADER_API_BASE`로 박는다).
9. **회원 2명 규칙**(2026-09-07 둘째 세션): 홈페이지와 등록기 모두 로스터에 서로 다른 회원이
   2명은 있어야 등록한다. 꼭 한 팀에 한 명씩일 필요는 없다 — 혼자 비회원·컴퓨터하고만 한
   판을 거르는 것이다. 홈페이지는 이미 그렇게 돼 있었다(`replayDraft.ts`의 `memberSlotCount`
   → `fewmembers` 자동 제외, 검토창에서 사람이 되돌릴 수는 있다). 등록기는 `RULES.minMembers`.

## 2. 만든 것(이 저장소)
- `src/main.ts` 트레이·로그인 창·처리 루프, `src/pipeline.ts` 사이트와 같은 등록 절차,
  `src/api.ts` 서버 호출, `src/watcher.ts` 폴더 감시(재귀 fs.watch + 1분 재훑기, 3초 안정 대기,
  mtime 오름차순), `src/store.ts` 토큰(safeStorage)·처리 장부, `src/toast.ts` 오버레이 토스트,
  `src/config.ts` 고정 규칙(RULES·REJECTED_GAME_TYPES·INITIAL_SCAN_FROM·재시도).
- `web/src/`는 홈페이지 소스를 그대로 베낀 것(`npm run sync-web`, 출처는 `web/SOURCE`).
  파서(screp-js)·회원 매칭·슬롯 규약이 사이트와 동일해야 하므로 손대지 않는다.
  홈페이지가 재생기 패키지(scplay)에서 빌려 쓰는 타입 둘(`Race`·`ReplayMapGrid`)은
  `web/src/types/scplay.d.ts`에 등록기가 따로 베껴 둔다(패키지를 설치하면 vite 빌드를 돈다).
- **`src/pipeline.ts`는 홈페이지 `replayDraft.ts`의 사본**이다(그 파일은 브라우저 API 클라이언트를
  끌어들여 그대로 못 쓴다). 둘째 세션에서 홈페이지 쪽이 일주일 새 꽤 바뀌어 있어(유즈맵 거절
  `gameType`, 난투 FFA `0103`, 결과 모름 `unknown`, buildMix 제거, 머지 때 리플레이 파일 실어
  더 길면 교체+재굽기) 다시 맞췄다. → 홈페이지가 바뀌면 `sync-web` + 이 파일을 견준다.
- 건너뛰는 조건: 유즈맵(갈래 10), 팀 구분 불확실, 관전자 추정 있음, 2분 미만, 한쪽 팀 비어
  있음(FFA는 team1 비어도 등록), 종족 못 읽음, **회원 2명 미만**. 컴퓨터 낀 경기는 등록.
- 검증한 것: tsc 통과, esbuild 번들, `scripts/dry-run.mjs`(웹 저장소 `temp/*.rep` 229건)로
  회원 0명 → 전부 "회원 2명 미만" 건너뜀, 회원 1명·2명 목록으로 규칙이 갈리는 것 확인.
  윈도우 실행·NSIS 설치본은 첫 세션이 리눅스+wine으로 빌드만 확인(82MB).

## 3. 서버 쪽
- `POST /api/auth/app-login {id, password, device}` → `{appToken, expiresAt, user}`,
  장기 JWT(`APP_TOKEN_EXPIRE_DAYS` 기본 365, claim kind=app), 접속 기록 detail "uploader <기기>".
  둘째 세션이 stargayte-api 브랜치 `claude/handoff-continuation-4u3zmo`(커밋 77095c3)에 넣고
  푸시했다(테스트 332 통과). 첫 세션 초안의 버그 하나 고침: X-Client-Env가 없을 때 "uploader"를
  채우면 `is_recordable_client`가 운영이 아니라고 봐 접속 기록이 조용히 빠졌다 → 헤더 그대로 넘긴다.
  **main에 머지·배포해야 앱 로그인이 된다(그 전엔 404).**
- 회원 수 제한은 서버에는 없다(양 팀 최소 1명만). 규칙은 홈페이지 검토창·등록기 양쪽 클라이언트에 있다.

## 4. 열린 질문(사용자가 둘째 세션 끝에 물었다 — 답만 하고 아직 안 만들었다)
"등록기가 내부적으로 stargayte(홈페이지)에 연결해서 업로드하면 소스 파편화도 없고 CORS도
해결되지 않나?" → 가능하다. CORS는 지금도 문제가 아니다(Electron 메인=Node에서 호출).
파편화는 실제 문제다(pipeline.ts가 replayDraft.ts의 사본이라 이번에도 어긋나 있었다).
길은 둘: (a) 홈페이지가 UI 없는 '헤드리스 등록 진입점'(예: `/uploader.html`)을 내고 등록기는
숨은 BrowserWindow로 그것을 띄워 파일을 넘긴다 — 파서·규칙이 배포된 사이트 것 그대로, 사이트가
바뀌면 앱은 안 고쳐도 된다; (b) 홈페이지의 `replayDraft.ts`에서 api 의존을 주입식으로 떼어
등록기가 git 의존성으로 그 모듈을 import한다. 사용자가 고르면 진행한다.

## 5. 남은 일
- [ ] 서버 브랜치 main 머지·배포(3절). 그 전엔 앱 로그인이 404.
- [ ] 윈도우에서 실제 실행 검증(트레이·로그인·토스트·자동 실행). 두 세션 다 리눅스라 못 했다.
- [ ] 설치본 배포 방법(GitHub Release에 exe 올리기 등) — 30MB 넘어 대화로는 못 보낸다.
- [ ] 4절의 구조 결정(선택).

## 6. 명령
```
npm install && npm run typecheck
UPLOADER_API_BASE=https://stargayte-api.up.railway.app npm run build
node scripts/dry-run.mjs [--members members.json] ../stargayte/temp/*.rep   # 가짜 서버로 파이프라인만
npm run sync-web                                          # 홈페이지 소스 다시 베끼기(../stargayte)
npm run dist                                              # 윈도우(또는 wine32+64 리눅스)에서 설치본
```
