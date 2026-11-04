<?php
declare(strict_types=1);

final class Projects
{
    /** Fetches a project row and verifies it belongs to the given user. */
    public static function owned(int $id, int $userId): array
    {
        $row = Db::one('SELECT * FROM ' . Db::t('projects') . ' WHERE id = ? AND user_id = ?', [$id, $userId]);
        return $row ?? throw new ApiError(404, 'Project not found.');
    }

    public static function list(int $userId): array
    {
        $rows = Db::all(
            'SELECT id, name, updated_at FROM ' . Db::t('projects') . ' WHERE user_id = ? ORDER BY updated_at DESC',
            [$userId]
        );
        return array_map(static fn(array $r) => ['id' => (int) $r['id']] + $r, $rows);
    }

    public static function create(int $userId): array
    {
        $b = Http::body();
        $name = Http::str($b, 'name', 160);
        if ($name === '') {
            throw new ApiError(422, 'Give your project a name.');
        }
        $data = self::encodeSite($b['site'] ?? null);
        $token = bin2hex(random_bytes(16));
        Db::run(
            'INSERT INTO ' . Db::t('projects') . ' (user_id, name, token, data) VALUES (?, ?, ?, ?)',
            [$userId, $name, $token, $data]
        );
        return self::get((int) Db::pdo()->lastInsertId(), $userId);
    }

    public static function get(int $id, int $userId): array
    {
        return self::present(self::owned($id, $userId));
    }

    /** Saves the whole site document; a stale revision means another tab saved first. */
    public static function update(int $id, int $userId): array
    {
        $project = self::owned($id, $userId);
        $b = Http::body();
        $name = Http::str($b, 'name', 160) ?: $project['name'];
        $data = self::encodeSite($b['site'] ?? null);

        $stmt = Db::run(
            'UPDATE ' . Db::t('projects') . ' SET name = ?, data = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
            [$name, $data, $id, (int) ($b['revision'] ?? 0)]
        );
        if ($stmt->rowCount() === 0) {
            throw new ApiError(409, 'This project was changed in another tab. Reload to continue.');
        }
        return ['revision' => (int) $project['revision'] + 1];
    }

    public static function delete(int $id, int $userId): array
    {
        $project = self::owned($id, $userId);
        Db::run('DELETE FROM ' . Db::t('projects') . ' WHERE id = ?', [$id]);
        Assets::removeProjectDir($project['token']);
        return ['ok' => true];
    }

    public static function duplicate(int $id, int $userId): array
    {
        $source = self::owned($id, $userId);
        $token = bin2hex(random_bytes(16));
        Db::run(
            'INSERT INTO ' . Db::t('projects') . ' (user_id, name, token, data) VALUES (?, ?, ?, ?)',
            [$userId, $source['name'] . ' (copy)', $token, $source['data']]
        );
        $newId = (int) Db::pdo()->lastInsertId();
        Assets::copyProject((int) $source['id'], $source['token'], $newId, $token);
        return self::get($newId, $userId);
    }

    private static function present(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'revision' => (int) $row['revision'],
            'assetBase' => 'uploads/' . $row['token'] . '/',
            'site' => json_decode($row['data'], true),
        ];
    }

    private static function encodeSite(mixed $site): string
    {
        if (!is_array($site) || !isset($site['pages']) || !is_array($site['pages'])) {
            throw new ApiError(422, 'Invalid site document.');
        }
        return json_encode($site, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
}
