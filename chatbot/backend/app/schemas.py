from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import AdminRole


class LoginRequest(BaseModel):
    username: str
    password: str


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    role: AdminRole
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminOut


class AdminCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=128)
    role: AdminRole = AdminRole.admin
    is_active: bool = True


class AdminUpdate(BaseModel):
    password: str | None = Field(default=None, min_length=6, max_length=128)
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, max_length=128)
    role: AdminRole | None = None
    is_active: bool | None = None


class AdminListResponse(BaseModel):
    items: list[AdminOut]
    total: int


class DayCount(BaseModel):
    date: str
    count: int


class DashboardStats(BaseModel):
    total_admins: int
    active_admins: int
    total_conversations: int
    total_messages: int
    selected_model: str | None = None
    conversations_per_day: list[DayCount]
    recent_admins: list[AdminOut]
