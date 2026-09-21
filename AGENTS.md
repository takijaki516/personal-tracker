# 프로젝트 작업 지침

이 지침은 저장소 전체에 적용합니다. 코드는 다른 개발자가 쉽게 읽고 수정할 수 있도록 유지하세요. 프로젝트 구조와 온보딩 절차는 [CONTRIBUTING.md](CONTRIBUTING.md), 실행·빌드·기능 설명은 [README.md](README.md)를 참고하세요.

## 프로젝트 구조 빠른 참조

식단·체중·운동을 기록하는 로컬 우선 앱입니다. Android는 Expo/React Native, macOS는 공통 화면을 React Native Web으로 렌더링하는 Electron 앱입니다. 각 기기의 SQLite에 저장하며, 클라우드·로그인 없이 같은 Wi-Fi에서 동기화합니다. 일반 브라우저는 localStorage 기반 미리보기로, SQLite·자동 백업·LAN 동기화를 제공하지 않습니다.

| 작업 영역         | 확인할 파일과 역할                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 앱 시작           | `index.ts`가 Expo 루트를 등록하고, `App.tsx`가 SafeAreaProvider와 `src/presentation/tracker/TrackerScreen.tsx`를 연결                                                                              |
| 화면 조합         | `src/presentation/tracker/TrackerScreen.tsx`가 날짜·탭·모달 상태, 삭제 확인, 수동 백업·복원 흐름과 하위 화면 조합을 담당                                                                           |
| 기록 상태·저장    | `src/presentation/tracker/useTrackerRecords.ts`: 로딩·저장·복원·갱신, 저장 오류와 동시 작업 보호                                                                                                   |
| 데이터 규칙       | `src/domain/data.ts` 타입·날짜·백업 검증, `src/domain/sync-model.ts` 기록별 논리 버전·삭제 표시·병합                                                                                               |
| 애플리케이션 흐름 | `src/application/record-repository.ts` 읽기·쓰기 유스케이스, `src/application/local-engine.ts` 저장·이전·복원·백업 직렬 실행                                                                       |
| 플랫폼 입출력     | `src/infrastructure/platform.ts` Android 저장·파일 선택·공유, `platform.web.ts` Electron 브리지 또는 브라우저 기능 선택                                                                            |
| SQLite 구현       | `src/infrastructure/native-storage/` Expo SQLite·백업·기존 AsyncStorage 이전, `desktop/storage.ts` Node SQLite. 양쪽 모두 공통 저장 엔진에 어댑터를 제공                                           |
| 연결·자동 백업 UI | `src/presentation/sync/SyncPanel.tsx` 기기 연결·백업 목록·주기적 유지 작업·동기화 후 화면 갱신, `PairScanner.tsx` Android QR 스캔                                                                  |
| 통신·백그라운드   | `src/infrastructure/services.ts` Android LAN 클라이언트, `desktop/lan-server.ts` Mac 서버, `src/infrastructure/wire.ts` 암호화·통신 검증, `background.ts` 백그라운드 작업                          |
| Electron 경계     | `desktop/main.ts` 창·IPC·서버 수명주기, `desktop/preload.cjs` API 노출, `src/infrastructure/desktop-bridge.ts` 브리지 타입, `services.web.ts` 렌더러 서비스                                        |
| 설정·빌드         | `app.json` Expo, `plugins/with-local-network.cjs` Android 네트워크, `scripts/build-desktop.mjs` Electron 번들, `scripts/after-pack.cjs` Mac 패키징 후처리, `electron-builder.yml` 패키징·권한 설정 |
| 타입·테스트       | `tsconfig.json` 앱, `tsconfig.desktop.json` Electron·공통 모듈. `src/*.test.ts` 데이터·저장·병합·통신 검증, `desktop/*.test.ts` 실제 SQLite·로컬 HTTP 테스트                                       |

`src/presentation/tracker/`에서 UI를 수정할 때는 아래 파일부터 확인합니다. 이 목록의 경로는 해당 폴더 기준입니다.

- `DailySummary.tsx` 일일 요약, `DailyRecords.tsx` 식단·운동 목록, `WeightPanel.tsx` 체중 그래프·이력.
- `RecordEditor.tsx` 입력 폼·입력값 검증·저장 요청. 검증 범위 변경 시 `src/domain/data.ts`의 백업 검증도 함께 확인합니다.
- `DateNavigation.tsx` 날짜 이동 및 `DatePicker.tsx` 연결, `ConfirmationDialog.tsx` 삭제·복원 확인.
- `BackupPanel.tsx` 수동 백업·복원 버튼, `TrackerSidebar.tsx` 사이드바, `Button.tsx`·`Field.tsx` 공통 컨트롤, `styles.ts` 기록 화면 스타일. `src/presentation/sync/SyncPanel.tsx`는 자체 스타일을 관리합니다.

