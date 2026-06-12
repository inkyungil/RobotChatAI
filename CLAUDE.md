# RobotChatAI — 프로젝트 규칙 (CLAUDE.md)

이 파일은 이 저장소에서 작업할 때 지켜야 할 규칙을 기록합니다.

## 데이터베이스 (MariaDB `labi`)

- **테이블·컬럼을 만들 때는 반드시 `COMMENT`를 작성한다.** 테이블 레벨 `COMMENT='...'`와
  모든 컬럼의 `COMMENT '...'`를 빠짐없이 넣는다. 주석은 한국어로, 해당 항목의 용도를 설명한다.
  - SQLAlchemy 모델: `mapped_column(..., comment="...")`,
    테이블은 `__table_args__ = {"comment": "..."}`.
  - 원시 SQL: `CREATE TABLE ... ( col ... COMMENT '...', ... ) ... COMMENT='...';`
  - 이미 만들어진 테이블에 누락됐다면 `ALTER TABLE ... MODIFY ... COMMENT '...', COMMENT='...'`로 소급 적용한다.
  - 예시 구현: `chatbot/backend/app/models.py`, `chatbot/backend/db/admin_schema.sql`.
- 비밀번호 등 비밀값은 **평문 저장 금지** — `hashed_password`처럼 bcrypt 해시만 저장한다.
- 접속 정보(`labi_user` 등) 같은 비밀값은 코드/문서가 아니라 `chatbot/backend/.env`(git-ignore)에만 둔다.

## API 경로 규칙

- **Ollama API를 제외한 모든 백엔드 API는 같은 출처의 `/api` 프리픽스로 호출한다.**
  (페이지 라우트와 구분하기 위함.) 예: 관리자 API는 `/api/admin/...`.
  - 개발: Vite dev 프록시가 `/api` → FastAPI(`127.0.0.1:8010`)로 전달 (`vite.config.ts`).
  - 운영: nginx가 `/api` → `:8010`으로 프록시 (`/etc/nginx/conf.d/chatbot-frontend.conf`).
  - 프론트 클라이언트는 절대 URL을 하드코딩하지 않고 같은 출처 상대경로(`/api/...`)를 쓴다
    (`chatbot/frontend/src/lib/admin-api.ts`, 기본 base 빈 문자열).
- **예외:** Ollama는 기존 `/ollama` 프리픽스를 유지한다.

## 구성 요약

- `chatbot/frontend` — TanStack Start/Router + shadcn/ui SPA. nginx가 `dist/`를 `:3000`에 서빙.
- `chatbot/backend` — FastAPI + JWT 관리자 API. `labi-admin-api.service`(systemd)로 `:8010` 상시 구동.
- 관리자 화면: `/admin` (로그인 / 대시보드 / 관리자 목록 CRUD).
