<?php
declare(strict_types=1);

final class Auth
{
    private const MAX_FAILURES = 10;
    private const WINDOW_MINUTES = 15;

    public static function startSession(): void
    {
        session_name('ssm_session');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        session_start();
    }

    public static function userId(): ?int
    {
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    }

    public static function requireUser(): int
    {
        return self::userId() ?? throw new ApiError(401, 'Please log in.');
    }

    public static function publicUser(?int $id): ?array
    {
        if ($id === null) {
            return null;
        }
        $user = Db::one('SELECT id, name, email, is_admin FROM ' . Db::t('users') . ' WHERE id = ?', [$id]);
        if ($user === null) {
            return null;
        }
        $user['id'] = (int) $user['id'];
        $user['is_admin'] = (bool) $user['is_admin'];
        return $user;
    }

    public static function register(): array
    {
        if (!Db::config('allow_registration', false)) {
            throw new ApiError(403, 'Registration is closed on this platform.');
        }
        $b = Http::body();
        $name = Http::str($b, 'name', 120);
        $email = strtolower(Http::str($b, 'email', 190));
        $password = is_string($b['password'] ?? null) ? $b['password'] : '';

        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ApiError(422, 'Enter your name and a valid email address.');
        }
        if (strlen($password) < 8) {
            throw new ApiError(422, 'Password must be at least 8 characters.');
        }
        if (Db::one('SELECT id FROM ' . Db::t('users') . ' WHERE email = ?', [$email])) {
            throw new ApiError(409, 'That email address is already registered.');
        }

        Db::run(
            'INSERT INTO ' . Db::t('users') . ' (name, email, password_hash) VALUES (?, ?, ?)',
            [$name, $email, password_hash($password, PASSWORD_DEFAULT)]
        );
        return self::establish((int) Db::pdo()->lastInsertId());
    }

    public static function login(): array
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $attempts = Db::t('login_attempts');
        Db::run("DELETE FROM $attempts WHERE attempted_at < NOW() - INTERVAL " . self::WINDOW_MINUTES . ' MINUTE');
        $failures = Db::one("SELECT COUNT(*) AS n FROM $attempts WHERE ip = ?", [$ip]);
        if ((int) $failures['n'] >= self::MAX_FAILURES) {
            throw new ApiError(429, 'Too many failed attempts. Try again in a few minutes.');
        }

        $b = Http::body();
        $email = strtolower(Http::str($b, 'email', 190));
        $password = is_string($b['password'] ?? null) ? $b['password'] : '';
        $user = Db::one('SELECT id, password_hash FROM ' . Db::t('users') . ' WHERE email = ?', [$email]);

        if ($user === null || !password_verify($password, $user['password_hash'])) {
            Db::run("INSERT INTO $attempts (ip) VALUES (?)", [$ip]);
            throw new ApiError(401, 'Wrong email or password.');
        }
        Db::run("DELETE FROM $attempts WHERE ip = ?", [$ip]);
        return self::establish((int) $user['id']);
    }

    public static function logout(): array
    {
        $_SESSION = [];
        session_destroy();
        return ['ok' => true];
    }

    private static function establish(int $userId): array
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        return self::publicUser($userId);
    }
}