핵심 실행 경로와 플랫폼 경계:

- 일반 저장: `useTrackerRecords` → `record-repository` → `platform` → 공통 엔진 → SQLite. Mac은 `platform.web` → `window.exerciseDesktop` → preload/IPC → 엔진을 거치며, 일반 브라우저는 localStorage에 저장합니다.
- 복원: `TrackerScreen`에서 파일 선택·검증·확인 → `useTrackerRecords.persist` → `services.restoreStored`. 설치 앱의 엔진은 보호 백업 후 기록을 교체합니다.
- 동기화: Android `services` ↔ Mac `lan-server`가 `wire`로 암호화된 문서를 교환하고 각 엔진이 병합합니다. `SyncPanel`의 `onChange`는 `useTrackerRecords.refresh`로 연결됩니다.
- `*.web.ts`·`*.web.tsx`는 웹/Electron 렌더러 구현입니다. 공통 화면은 확장자 없는 import를 유지합니다. `src/presentation/sync/PairScanner.web.tsx`는 화면을 표시하지 않고, `src/infrastructure/background.web.ts`는 네이티브 백그라운드 작업을 등록하지 않습니다.
- 빌드 결과: `dist/` 웹 자산, `desktop-build/` Electron 실행 코드, `release/` Mac 앱·DMG. 수정은 원본 소스에서 합니다.

## 환경과 도구

- Node는 `.nvmrc`와 `package.json`의 범위에 맞춰 24.3 이상, 25 미만을 사용합니다.
- 의존성은 `npm ci`로 설치하고 `package-lock.json`을 유지합니다.
- 포맷팅은 Oxfmt, 린트는 Oxlint, 타입 검사는 TypeScript, 테스트는 Vitest가 담당합니다.
- 도구 버전은 `package.json`과 잠금 파일을 기준으로 사용합니다. 포맷팅·린트 규칙을 바꾸기 위해 Prettier나 ESLint를 중복 도입하지 마세요.
- 포맷과 린트의 실제 기준은 각각 `.oxfmtrc.json`, `.oxlintrc.json`입니다. 규칙을 변경하면 개발 안내도 함께 갱신하세요.

## Oxfmt 포맷 기준

- 공백 2칸, 줄 너비 100, LF 줄바꿈을 사용합니다.
- JavaScript/TypeScript 문자열은 작은따옴표, JSX 속성은 큰따옴표를 사용합니다.
- 세미콜론과 여러 줄 구조의 후행 쉼표를 사용합니다.
- import는 Node 내장 모듈 → 외부 패키지 → 프로젝트 모듈 순으로 자동 정렬합니다.
- side-effect import의 순서는 자동 정렬하지 않습니다. 모듈 초기화 순서에 영향을 주는 변경은 별도로 검토하세요.
- `package.json` 키 순서는 유지합니다. `package-lock.json`은 npm이 관리하며 포맷팅에서 제외합니다.
- 포맷을 수동으로 맞추기보다 `npm run format`을 사용하세요.

## Oxlint 코드 기준

- `correctness` 규칙과 TypeScript·React·Vitest·Unicorn·Oxc 플러그인을 사용합니다.
- 조건문과 반복문은 한 줄이어도 중괄호를 사용합니다.
- 동등 비교는 `===`·`!==`를 사용하고, 재할당하지 않는 변수는 `const`를 사용합니다. `var`는 사용하지 않습니다.
- 중첩 삼항식은 의미 있는 이름의 값, 설정 객체, 함수 또는 명시적인 분기로 바꿉니다.
- 명시적 `any`를 사용하지 않습니다. 외부 JSON·네트워크 응답·Electron IPC 인자는 `unknown`으로 받고 실제 값을 검증한 뒤 사용합니다. 타입 단언으로 검증을 대체하지 마세요.
- 타입 전용 의존성은 `import type` 또는 inline `type` import로 표시합니다.
- 미사용 변수와 import를 제거합니다. 서명상 필요한 미사용 인자·catch 변수는 `_` 접두사를 사용합니다.
- React Hooks 호출 규칙과 의존성 검사를 준수합니다. 렌더링 중 ref 값을 변경하지 않고 필요한 갱신은 effect에서 처리합니다.
- `debugger`와 일반 `console.log`를 남기지 않습니다. 필요한 진단 로그는 `console.warn`·`console.error`를 사용합니다.
- `*.test.ts`·`*.test.tsx`에는 `.only`·`.skip` 테스트, 조건부 assertion, 잘못된 `expect` 사용을 남기지 않습니다.
- 린트 경고도 실패로 처리합니다. 불필요한 disable 주석은 제거하고, 불가피한 예외는 최소 범위에 한정하여 이유를 설명합니다.
- 현재 타입 정보 기반 린트는 활성화하지 않았습니다. 비동기 작업의 오류 처리는 `await`·`catch` 등 실제 흐름을 검토하세요. `void` 표기나 타입 검사 통과만으로 오류 처리가 보장되지는 않습니다.

