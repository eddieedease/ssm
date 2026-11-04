<?php
declare(strict_types=1);

/** A user's personal theme library, reusable across projects. */
final class Themes
{
    public static function list(int $userId): array
    {
        $rows = Db::all('SELECT id, name, data FROM ' . Db::t('themes') . ' WHERE user_id = ? ORDER BY name', [$userId]);
        return array_map(self::present(...), $rows);
    }

    public static function create(int $userId): array
    {
        $b = Http::body();
        $name = Http::str($b, 'name', 120);
        if ($name === '' || !is_array($b['theme'] ?? null)) {
            throw new ApiError(422, 'A theme needs a name.');
        }
        $data = json_encode($b['theme'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        Db::run('INSERT INTO ' . Db::t('themes') . ' (user_id, name, data) VALUES (?, ?, ?)', [$userId, $name, $data]);
        return self::present(['id' => Db::pdo()->lastInsertId(), 'name' => $name, 'data' => $data]);
    }

    public static function delete(int $id, int $userId): array
    {
        Db::run('DELETE FROM ' . Db::t('themes') . ' WHERE id = ? AND user_id = ?', [$id, $userId]);
        return ['ok' => true];
    }

    private static function present(array $row): array
    {
        return ['id' => (int) $row['id'], 'name' => $row['name'], 'theme' => json_decode($row['data'], true)];
    }
}
