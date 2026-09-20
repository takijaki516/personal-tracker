# 운동관리 — Android + macOS

혼자 사용하는 식단·체중·운동 기록 앱입니다. Android와 Mac에 각각 SQLite로 저장하고, 같은 Wi-Fi에서 두 앱이 암호화된 JSON 데이터를 직접 주고받습니다. Supabase, 클라우드 계정, 로그인은 사용하지 않습니다.

- Android: Expo SDK 57 / React Native 0.86
- macOS: 기존 React Native Web 화면을 사용하는 Electron 설치 앱
- 브라우저: 개발 미리보기용. 기존 localStorage를 유지하며 SQLite·자동 백업·LAN 동기화는 제공하지 않습니다.
- 공통: React 19 / TypeScript strict / Oxlint / Oxfmt / Vitest

처음 기여한다면 [개발 안내](CONTRIBUTING.md)에서 코드 읽는 순서, 플랫폼별 역할, 코드 품질 기준을 확인하세요.

## 개발 환경 및 실행

Node 24.3 이상, 25 미만이 필요합니다.

```sh
nvm install
nvm use
npm ci

npm run mac             # 웹 자산 빌드 후 Mac 앱 실행
npm run build:mac       # release/에 Mac .app 및 .dmg 생성
npm run android:native  # Android 네이티브 개발 앱 빌드·실행
npm run build:apk       # Android release 변형 빌드·실행
```

Android 네이티브 빌드에는 Android Studio/SDK, JDK, 연결 기기 또는 에뮬레이터가 필요합니다. `build:apk`의 APK는 생성된 android/app/build/outputs/apk/release/에서 확인합니다. Expo 기본 release 서명은 개발 키일 수 있으므로 개인 설치용으로 사용하고, 업데이트 시 같은 키를 유지하세요. 스토어 배포 서명은 구성하지 않았습니다.

macOS 빌드는 현재 Mac의 CPU 아키텍처를 대상으로 합니다. 개인용 로컬(ad-hoc) 서명으로 패키징합니다. Apple Developer 인증서와 공증은 사용하지 않습니다. 외부 배포 시 서명·공증을 별도로 설정해야 합니다.

### 실시간 개발

터미널 1:

```sh
npm start -- --port 8081
```

터미널 2:

```sh
npm run mac:dev
```

Android 네이티브 개발 앱을 먼저 빌드한 뒤 같은 개발 서버에 연결합니다. 화면 코드 저장 시 Fast Refresh가 적용됩니다. Mac의 SQLite와 LAN 서버를 수정하면 Mac 앱을 재시작해야 합니다. 웹만 확인하려면 `npm run web`을 사용합니다.

Expo Go에서는 사용할 수 있는 기능만 미리볼 수 있습니다. 자동 백그라운드 작업과 Android 네트워크 설정을 포함한 전체 검증에는 `android:native`로 만든 앱을 사용하세요.

## 두 기기 연결

1. Mac과 Android를 같은 집 Wi-Fi에 연결하고 두 앱을 엽니다.
2. Mac 화면 아래 **백업 및 기기 동기화 → 기기 연결**을 엽니다.
3. Android의 **기기 연결 → Mac QR 코드 스캔**으로 스캔합니다. 연결 코드를 직접 붙여 넣어도 됩니다.
4. 최초 연결 시 바로 동기화합니다. 이후 앱이 활성 상태이면 약 25초 간격으로 확인합니다.
5. 어느 앱에서든 **지금 동기화**를 누르면 즉시 동기화를 요청합니다. Mac 버튼은 실행 중인 Android 앱을 깨워 요청하고, 응답이 없으면 약 20초 뒤 안내합니다.

Mac은 TCP 47831 포트에서 수신합니다. macOS의 로컬 네트워크 권한과 방화벽 수신 연결을 허용해야 합니다. 게스트 Wi-Fi의 기기 격리, VPN, 회사 네트워크 정책은 연결을 막을 수 있습니다. Mac의 IP 주소가 바뀌면 새 QR 코드를 다시 스캔하세요. 자동 기기 검색(mDNS)은 아직 사용하지 않습니다.

