# 스타게이트 등록기 (Windows 자동 업로더)

스타크래프트 리마스터가 게임이 끝날 때마다 `문서\StarCraft\Maps\Replays\AutoSave`에 남기는
리플레이를 감지해, 홈페이지와 같은 절차로 경기결과에 자동 등록하는 트레이 앱이다.
설정 화면은 없다 — 아래 규칙이 고정값이다.

## 동작
1. 설치하면 바로 뜨고, 이후 윈도우를 켤 때마다 자동으로 켜진다(트레이 아이콘).
2. 처음 한 번 홈페이지 아이디·비밀번호로 로그인한다. 서버가 앱용 장기 토큰(365일)을 주고
   OS 자격 저장소(DPAPI)로 암호화해 둔다. 토큰이 죽으면(만료·차단) 로그인 창이 다시 뜬다.
3. 처음 설치하면 2026-07-01(KST) 이후의 리플레이를 한 번 훑어 오래된 것부터 차례로 올린다
   (시작할 때 몇 건인지 토스트·알림으로 알린다). 그 뒤로는 새 `.rep`가 생기면 다 써질 때까지
   3초 기다렸다가 처리한다. 올라갈 때마다 화면 오른쪽 아래에 "리플레이 N건이 스타게이트에
   업로드되었습니다." 오버레이 토스트가 뜬다(연달아 올라가면 몇 건씩 모아서).
4. 처리 = 파싱(screp-js, 홈페이지와 같은 `src/utils/replayParser.ts`) → 회원 매칭
   (`replayMemberMatch.ts`) → 예전에 컴퓨터/비회원으로 지정된 이름 자동 분류 →
   같은 게임 시작 시각의 경기가 이미 있으면 리플레이 정보만 머지(`merge-replay`), 없으면
   등록(`POST /api/game-results`). 등록되면 윈도우 알림이 뜬다.

## 고정 규칙 (`src/config.ts`)
| 상황 | 처리 |
|---|---|
| 승자를 못 가린 경기 | 승패모름(`not_held`)으로 등록 |
| 회원과 안 이어지는 참가자 | 비회원 슬롯으로 등록 |
| 이미 등록된 경기(시작 시각 일치) | 기존 경기에 지표·맵·시간 머지 |
| 컴퓨터(AI)가 낀 경기 | 등록(사이트 검토 화면 기본값과 같음) |
| 팀을 두 편으로 못 나눔(UMS 등) | 건너뜀 |
| 관전자로 추정해 뺀 사람이 있음 | 건너뜀 |
| 2분 미만 경기 | 건너뜀 |
| 한쪽 팀이 비었거나 종족을 못 읽음 | 건너뜀 |
| 서버 오류·네트워크 끊김 | 5분마다 12번까지 다시 시도 |

건너뛴 것·실패한 것은 트레이 메뉴 "최근"과 로그(`%APPDATA%\stargayte-uploader\uploader.log`)에 남는다.
처리 장부는 같은 폴더의 `processed.json`.

## 개발
파서·회원 매칭·슬롯 규약은 홈페이지 저장소(stargayte)의 소스를 `web/src/`에 그대로 베껴 온 것이다
(`web/SOURCE`에 어느 커밋인지 적힌다). 홈페이지 쪽이 바뀌면 `npm run sync-web`(옆에 `../stargayte`
체크아웃이 있어야 한다)로 다시 맞춘다 — 손으로 고치지 않는다.

```
npm install
npm run typecheck
UPLOADER_API_BASE=https://<api 서버> npm run build     # dist/main.cjs, dist/preload.cjs
npm start                                             # 로컬에서 띄워 보기
node scripts/dry-run.mjs ../temp/*.rep                # Electron 없이 파이프라인만 (가짜 서버)
node scripts/dry-run.mjs --live https://<api> --token <앱토큰> x.rep   # 조회는 진짜, 등록만 가짜
```

## 설치본 만들기 (Windows에서)
```
set UPLOADER_API_BASE=https://<api 서버>
npm run dist            # release/stargayte-uploader-setup-<버전>.exe (NSIS 원클릭)
```
리눅스/맥에서 만들려면 wine(32·64비트 둘 다)이 있어야 한다(rcedit·NSIS 언인스톨러 생성).
서버 주소는 빌드 때 번들에 박힌다 — 빼먹으면 `http://localhost:8000`으로 박히니 꼭 준다.
서명은 안 한다(SmartScreen 경고가 뜨면 "추가 정보 → 실행").

## 서버 쪽
`stargayte-api`의 `POST /api/auth/app-login {id, password, device}` → `{appToken, expiresAt, user}`.
`APP_TOKEN_EXPIRE_DAYS`(기본 365)로 만료를 정한다. 그 밖의 호출은 홈페이지와 같다.
