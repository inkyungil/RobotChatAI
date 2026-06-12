# NGINX, PHP, phpMyAdmin, MariaDB 설치 정보

작성일: 2026-06-12 KST
OS: Ubuntu 24.04.4 LTS (noble)

## 접속 정보

phpMyAdmin URL:

```text
http://localhost/phpmyadmin/
http://192.168.0.12/phpmyadmin/
```

MariaDB/phpMyAdmin 관리자 계정:

```text
사용자: admin
비밀번호: <REDACTED — 보안상 공개 저장소에 올리지 않음 / not committed for security>
```

주의: 위 비밀번호는 DB 관리자 권한 계정입니다. 문서를 공유하거나 공개 저장소에 올리지 마세요.

## 설치된 소프트웨어

| 구분 | 설치 버전 | 설치/제공 방식 |
|---|---:|---|
| NGINX | 1.31.1 | nginx.org 공식 mainline Ubuntu 저장소 |
| PHP | 8.5.7 | Ondrej PHP PPA |
| PHP-FPM | 8.5.7 | Ondrej PHP PPA |
| MariaDB Server | 12.3.2 | MariaDB 공식 12.rolling 저장소 |
| phpMyAdmin | 5.2.3 | phpMyAdmin 공식 ZIP 배포본 |

## 설치된 주요 PHP 확장

```text
php8.5-cli
php8.5-fpm
php8.5-mysql
php8.5-mbstring
php8.5-xml
php8.5-curl
php8.5-zip
php8.5-gd
php8.5-intl
```

## 서비스 정보

| 서비스 | 상태 | 자동 시작 |
|---|---|---|
| nginx | active/running 확인됨 | enabled |
| php8.5-fpm | active/running 확인됨 | enabled |
| mariadb | active/running 확인됨 | enabled |

서비스 관리 명령:

```bash
sudo systemctl status nginx php8.5-fpm mariadb
sudo systemctl restart nginx php8.5-fpm mariadb
sudo systemctl stop nginx php8.5-fpm mariadb
sudo systemctl start nginx php8.5-fpm mariadb
```

## 주요 경로

| 항목 | 경로 |
|---|---|
| NGINX 메인 설정 | `/etc/nginx/nginx.conf` |
| NGINX 기본 서버 설정 | `/etc/nginx/conf.d/default.conf` |
| 웹 루트 | `/usr/share/nginx/html` |
| phpMyAdmin 설치 경로 | `/usr/share/phpmyadmin` |
| phpMyAdmin 설정 | `/usr/share/phpmyadmin/config.inc.php` |
| phpMyAdmin 임시 디렉터리 | `/var/lib/phpmyadmin/tmp` |
| PHP-FPM pool 설정 | `/etc/php/8.5/fpm/pool.d/www.conf` |
| PHP-FPM 소켓 | `/run/php/php8.5-fpm.sock` |
| MariaDB 설정 디렉터리 | `/etc/mysql/` |
| MariaDB 데이터 디렉터리 | `/var/lib/mysql` |

## 적용된 저장소/소스

NGINX official mainline repository:

```text
http://nginx.org/packages/mainline/ubuntu noble nginx
```

PHP Ondrej PPA:

```text
ppa:ondrej/php
```

MariaDB official repository:

```text
https://dlm.mariadb.com/repo/mariadb-server/12.rolling/repo/ubuntu noble main
```

phpMyAdmin official release:

```text
https://files.phpmyadmin.net/phpMyAdmin/5.2.3/phpMyAdmin-5.2.3-all-languages.zip
```

## 검증 결과

설치 후 아래 항목을 확인했습니다.

```text
NGINX: nginx/1.31.1
PHP: PHP 8.5.7
MariaDB: 12.3.2-MariaDB-ubu2404
phpMyAdmin: 5.2.3
phpMyAdmin HTTP 응답: 200 OK
MariaDB admin 계정 접속: 성공
기존 admin/1234 접속: 차단 확인
```

## MariaDB 접속 예시

```bash
mariadb -uadmin -p
```

비밀번호 입력:

```text
<REDACTED — 보안상 공개 저장소에 올리지 않음 / not committed for security>
```
