# 인수인계 (새 세션이 먼저 읽는 문서)

이 저장소는 스타게이트(kkotdari/stargayte 웹 · kkotdari/stargayte-api 서버)의 **윈도우 자동
등록기**다. 앞선 세션(2026-09-07)에서 사용자와 정한 것·만든 것·남은 것을 여기 적는다.
답변은 **한국어**로 한다. 커밋 메시지에 모델 이름을 넣지 않는다.

## 1. 사용자가 정한 것(고정, 사용자 설정 화면 없음)
1. 승자를 못 가린 경기 → 승패모름(`not_held`)으로 등록.
2. 회원과 안 이어지는 참가자 → 비회원 슬롯(`__unregistered__<uuid>`)으로 등록.
3. 리플레이 해시로 유일성 검사는 하지 않는다(같은 경기를 여러 사람이 올린다). 사이트의
   시작 시각(gameStartedAt) 중복 검사 → `merge-replay` 그대로.
4. 앱용 장기 토큰이 필요하다 → 서버에 `POST /api/auth/app-login` 추가(아래 4절).
5. Electron 허용. 가볍고 설치가 간단해야 한다(NSIS 원클릭, 윈도우 시작 시 자동 실행).
6. 처음 설치하면 **2026-07-01(KST) 이후** 리플레이를 한 번 훑어 올린다(토스트·알림으로 안내).
7. 올라갈 때 오른쪽 아래 오버레이 토스트: "리플레이 N건이 스타게이트에 업로드되었습니다."
8. 운영 API: `https://stargayte-api.up.railway.app` (빌드 때 `UPLOADER_API_BASE`로 박는다).

## 2. 만든 것(이 저장소)
- `src/main.ts` 트레이·로그인 창·처리 루프, `src/pipeline.ts` 사이트와 같은 등록 절차,
  `src/api.ts` 서버 호출, `src/watcher.ts` 폴더 감시(재귀 fs.watch + 1분 재훑기, 3초 안정 대기,
  mtime 오름차순), `src/store.ts` 토큰(safeStorage)·처리 장부, `src/toast.ts` 오버레이 토스트,
  `src/config.ts` 고정 규칙(RULES·INITIAL_SCAN_FROM·재시도).
- `web/src/`는 홈페이지 소스를 그대로 베낀 것(`scripts/sync-web.mjs ../stargayte`, 출처는
  `web/SOURCE`). 파서(screp-js)·회원 매칭·슬롯 규약이 사이트와 동일해야 하므로 손대지 않는다.
- 검증한 것: tsc 통과, esbuild 번들, `scripts/dry-run.mjs`로 샘플 리플레이 225건(웹 저장소
  `temp/*.rep`) → 223 등록·2 건너뜀(팀 구분 불확실 1, 2분 미만 1), 폴더 감시(하위 폴더 포함·
  첫 훑기 정렬·기준일 이전 제외) Node에서 확인, 리눅스+wine으로 NSIS 설치본 빌드 성공(82MB).
- 건너뛰는 조건(사이트 검토 화면이 사람 확인을 요구하던 것): 팀 구분 불확실(UMS), 관전자 추정
  있음, 2분 미만, 한쪽 팀 비어 있음, 종족 못 읽음. 컴퓨터 낀 경기는 등록(사이트 기본값).

## 3. 사용자 질문에 확인해 준 사실(기존 로직)
- 같은 경기 다른 파일이 오면 `merge-replay`는 지표·맵·시간·(확실할 때만) 승패만 갱신하고
  **리플레이 파일은 처음 것 그대로, 굽기(bake)도 다시 안 한다**. "더 긴 리플레이로 교체 +
  재굽기"는 서버에 새로 넣어야 한다(머지 payload에 파일을 싣고 duration이 길면 교체 →
  `openbw.bake_quietly`). 사용자가 원하면 다음 일감.
- 회원 수 제한은 없다(양 팀 최소 1명만). 회원 0~1명이어도 등록되고 컴퓨터·비회원이 낀
  경기는 포인트 0점 처리. "회원 2명 이상만" 규칙을 원하면 `RULES`에 한 줄 추가.

## 4. 서버 쪽(아직 반영 안 됨)
`server/0001-POST-auth-app-login.patch` — stargayte-api main(27415c2) 기준.
`POST /api/auth/app-login {id, password, device}` → `{appToken, expiresAt, user}`,
장기 JWT(`APP_TOKEN_EXPIRE_DAYS` 기본 365, claim kind=app), 접속 기록 detail "uploader <기기>".
테스트 `tests/test_app_login.py` 포함(통과). 앞 세션은 stargayte-api에 푸시 권한이 없어
못 올렸다 → `cd stargayte-api && git am server/0001-*.patch && git push` 뒤 배포해야 앱 로그인이 된다.

## 5. 남은 일
- [ ] 서버 패치 적용·배포(4절). 그 전엔 앱 로그인이 404.
- [ ] 윈도우에서 실제 실행 검증(트레이·로그인·토스트·자동 실행). 앞 세션은 리눅스라 못 했다.
- [ ] 설치본 배포 방법(GitHub Release에 exe 올리기 등) — 30MB 넘어 대화로는 못 보낸다.
- [ ] (선택) 더 긴 리플레이 교체+재굽기, 회원 2명 규칙.

## 6. 명령
```
npm install && npm run typecheck
UPLOADER_API_BASE=https://stargayte-api.up.railway.app npm run build
node scripts/dry-run.mjs ../stargayte/temp/*.rep          # 가짜 서버로 파이프라인만
npm run dist                                              # 윈도우(또는 wine32+64 리눅스)에서 설치본
```
