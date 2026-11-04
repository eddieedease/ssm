<?php
declare(strict_types=1);

final class Db
{
    private static ?PDO $pdo = null;
    private static array $config = [];

    /** Loads config.php. Returns false when the platform is not installed yet. */
    public static function configure(): bool
    {
        if (!is_file(SSM_CONFIG_FILE)) {
            return false;
        }
        self::$config = require SSM_CONFIG_FILE;
        return true;
    }

    public static function config(string $key, mixed $default = null): mixed
    {
        return self::$config[$key] ?? $default;
    }

    public static function connect(string $host, int $port, string $name, string $user, string $pass): PDO
    {
        $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }

    public static function pdo(): PDO
    {
        return self::$pdo ??= self::connect(
            self::$config['db_host'],
            (int) self::$config['db_port'],
            self::$config['db_name'],
            self::$config['db_user'],
            self::$config['db_pass'],
        );
    }

    /** Table name including the prefix chosen in the installer. */
    public static function t(string $table): string
    {
        return (self::$config['db_prefix'] ?? '') . $table;
    }

    public static function run(string $sql, array $params = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function one(string $sql, array $params = []): ?array
    {
        return self::run($sql, $params)->fetch() ?: null;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }
}