연결 코드는 내 기록에 접근하는 비밀 키를 포함합니다. Android에서는 SecureStore, Mac에서는 OS 키 저장소로 암호화한 파일에 보관합니다. 전송 본문은 NaCl secretbox로 암호화·인증합니다. 서버는 브라우저 Origin 요청, 잘못된 키/데이터, 재전송된 요청, 5분 이상 오래된 요청을 거절합니다. 두 기기의 날짜·시간은 자동 설정을 사용하세요. 키가 노출됐거나 휴대폰을 바꾸면 Mac에서 **연결 키 재발급** 후 다시 연결합니다.

## 저장과 동기화 규칙

- 앱의 기본 데이터는 각 기기의 `exercise.sqlite`에 저장합니다. 기록별로 entries 테이블에 저장하며, 수정·삭제 이력과 기기 정보를 함께 보존합니다.
- Mac 데이터 폴더: `~/Library/Application Support/ExerciseTracker/`.
- Android 데이터: 앱 내부 SQLite 디렉터리. 연결 정보와 기록은 분리합니다.
- 서로 다른 식단·운동 항목과 날짜별 체중은 합칩니다. 같은 날 입력한 서로 다른 항목도 유지합니다.
- 삭제는 삭제 이력을 남겨 오래 오프라인이던 기기에서 기록이 부활하지 않도록 합니다.
- 같은 항목을 양쪽에서 동시에 수정하면 더 큰 논리 버전이 우선합니다. 같으면 기기 ID의 고정 순서로 결정합니다. 실제 시각상 마지막 편집을 항상 의미하지 않으며, 충돌 선택 UI는 없습니다.
- Mac이 꺼져 있거나 절전 상태이면 각자 SQLite에 계속 기록하고 다음 연결에 합칩니다.
- 첫 연결도 기존 양쪽 기록을 합칩니다. 이름이 같아도 서로 별도로 입력한 항목은 서로 다른 기록입니다.
- 복원은 현재 기록 전체를 교체하는 로컬 편집으로 처리하며, 이 변경도 이후 동기화됩니다.

## 자동 JSON 백업

SQLite가 평소 사용하는 저장소이고 JSON은 복구·이동용 복사본입니다. 동기화는 백업 파일 생성 시점을 기다리지 않고 최신 기록과 변경 이력을 직접 교환합니다.

- 날짜별 파일: `운동관리-YYYY-MM-DD.json`.
- 그날 처음 백업을 실행할 때의 전체 기록을 하루 한 번 저장합니다. 이후 변경 때마다 같은 파일을 덮어쓰지 않습니다. 최신 상태가 필요하면 **백업 내보내기**를 사용하세요.
- Mac에서는 앱이 실행 중인 동안 매분 날짜를 확인합니다. 창을 닫아도 앱을 완전히 종료하지 않았다면 계속 동작합니다.
- Android에서는 앱 실행/복귀 및 실행 중 매분 확인합니다. 별도로 OS 백그라운드 작업을 최소 15분 간격으로 요청합니다. OS가 실행 시점을 결정하므로 정확한 시각이나 매일 실행을 보장하지 않습니다.
- 종료·절전·강제 종료 등으로 놓쳤다면 다음 실행 때 **그때의 현재 기록을 오늘 날짜로** 백업합니다. 지나간 날짜의 상태를 소급 생성하지 않습니다.
- Android 백그라운드 작업은 백업 후 Mac 연결도 시도합니다. Mac이 응답하지 않아도 로컬 백업은 남습니다.
- Mac: 데이터 폴더 아래 `backups/`. Android: 앱 문서 디렉터리 아래 `backups/`.
- **자동 백업 목록**에서 파일을 내보낼 수 있습니다. 최근 60개를 표시하며, 이전 파일도 삭제하지 않습니다.
- **백업 복원** 전에 별도의 `before-restore` 백업을 생성합니다. 보호 백업을 만들 수 없으면 복원을 중단합니다.

자동 백업도 같은 기기에 있으므로 앱 데이터 삭제·기기 고장으로 함께 사라질 수 있습니다. 보관할 백업은 외부 폴더나 다른 기기로 내보내세요. JSON 백업에는 기록만 포함하고 연결 키나 동기화 이력은 포함하지 않습니다. 파일은 10MB까지 가져올 수 있습니다.

## 기존 기록 이전

