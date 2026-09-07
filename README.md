# Stargayte Uploader — 스타게이트 등록기 (Windows·macOS 자동 업로더)

스타크래프트 리마스터가 게임이 끝날 때마다 AutoSave 폴더(윈도우 `문서\StarCraft\Maps\Replays\AutoSave`,
맥 `~/Library/Application Support/Blizzard/StarCraft/Maps/Replays/AutoSave`)에 남기는 리플레이를 감지해, 홈페이지와 **같은 절차로** 경기결과에 자동 등록하는 트레이 앱이다.
설정 화면은 없다.

## 구조 — 등록 절차는 사이트가 갖는다
등록기는 파서·회원 매칭·규칙·서버 계약을 제 것으로 갖지 않는다. 스타게이트 홈페이지의
헤드리스 진입점 `/uploader.html`(stargayte 저장소 `src/uploader/`)을 **숨은 BrowserWindow**로
띄워 두고, 새 리플레이 파일을 그 페이지에 넘겨 결과만 받는다(`src/page.ts`). 그래서
- 사이트가 배포되면 등록기는 다음 처리부터 새 절차·새 규칙을 그대로 쓴다(재설치 불필요).
- 로그인도 그 페이지의 것이다 — 세션(리프레시 토큰)은 숨은 창의 localStorage에 남고,
  등록기가 날마다 돌기 때문에 사이트와 같은 회전으로 이어진다. 세션이 없거나 죽었을 때만
  그 창을 보여 로그인 칸을 채우게 한다.
- CORS는 걸리지 않는다: 그 페이지는 사이트 자신의 출처에서 API를 부른다.
- 페이지 ↔ 메인 사이의 다리(`src/preload.ts`)는 사이트의 `src/uploader/bridge.d.ts`와 짝이다.

## 동작
1. 설치하면 바로 뜨고, 이후 윈도우·맥에 로그인할 때마다 자동으로 켜진다(트레이/메뉴 막대 아이콘, 맥은 독에 안 나온다).
2. 처음 한 번 홈페이지 아이디·비밀번호로 로그인한다(숨은 창이 그때만 보인다).
3. 처음 설치하면 2026-07-01(KST) 이후의 리플레이를 한 번 훑어 오래된 것부터 차례로 올린다
   (시작할 때 몇 건인지 알림으로 알린다). 그 뒤로는 새 `.rep`가 생기면 다 써질 때까지
   3초 기다렸다가 처리한다. 밀린 파일을 다 올리고 나면 화면 오른쪽 아래에 "리플레이 N건을
   스타게이트에 등록했습니다." 오버레이 토스트가 한 번 뜬다(건마다 따로 뜨지 않는다).
4. 처리 = 파일을 사이트 창에 넘김 → 사이트가 검토 화면과 같은 절차(파싱 → 회원 매칭 →
   알려진 이름 분류 → 규칙 → 중복이면 머지, 아니면 등록)를 돌리고 결과를 돌려줌.

## 고정 규칙 (사이트의 `src/uploader/register.ts` — 등록기에는 없다)
| 상황 | 처리 |
|---|---|
| 승자를 못 가린 경기 | 결과 모름(`unknown`)으로 등록 |
| 회원과 안 이어지는 참가자 | 비회원 슬롯으로 등록 |
| 이미 등록된 경기(시작 시각 일치) | 기존 경기에 머지(더 긴 저장본이면 파일 교체+재굽기) |
| 컴퓨터(AI)가 낀 경기 | 등록 |
| **회원이 2명 미만인 경기** | 건너뜀 — 양 팀 합쳐 서로 다른 회원 2명(한 팀에 한 명씩일 필요는 없다) |
| 유즈맵 | 건너뜀(서버가 거절하는 갈래) |
| 팀을 두 편으로 못 나눔 · 관전자 추정 · 2분 미만 | 건너뜀 |
| 서버 오류·네트워크 끊김·사이트 창 안 뜸 | 5분마다 12번까지 다시 시도(`src/config.ts`) |

건너뛴 것·실패한 것은 트레이 메뉴 "최근"과 로그(윈도우 `%APPDATA%\Stargayte Uploader\uploader.log`,
맥 `~/Library/Application Support/Stargayte Uploader/uploader.log`)에 남는다. 처리 장부 `processed.json`도 같은 폴더다
(Electron이 productName으로 데이터 폴더를 잡는다).
윈도우 설치 폴더는 `%LOCALAPPDATA%\Programs\stargayte-uploader`(원클릭 설치는 package.json의 name을 쓴다).

## 개발
```
npm install
npm run typecheck
npm run build                                         # dist/main.cjs, dist/preload.cjs (사이트: https://stargayte.vercel.app)
UPLOADER_SITE_BASE=http://localhost:5173 npm start     # 로컬 사이트(vite dev)에 붙여 띄워 보기
```
등록 절차만 검증하려면 등록기 없이 브라우저에서 https://stargayte.vercel.app/uploader.html 을 열어 파일을 고르면 된다.

## 설치본 배포 — GitHub Release
`v*` 태그를 푸시하거나 Actions 탭에서 "Run workflow"를 누르면(`.github/workflows/release.yml`) 윈도우
러너가 `stargayte-uploader-setup-<버전>.exe`(NSIS 원클릭)를, 맥 러너가 `stargayte-uploader-<버전>-mac.dmg`
(유니버설)를 만들어 `v<package.json 버전>` Release에 함께 붙인다.
맥은 **서명·공증을 안 한다**(결정) — afterPack에서 ad-hoc 서명만 입혀 Apple Silicon의 "손상됨" 거절을
피하고, 사용자는 처음 한 번 시스템 설정 → 개인정보 보호 및 보안 → "그래도 열기"를 누른다.
```
npm version 0.2.1 --no-git-tag-version   # package.json 버전 올리고 커밋한 뒤
git tag v0.2.1 && git push origin v0.2.1
```
손으로 만들려면 윈도우에서 `npm run dist`, 맥에서 `npm run dist:mac`(`release/` 아래). 윈도우 설치본도
서명은 안 한다(SmartScreen 경고가 뜨면 "추가 정보 → 실행").
