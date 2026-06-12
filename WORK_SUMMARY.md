# Libi 도서관 모바일 로그인 & 로봇 호출 서비스 개발 및 다국어 기능 정리 보고서

본 문서는 Libi(기존 Labi) 도서관 시스템의 데이터베이스 데이터 중복 정화 작업과 새로 개발된 **모바일 회원가입/로그인**, **로봇 호출 배달 시뮬레이션 서비스**, 그리고 **한국어(KR) 단독 지원 설정**의 전체 작업 내용을 상세하게 기록한 보고서입니다.

---

## 1. 📊 데이터베이스 정화 및 테이블 스키마 구축

### 1.1. 정적 도서 데이터 중복 정화
* **기존 문제**: 기존 DB 세팅 파일의 데이터 오류로 인해 고유 도서가 27종에 불과했고, 각 도서마다 불필요하게 8개씩의 에디션이 중복 적재되어 검색 시 "불편한 편의점" 등이 비정상적으로 다수 노출되었습니다.
* **조치 내용**: 
  * 120여 개의 실제 고유한 명작 소설, 자기계발서 등으로 데이터를 채운 [seed_books.py](file:///home/Aiprj/RobotChatAI/chatbot/backend/scripts/seed_books.py) 씨딩 스크립트를 실행했습니다.
  * DB 전체 책 수는 210권을 유지하되, 고유 베이스 도서 종류를 **27종 ➡️ 114종**으로 대폭 늘려 실제 도서관과 유사한 다채로운 도서 목록으로 정화했습니다. (책당 에디션 수 최대 2개로 조정)
  * [update_sql_file.py](file:///home/Aiprj/RobotChatAI/chatbot/backend/scripts/update_sql_file.py)를 작성하여, 정화된 210개 실데이터를 백업 SQL인 [setup-labi-db.sql](file:///home/Aiprj/RobotChatAI/chatbot/frontend/setup-labi-db.sql) 파일 내 `INSERT` 구문에 동기화시켰습니다.

### 1.2. 신규 테이블 DDL 정의
모바일 사용자 관리 및 로봇의 도서 이송 작업을 데이터베이스에 적재 및 추적하기 위해 2개의 테이블을 새로 생성했습니다. 각 테이블과 컬럼에는 한국어 주석(`COMMENT`)을 적용했습니다.

#### A. 모바일 회원 테이블 (`members`)
```sql
CREATE TABLE IF NOT EXISTS members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '기본키',
  username VARCHAR(64) NOT NULL COMMENT '로그인 아이디 (고유)',
  full_name VARCHAR(128) NULL COMMENT '사용자 이름',
  email VARCHAR(255) NULL UNIQUE COMMENT '이메일 (고유, 선택)',
  hashed_password VARCHAR(255) NOT NULL COMMENT 'bcrypt 해시된 비밀번호',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '활성 여부 (0=비활성, 1=활성)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
  PRIMARY KEY (id),
  UNIQUE KEY uq_members_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='모바일 사용자 계정: 로그인 및 도서 주문 주체';
```

#### B. 로봇 이송 작업 테이블 (`robot_tasks`)
```sql
CREATE TABLE IF NOT EXISTS robot_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '기본키',
  member_id BIGINT UNSIGNED NOT NULL COMMENT '호출한 사용자(Member) 기본키',
  book_id BIGINT UNSIGNED NOT NULL COMMENT '대상 도서(Book) 기본키',
  status VARCHAR(50) NOT NULL DEFAULT 'requested' COMMENT '작업 상태: requested(요청됨) | moving(이동중) | retrieved(수거완료) | delivering(배송중) | completed(완료) | failed(실패)',
  zone VARCHAR(50) NOT NULL COMMENT '대상 도서 구역 (예: A-2)',
  shelf VARCHAR(50) NOT NULL COMMENT '대상 도서 서가 위치',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '호출 일시',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '상태 변경 일시',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='로봇 호출 작업 내역: 도서 수거 및 진열대 전달 상태 관리';
```

---

## 2. ⚙️ 백엔드 API & 실시간 가상 시뮬레이터 (FastAPI)

### 2.1. API 라우터 구현
* **회원인증 라우터 ([members.py](file:///home/Aiprj/RobotChatAI/chatbot/backend/app/routers/members.py))**:
  * `POST /api/member/auth/register`: 중복 아이디/이메일 검증 후 비밀번호 해시(`bcrypt`) 처리하여 신규 회원 적재.
  * `POST /api/member/auth/login`: 인증 후 JWT Access Token 발급.
  * `GET /api/member/auth/me`: 토큰 검증 의존성(`get_current_member`)을 통해 현재 로그인한 사용자 정보 조회.
* **로봇 이송 라우터 ([robot.py](file:///home/Aiprj/RobotChatAI/chatbot/backend/app/routers/robot.py))**:
  * `POST /api/robot/call`: 특정 도서의 소장 여부와 상태(`in_stock`)를 파악한 뒤 신규 호출 태스크 생성 및 실시간 가상 시뮬레이터 호출.
  * `GET /api/robot/tasks`: 본인의 로봇 호출 히스토리 목록 조회.
  * `GET /api/robot/tasks/{task_id}`: 단일 태스크의 실시간 상세 상태 및 도서 정보 조회.
  * `POST /api/robot/tasks/{task_id}/reset`: 테스트의 편의를 위해 태스크 상태를 리셋하고 도서 재고를 원상 복구시키는 디버그 API.

### 2.2. 실시간 로봇 구동 시뮬레이터
실제 ROS2 하드웨어 연동 시나리오에 대비하여, 도서관 물리 공간 내 로봇의 구동 시간을 반영해 데이터베이스 상태를 점진적으로 업데이트해 주는 비동기 스레드 시뮬레이터를 개발했습니다.
* **시뮬레이션 전이 타임라인**:
  1. `requested` (요청 완료)
  2. 4초 후 `moving` (도서 구역으로 이동 중)
  3. 5초 후 `retrieved` (서가에서 책 수거 완료)
  4. 4초 후 `delivering` (진열대/대출대로 배달 이송 중)
  5. 5초 후 `completed` (배달 완료 및 도서의 대출상태 `in_stock = False` 처리)
* **비동기 구동**: FastAPI의 `BackgroundTasks`를 이용하여 백그라운드 스레드에서 DB를 안전하게 갱신하도록 설계되었습니다.

---

## 3. 📱 프론트엔드 모바일 서비스 화면 개발 (React / Vite)

### 3.1. 로그인 및 가입 페이지 ([login.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/login.tsx))
* **디자인 및 UI**: 고급스러운 그라디언트 톤 및 Glassmorphism 반투명 레이아웃을 채택하여 모던하고 감각적인 모바일 전용 뷰로 렌더링됩니다.
* **추가 필드**: 아이디와 비밀번호 외에 **사용자 이름**, **이메일**, **서비스 이용약관 및 개인정보 처리방침 동의(필수)** 체크박스를 추가로 배치했습니다.
* **예외 처리**: 약관 미동의 시 버튼을 눌러도 가입이 중지되며, 상단에 주의 문구가 노출되도록 제어했습니다.

### 3.2. 실시간 로봇 모니터 페이지 ([robot.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/robot.tsx))
* **실시간 모니터링**: 2.5초 간격으로 서버 상태를 지속적으로 Polling 조회하여 화면을 갱신합니다.
* **비주얼 스텝퍼**: 로봇의 5단계 움직임 상태를 동적으로 보여주는 애니메이션 게이지와 Progress 스텝 바를 도입하여 가독성을 높였습니다.
* **테스트 기능**: 시뮬레이션 상태를 손쉽게 초기화하고 여러 번 재테스트 해 볼 수 있도록 **'시뮬레이션 재설정'** 버튼을 카드 우하단에 제공합니다.

### 3.3. 검색 화면 개편 및 UX 연동 ([search.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/search.tsx))
* 대출 가능한 책인 경우, 각 책 카드의 하단 영역에 지도 안내 버튼과 나란히 **`🤖 로봇 호출`** 버튼을 노출하도록 레이아웃을 개편했습니다.
* 비로그인 상태에서 버튼을 클릭하면 로그인 화면(`/login?redirect=/search`)으로 리다이렉트되고, 로그인 성공 시 직전 검색 상태로 복귀 후 즉시 로봇 호출 API가 실행되어 모니터링 화면으로 직행하도록 연동했습니다.

### 3.4. 설정 화면 보완 ([settings.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/settings.tsx))
* 설정(마이페이지) 내에 **"모바일 로봇 서비스"** 섹션을 추가하여 로그인 여부에 따라 분기 렌더링되게 했습니다.
  * 로그인 전: 서비스 가이드 텍스트 및 **'로그인 / 회원가입'** 버튼 제공.
  * 로그인 후: 로그인된 회원명, 아이디 표시, **로그아웃** 버튼 및 **'로봇 호출 모니터 바로가기'** 링크 활성화.

---

## 4. 🛠️ 트러블슈팅 (Troubleshooting)

### 4.1. TanStack Router `useSearch()` 런타임 크래시
* **문제**: `/login` 경로로 전환할 때, 라우터 세팅에 Zod 스키마 검증기(`validateSearch`)를 명시적으로 달아두지 않고 컴포넌트 내에서 `useSearch()` 훅을 호출하면 브라우저 콘솔에 치명적인 런타임 에러가 발생하여 흰색 화면으로 뻗는 이슈가 있었습니다.
* **해결**: [login.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/login.tsx)에 `redirect` 파라미터를 검증할 수 있는 `loginSearchSchema`를 `zod`로 설계하여 라우트에 연결해 줌으로써 라우터 전환 크래시 현상을 완전하게 제거했습니다.

### 4.2. React 전역 참조 오류
* **문제**: 일부 브라우저 런타임 환경에서 `e: React.FormEvent` 등 전역 네임스페이스인 `React`를 바인딩 없이 직접 사용하면 `ReferenceError: React is not defined` 에러를 뿜을 수 있었습니다.
* **해결**: 파일 상단에 `import { type FormEvent } from "react"`를 명확히 추가하고 `e: FormEvent` 타입 힌트로 수정하여 타입 안전성과 런타임 안정성을 확보했습니다.

### 4.3. 브라우저 정적 자산 캐싱 우회 (Hard Load)
* **문제**: Single Page Application(SPA)의 구조적 특성상, index.html과 JS 빌드 결과물이 갱신되더라도 웹 브라우저가 이전 SPA 경로를 메모리에 올려둔 채로 재사용(디스크 캐시)하여 화면 변경 사항이 즉시 보이지 않는 현상이 빈번했습니다.
* **해결**: 설정 페이지의 '로그인' 버튼과 도서 검색 페이지의 '로봇 호출' 버튼을 클릭했을 때 SPA 라우팅 네비게이션이 아닌 **`window.location.href`를 통해 브라우저를 강제로 리로드(Hard Load)** 하도록 설계했습니다.

---

## 5. 🌐 다국어 지원 제거 및 한국어(KR) 단일화

기존에 지원하던 다국어(영어, 중국어, 베트남어) 선택 기능을 완전히 제거하고, 한국어(KR)만 전용으로 동작하도록 시스템 설정을 단순화했습니다.

### 5.1. i18n 사전 정의 및 락 설정
* [i18n.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/lib/i18n.tsx) 파일의 지원 가능 언어 `LANGS`를 `KR` 단일 요소로 고정하고, `useI18n` 훅의 기본 언어를 항상 `"KR"`로 강제 고정하여 번역 함수 `tr`이 항상 한국어 사전을 제공하도록 리팩토링했습니다.

### 5.2. 언어 선택 UI 컴포넌트 제거
* **전체 앱 헤더**: 기존 [AppShell.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/components/AppShell.tsx) 헤더에 배치되어 있던 `LanguageSwitcher` 드롭다운 컴포넌트 호출부 및 파일을 제거하여, 화면 상단의 불필요한 언어 변경 영역을 삭제했습니다.
* **시작 온보딩 화면**: 첫 진입 페이지인 [index.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/index.tsx)에서 기존의 언어 선택 단계(`step === "lang"`) 분기 처리를 전면 삭제하여, 사용자가 앱 진입 시 번거로운 국적 선택 과정 없이 곧바로 음성/텍스트 입력을 선택할 수 있도록 동선을 단순화했습니다.
* **설정 페이지**: [settings.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/settings.tsx) 내에서 사용되지 않는 다국어 변경 설정 코드 및 사용하지 않는 관련 패키지/변수 선언을 청소하여 코드 안전성을 극대화했습니다.

---

## 6. 🔒 로그인 사용자 전용 접근 제어 (전역 라우터 가드)

비로그인 사용자가 모바일 도서관 앱 서비스의 주요 기능 및 화면에 무단으로 진입하는 것을 완벽히 제한하기 위해, 전역 수준에서 동작하는 **인증 가드(Router Guard)**를 적용했습니다.

### 6.1. Root 라우트 레벨의 전역 가드 구현 ([__root.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/__root.tsx))
* 애플리케이션의 최상위 껍데기이자 라우팅 진입점인 `RootComponent` 내부에 `useEffect` 기반의 전역 감시 메커니즘을 구축했습니다.
* 페이지 주소(`/`를 제외한 모든 하위 라우트)가 변경될 때마다 로컬 스토리지의 `libi.memberToken` 존재 여부를 실시간으로 판별합니다.

### 6.2. 공개 경로 예외 설정 (Public Bypass)
* 서비스 로그인 및 최초 인트로 진입 단계의 무한 리다이렉션을 방지하기 위해 다음 3가지 주소는 예외적으로 비로그인 접근을 허용합니다:
  * **온보딩 화면 (`/`)**: 앱 서비스 시작 페이지
  * **로그인/가입 화면 (`/login`)**: 회원 인증 페이지
  * **관리자 콘솔 영역 (`/admin/*`)**: 독립된 어드민 인증 세션을 사용하는 관리 공간
* 예외 대상이 아닌 일반 사용자 화면(`/home`, `/search`, `/map`, `/chat`, `/robot`, `/recommend`, `/settings` 등)에 비로그인 상태로 진입 시도 시, 해당 경로가 쿼리 파라미터(`redirect={원래가려던경로}`)에 탑재된 채 `/login` 페이지로 강제 리다이렉트되어 사용자 로그인을 선행하도록 설계했습니다.

---

## 7. 🤖 실시간 DB 연동 AI 챗봇 및 RAG(Retrieval-Augmented Generation) 구현

AI 챗봇([chat.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/chat.tsx))이 단순히 사전 지식이나 고정 시나리오 답변만 하는 한계를 극복하고, 실제 MariaDB 내에 적재된 도서 목록 및 대출 가능 여부를 기반으로 답변할 수 있도록 **실시간 DB 기반 RAG 기능**을 통합했습니다.

### 7.1. 실시간 도서 데이터 조회 및 RAG 컨텍스트 구축
* 사용자가 챗봇에게 메시지를 전송하는 즉시 프론트엔드단에서 백엔드 도서 API `/api/books`를 호출하여 전체 도서 목록을 읽어옵니다.
* 사용자의 발화 키워드(예: '경제', '소설', '자기계발', '외국도서' 등)를 검사하여 연관성 높은 실제 DB의 책 데이터를 최대 15개 필터링합니다.
* 필터링된 도서 목록을 `제목, 저자, 카테고리, 위치(Zone-서가), 대출 가능 여부` 텍스트 컨텍스트 블록으로 포맷팅한 후, 로컬 Ollama LLM(`qwen3:1.7b`) 호출 시 시스템 프로프터의 배경 지식(System Message)으로 주입합니다.

### 7.2. 백엔드 DB 연동 폴백(Fallback) 서치 메커니즘
* 로컬 LLM 서버 미구동 혹은 네트워크 단절 등으로 인해 Ollama 호출이 에러(`catch` 블록)로 유입되었을 때도, 챗봇이 정적 시나리오 대신 실제 DB의 책을 검색하여 정확한 대답을 돌려주는 **DB 연동 실시간 서치 엔진**을 이중 구축했습니다:
  * 사용자가 **"오늘 대출 가능한 경제 서적"** 등의 카테고리 추천을 요청한 경우, MariaDB의 실시간 데이터 중 `in_stock = True`(대출 가능) 상태인 실제 경제 분야 소장 도서 3종을 정렬 및 선별하여 위치 정보와 함께 명확한 리스트로 답변합니다.
  * 사용자가 특정 도서명을 발화한 경우, DB에서 제목/저자 유사 매칭을 수행하여 해당 도서의 실제 서가 좌표와 실시간 대출 가능 여부를 답변에 반영합니다.

---

## 8. 📚 관리자 도서 CRUD 기능 구현 (독립 페이지 구성)

관리자 콘솔([/admin](http://127.0.0.1:3000/admin))에서 도서 목록 조회, 신규 도서 등록, 도서 정보 수정, 도서 삭제를 모달 창이 아닌 **독립된 개별 웹 페이지**로 원활히 처리할 수 있도록 시스템을 구축했습니다.

### 8.1. 백엔드 RESTful API 구현 및 보안 바인딩 ([books.py](file:///home/Aiprj/RobotChatAI/chatbot/backend/app/routers/books.py))
* 도서 관리를 위한 4가지 핵심 CRUD API 엔드포인트를 추가했습니다:
  * `GET /api/books/{book_id}`: 개별 도서 상세 조회 (수정 페이지 사전 로딩용)
  * `POST /api/books`: 신규 도서 등록 (어드민 세션 검증)
  * `PUT /api/books/{book_id}`: 기존 도서 정보 수정 (어드민 세션 검증)
  * `DELETE /api/books/{book_id}`: 도서 영구 삭제 (어드민 세션 검증)
* 쓰기 작업(`POST`, `PUT`, `DELETE`)에 대해 `Depends(get_current_admin)` 보안 의존성을 주입하여 유효한 관리자 로그인 세션(JWT 토큰)을 가진 주체만 도서 데이터베이스를 조작할 수 있도록 통제했습니다.
* FastAPI Uvicorn 서비스가 파일 수정을 실시간으로 반영하도록 `SIGHUP` 시그널로 Graceful하게 서버를 안전 리로드 완료했습니다.

### 8.2. 프론트엔드 어드민 CRUD 개별 페이지 구조 설계
* **어드민 사이드바 메뉴 연동 ([AdminShell.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/components/admin/AdminShell.tsx))**:
  * 관리 그룹 내에 **'도서 목록'** 메뉴 아이템을 새로 추가하고 `BookOpen` 아이콘을 연결했습니다.
* **도서 목록 대시보드 ([index.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/admin/_authed/books/index.tsx))**:
  * MariaDB 내 전체 도서 목록을 읽기 쉬운 반응형 테이블 레이아웃으로 출력합니다. (표지 이모지, 국/영문 도서 정보, 저자, 카테고리 배지, 위치 구역/서가 줄, 대출상태 필터)
  * 실시간 검색 바를 통해 타이핑 즉시 DB 필터 쿼리가 작동하며, 수정/삭제 버튼을 제공합니다.
* **신규 도서 등록 페이지 ([new.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/admin/_authed/books/new.tsx))**:
  * 독립 페이지로 제공되며, 다국어(한국어, 영어, 중국어, 베트남어)에 매핑되는 도서명, 저자, 보관 구역/서가 정보, 대출 여부 스위치, 다국어 요약 설명문 및 추천 해시태그(쉼표 구분 입력 자동 배열화) 폼을 제공합니다.
  * 테마 선택기로 14종의 도서 이모지와 6가지 고급 그라디언트(Sky Indigo, Mint Teal 등) 프리뷰를 실시간으로 조작 및 저장 가능합니다.
* **도서 수정 페이지 ([edit.tsx](file:///home/Aiprj/RobotChatAI/chatbot/frontend/src/routes/admin/_authed/books/edit.tsx))**:
  * 쿼리 매개변수 `?id=도서ID`를 이용해 독립된 도서 편집 뷰로 전환됩니다.
  * 마운트 직후 `adminApi.getBook(id)` 비동기 호출을 통해 기존 도서 정보와 다국어 사전값, 추천 해시태그를 모두 역구문하여 폼에 자동 프리필(Pre-fill)합니다.