- **동일한 Android 앱 저장 영역**의 기존 `harugyeol.v1` AsyncStorage 데이터는 최초 실행 시 검증하고, `before-migration` JSON 백업을 만든 뒤 SQLite로 옮깁니다. 기존 원본은 지우지 않습니다. 읽기/검증/백업 실패 시 이전을 중단합니다.
- Expo Go와 독립 설치 앱은 저장 영역이 다릅니다. Expo Go에서 JSON을 내보내 독립 앱에서 복원하세요.
- 기존 브라우저 기록은 브라우저에서 **백업 내보내기 → Mac 앱에서 백업 복원**으로 옮깁니다. Mac 설치 앱은 브라우저의 localStorage에 직접 접근하지 않습니다.
- 기존 version 1 JSON 백업을 그대로 읽습니다. 복원은 전체 교체이므로 양쪽에 기록이 있다면 먼저 백업하세요.

## 검증

```sh
npm run check          # 포맷·린트·타입·테스트 전체 검증 (CI와 동일)
npm run lint           # oxlint 검사 (경고도 실패 처리)
npm run lint:fix       # 자동 수정 가능한 린트 문제 수정
npm run format        # Oxfmt로 코드·설정·문서 포맷팅
npm run format:check  # 파일 변경 없이 포맷 검사
npm run typecheck
npm test
npm run build          # 웹 자산
npm run build:android  # Android JS/자산 번들만 생성, APK 아님
npm run desktop:compile
```

Oxlint 설정은 `.oxlintrc.json`에서 관리합니다. 앱·Electron·스크립트·테스트의 JavaScript/TypeScript를 검사하며, React와 Vitest 규칙을 포함합니다. 빌드 결과물과 생성된 Android/iOS 프로젝트는 제외합니다. 타입 검사는 별도로 `npm run typecheck`를 실행하세요.

포맷팅은 Oxfmt가 담당하며 `.oxfmtrc.json`에서 설정합니다. 들여쓰기 2칸, 작은따옴표(JSX는 큰따옴표), 세미콜론, 줄 너비 100을 기준으로 사용합니다. import는 모듈 종류별로 정렬하고 side-effect import와 `package.json` 키 순서는 유지합니다. 빌드 결과물·생성된 네이티브 프로젝트·`package-lock.json`은 포맷팅에서 제외합니다.

Oxlint는 중괄호 생략, 중첩 삼항식, 명시적 `any`, 잘못된 Hook 의존성과 `.only`·`.skip` 테스트도 검사합니다. 상세 기준과 변경 절차는 [개발 안내](CONTRIBUTING.md#자동-검사-기준)에 정리되어 있습니다.

VS Code에서는 프로젝트 추천 확장인 [Oxc](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode)를 설치하면 JavaScript/TypeScript, JSON, YAML, Markdown 파일을 저장할 때 자동 포맷팅합니다.

테스트는 날짜·기존 JSON 검증, SQLite 재시작 후 유지, 하루 1회 백업, 이전·복원 실패 시 보호, 동시 편집·삭제 병합, 실제 로컬 HTTP 암호화 통신, 재전송/외부 Origin 차단, 수동 동기화 응답을 검증합니다. LAN 테스트는 로컬 포트 바인딩이 가능한 환경에서 실행해야 합니다.

이번 구현 환경에서 Android Studio/SDK 및 연결 기기가 없어 Android APK 빌드와 실제 QR 스캔·파일 공유·백그라운드 실행은 검증하지 못했습니다. Android JS 번들 생성과 네이티브 설정 해석은 확인했습니다.

## 주요 파일

- `App.tsx`, `src/tracker/TrackerScreen.tsx`: 앱 진입점과 기록 화면
- `src/tracker/`: 기록 편집·날짜 선택·체중 표시 컴포넌트와 저장 상태 관리
- `src/SyncPanel.tsx`, `src/PairScanner.tsx`: 백업·연결·동기화 UI
- `src/data.ts`: 기존 JSON 데이터 형식 및 검증
- `src/sync-model.ts`: 기록별 버전·삭제 이력·병합
- `src/local-engine.ts`: 저장·이전·백업·복원 직렬화
- `src/native-storage.ts`: Android SQLite 및 백업 파일
- `src/services.ts`, `src/background.ts`: Android LAN 클라이언트·백그라운드 작업
- `src/services.web.ts`, `src/platform.web.ts`: 브라우저 및 Electron 연결
- `desktop/storage.ts`: Mac SQLite 및 백업 파일
- `desktop/lan-server.ts`: 암호화된 LAN 통신 및 Android 응답 대기
- `desktop/main.ts`, `desktop/preload.cjs`: 격리된 Electron 창과 제한된 IPC
- `electron-builder.yml`: Mac 패키징
