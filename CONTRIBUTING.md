# 개발 안내

## 처음 시작하기

```sh
nvm install
nvm use
npm ci
npm run check
npm run web
```

Node 24.3 이상, 25 미만을 사용합니다. `npm ci`는 잠금 파일의 의존성을 그대로 설치합니다. 웹 미리보기는 Android SDK나 macOS 패키징 도구 없이 UI를 확인하는 가장 빠른 방법입니다. SQLite·LAN 동기화는 설치 앱에서 확인하세요. 기기 실행과 빌드 방법은 [README](README.md#개발-환경-및-실행)를 참고하세요.

## 코드를 읽는 순서

1. `src/domain/data.ts`와 테스트: 식단·운동·체중 데이터, 날짜 계산, 백업 검증.
2. `src/domain/sync-model.ts`와 테스트: 기록별 버전과 삭제 이력, 충돌 병합.
3. `src/application/record-repository.ts`와 테스트: 화면이 기록을 읽고 저장하는 인터페이스. `local-engine.ts`는 저장·이전·복원·백업을 순서대로 실행합니다.
4. `src/infrastructure/native-storage/`와 `desktop/storage.ts`: 공통 엔진을 Android와 Mac의 SQLite에 연결합니다. Android 구현은 데이터베이스, 백업 파일, 엔진 어댑터로 나뉩니다.
5. `src/infrastructure/wire.ts`, `services.ts`, `desktop/lan-server.ts`: 암호화, Android 클라이언트, Mac 서버.
6. `App.tsx` → `src/presentation/tracker/TrackerScreen.tsx`: 앱 진입점과 기록 화면. `src/presentation/tracker/`에는 기록 편집·날짜 선택·체중 표시 컴포넌트와 저장 상태를 관리하는 `useTrackerRecords.ts`가 있습니다. `src/presentation/sync/SyncPanel.tsx`는 백업·동기화 화면이며, `desktop/main.ts`와 `desktop/preload.cjs`는 Electron 창과 IPC 연결을 담당합니다.

`src/`는 의존성 방향에 따라 네 계층으로 나뉩니다. `domain`은 플랫폼을 모르고, `application`은 `domain`만 사용합니다. `infrastructure`는 애플리케이션 포트를 Android·웹·Electron 기능에 연결하고, `presentation`은 화면과 사용자 상호작용을 담당합니다. 새 코드는 가능한 한 `presentation → application/domain`, `infrastructure → application/domain` 방향을 유지하세요.

`*.web.ts`와 `*.web.tsx`는 웹/Electron 렌더러용 구현입니다. Expo/Metro가 플랫폼에 맞는 파일을 선택하므로 공통 화면에서는 확장자 없는 모듈 경로로 import합니다. 웹 구현은 `window.exerciseDesktop`이 있으면 Electron 브리지를, 없으면 브라우저 기능을 사용합니다. 공통 데이터·병합 로직에는 플랫폼 API를 넣지 마세요.

## 자동 검사 기준

| 도구             | 담당하는 기준                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oxfmt            | 들여쓰기 2칸, 줄 너비 100, 작은따옴표(JSX는 큰따옴표), 세미콜론, LF, 여러 줄의 후행 쉼표, import 정렬                                                 |
| Oxlint           | 기본 correctness 규칙, 명시적 중괄호, 엄격한 동등 비교, `const` 사용, 중첩 삼항식 금지, 미사용 코드, 명시적 `any` 금지, type import, React Hooks 규칙 |
| Vitest 린트 규칙 | `.only`·`.skip` 테스트, 조건부 assertion, 잘못된 `expect` 사용 방지                                                                                   |
| TypeScript       | 앱과 Electron 각각의 strict 타입 검사                                                                                                                 |
| Vitest           | 데이터 검증, 저장·복원, 병합, 실제 로컬 HTTP 통신의 동작 검증                                                                                         |

포맷 기준은 `.oxfmtrc.json`, 린트 기준은 `.oxlintrc.json`에서 관리합니다. import는 Node 내장 모듈 → 외부 패키지 → 프로젝트 모듈 순으로 정렬합니다. 실행 순서에 영향을 줄 수 있는 side-effect import는 자동 정렬하지 않습니다. 빌드 결과물과 생성된 네이티브 프로젝트는 검사에서 제외하고, `package-lock.json`은 npm이 관리합니다.

린트는 경고도 실패 처리하고 불필요한 disable 주석도 검출합니다. 사용하지 않을 콜백 인자는 `_event`처럼 `_`로 시작하는 이름을 사용하거나 생략하세요. 진단 로그는 `console.warn`·`console.error`를 사용합니다. 규칙 예외가 꼭 필요하다면 적용 범위를 한 줄로 제한하고 이유를 설명하세요.

Oxfmt의 포맷팅과 Oxlint의 자동 수정은 서로 다른 작업입니다. 현재 Oxlint는 구문 기반 검사이며, Promise 처리 누락 같은 타입 정보 기반 린트는 활성화하지 않았습니다. TypeScript 검사도 Promise의 오류 처리를 보장하지 않으므로 비동기 작업은 `await` 또는 오류 처리까지 포함한 흐름을 검토하세요.

## 변경할 때

```sh
npm run lint:fix
npm run format
npm run check
```

`check`는 포맷 검사 → 린트 → 타입 검사 → 테스트 순서로 실행하며 파일을 수정하지 않습니다. GitHub Actions도 push/PR에서 같은 명령을 사용합니다. LAN 테스트는 `127.0.0.1` 임시 포트를 열기 때문에 포트 바인딩을 허용하는 환경에서 실행해야 합니다.

VS Code에서는 추천 Oxc 확장을 설치하면 저장할 때 포맷팅됩니다. CLI와 에디터가 같은 설정 파일을 사용합니다.

### Codex의 수정 후 검사

Codex는 파일을 수정한 작업을 마치기 전에 `npm run lint:fix`와 `npm run format`을 실행하고, 최종 포맷·린트 결과를 확인합니다. 상세 완료 조건은 [AGENTS.md](AGENTS.md#최종-응답-전-필수-완료-조건)에 있습니다.

`.codex/hooks.json`의 `Stop` hook은 턴 종료 시 `npm run format:check`와 `npm run lint`를 자동 실행합니다. 첫 검사가 실패해도 두 번째 검사를 실행하고, 두 결과를 함께 Codex에 전달합니다. 파일 자동 수정은 하지 않습니다. 실패하면 한 번의 자동 수정 요청을 보내며, 이어지는 턴에서도 검사합니다. 계속 실패하면 무한 반복 대신 남은 실패를 보고하도록 합니다.

새 hook은 Codex에서 검토·신뢰해야 실행됩니다. 프로젝트 루트에서 Codex CLI를 열고 `/hooks`에서 이 프로젝트의 `Stop` hook을 확인·신뢰하세요. 설정이 보이지 않으면 프로젝트를 신뢰한 상태로 세션을 다시 여세요. 정의를 변경했을 때도 다시 검토해야 합니다. 이는 [Codex 공식 hook 신뢰 정책](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks)에 따른 절차입니다.

Hook은 실행 중인 환경의 Node 24를 사용하며, 버전이 맞지 않고 nvm이 설치되어 있으면 `.nvmrc`로 전환합니다. Node나 npm 의존성이 준비되지 않았다면 실행 실패를 알립니다. 읽기 전용 대화에서도 종료 검사가 실행될 수 있으며, 이때도 파일은 수정하지 않습니다.

### 변경 검토 기준

- 저장·동기화 규칙을 바꾸면 실패·재시작·중복 요청 등 해당 동작의 회귀 테스트를 함께 변경하세요.
- 외부 JSON과 IPC 인자는 `unknown`으로 받고 실제 값을 검증한 뒤 사용하세요. 타입 단언만으로 입력 검증을 대체하지 마세요.
- 중첩된 조건식은 의미 있는 이름의 값이나 함수로 나누세요. UI 문구와 검증 범위가 같은 조건에 의존하면 한 곳에서 관리하세요.
- 함수·파일이 여러 책임을 갖기 시작하면 화면, 데이터 규칙, 플랫폼 입출력의 경계를 기준으로 분리하세요. 린트 통과만으로 구조가 읽기 쉬워지는 것은 아닙니다.
- 플랫폼 입출력이나 빌드 설정을 바꾸면 해당 플랫폼 빌드도 확인하세요. 웹은 `npm run build`, Android JS는 `npm run build:android`, Electron 번들은 `npm run desktop:compile`입니다. 실제 APK·Mac 앱 검증은 별도입니다.
- 포맷팅 변경과 기능 변경은 가능한 한 별도 커밋으로 나누어 리뷰하기 쉽게 유지하세요.