## 가독성과 구조

- 화면, 데이터 규칙, 플랫폼 입출력의 책임을 구분합니다. 공통 데이터·병합 로직에는 플랫폼 API를 넣지 마세요.
- UI 문구와 검증 범위가 같은 조건에 의존하면 한 곳에서 관리합니다. 복잡한 조건은 이름으로 의도를 드러내세요.
- 기능 변경과 대규모 포맷팅은 가능한 한 분리하여 리뷰하기 쉽게 유지합니다. 작업 전부터 있던 변경을 덮어쓰지 마세요.

## 검증 절차

### 최종 응답 전 필수 완료 조건

- 파일을 수정한 작업은 최종 응답 전에 반드시 `npm run lint:fix`와 `npm run format`을 실행합니다. 자동 수정 결과도 검토하세요.
- 두 명령 중 하나가 실패해도 다른 명령은 실행하고, 남은 오류를 해결합니다.
- 마지막 수정 이후 `npm run format:check`와 `npm run lint`가 모두 통과해야 검증 완료로 보고합니다. 검사 이후 파일을 다시 수정했다면 관련 검사를 재실행합니다.
- 문서만 변경해도 위 포맷·린트 절차는 적용합니다. 읽기 전용 질문·논의에서는 자동 수정 명령을 실행하지 않습니다.
- 실행 환경이나 요청 범위 밖의 문제로 검사를 통과하지 못하면 실패한 명령과 원인을 명시합니다. 검사를 생략하거나 실패한 상태를 통과로 보고하지 마세요.

코드 변경 후 다음 순서로 검증합니다.

```sh
npm run lint:fix
npm run format
npm run check
```

- `lint:fix`는 자동 수정 가능한 린트 문제를 고치며, 남은 오류는 직접 해결합니다.
- `format`은 파일을 수정합니다. 수정 없이 확인하려면 `npm run format:check`를 사용합니다.
- `check`는 포맷 검사 → 린트 → 앱·Electron 타입 검사 → 전체 테스트를 실행하며 파일을 수정하지 않습니다.
- 문서만 변경한 경우에도 포맷·린트는 실행하되, 타입 검사와 애플리케이션 테스트를 불필요하게 반복하지 않습니다.
- 저장·동기화·입력 검증 동작이 바뀌면 실패·재시작·중복 요청·잘못된 입력 등 관련 회귀 테스트를 추가하거나 갱신합니다.
- LAN 테스트는 `127.0.0.1`에 임시 서버를 열므로 로컬 포트 바인딩이 가능한 환경에서 실행합니다.
- 플랫폼 입출력이나 빌드 설정을 바꾸면 해당 빌드도 확인합니다: 웹 `npm run build`, Android JS/자산 `npm run build:android`, Electron 번들 `npm run desktop:compile`. 실제 APK·Mac 설치 앱 검증과 구분하세요.
- 검증 결과를 보고할 때 실제로 실행한 검사와 실행하지 못한 검사를 구분합니다.

## CI와 에디터

- Codex의 `.codex/hooks.json`에는 `Stop` hook이 있습니다. `scripts/codex-stop-check.sh`가 Node 환경을 준비하고 `scripts/codex-stop-check.mjs`가 프로젝트 루트에서 `format:check`와 `lint`를 모두 실행합니다. Hook은 파일을 수정하지 않습니다.
- 첫 검사 실패 시 hook이 Codex에 수정을 요청합니다. 재시도 턴에서도 두 검사를 실행하며, 계속 실패하면 무한 반복 대신 진단을 전달합니다. 실패를 해결하지 못했다면 사용자에게 남은 문제를 보고합니다.
- 새 hook 또는 변경된 hook은 Codex에서 검토·신뢰해야 실행됩니다. CLI의 `/hooks`에서 이 프로젝트의 Stop hook을 확인합니다. Hook은 지침에 따른 직접 검증을 대체하지 않습니다.
- `.github/workflows/quality.yml`은 push와 pull request에서 `.nvmrc`의 Node 버전으로 `npm ci`와 `npm run check`를 실행합니다.
- VS Code에서는 `.vscode/extensions.json`의 추천 Oxc 확장을 사용합니다. JavaScript/TypeScript·JSON·YAML·Markdown 저장 시 자동 포맷팅하도록 설정되어 있습니다.
- `node_modules/`, `.expo/`, `dist/`, `desktop-build/`, `release/`, 생성된 `android/`·`ios/`, `coverage/`, `expo-env.d.ts`는 린트·포맷 검사에서 제외합니다. 생성물을 직접 수정하여 검사를 통과시키지 마세요.
