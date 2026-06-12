-- admin_users: admin accounts for the RobotChatAI admin area.
-- Run against the existing `labi` database. The backend's seed_admin.py
-- also creates this table via SQLAlchemy; this file is for manual setup.
--
-- password is stored ONLY as a bcrypt hash, never in plaintext.

USE labi;

CREATE TABLE IF NOT EXISTS admin_users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username        VARCHAR(64)  NOT NULL,
  email           VARCHAR(255) NULL,
  full_name       VARCHAR(128) NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role            ENUM('superadmin', 'admin') NOT NULL DEFAULT 'admin',
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at   TIMESTAMP    NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username),
  UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
