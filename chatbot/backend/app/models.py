import enum
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AdminRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"


class AdminUser(Base):
    """Admin account — used both for login and as the managed user list."""

    __tablename__ = "admin_users"
    # Convention: every MariaDB table/column carries a COMMENT (see CLAUDE.md).
    __table_args__ = {"comment": "관리자 계정: 로그인 및 관리자 목록 CRUD 대상"}

    id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True, comment="기본키"
    )
    username: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, comment="로그인 아이디 (고유)"
    )
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, comment="이메일 (고유, 선택)"
    )
    full_name: Mapped[str | None] = mapped_column(
        String(128), nullable=True, comment="표시 이름"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="bcrypt 해시된 비밀번호 (평문 저장 금지)"
    )
    role: Mapped[AdminRole] = mapped_column(
        Enum(AdminRole),
        nullable=False,
        default=AdminRole.admin,
        comment="권한 등급: superadmin | admin",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, comment="활성 여부 (0=비활성, 1=활성)"
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="마지막 로그인 시각"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="생성 시각"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="수정 시각 (자동 갱신)",
    )
