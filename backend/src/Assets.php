<?php
declare(strict_types=1);

final class Assets
{
    /** Extension allowlist: only inert file types a static site needs. */
    private const ALLOWED = [
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico',
        'pdf', 'txt', 'csv', 'json',
        'mp4', 'webm', 'mp3', 'ogg',
        'woff', 'woff2', 'ttf', 'otf',
        'css', 'js',
    ];
    private const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico'];
    private const MAX_BYTES = 32 * 1024 * 1024;

    public static function list(int $projectId, int $userId): array
    {
        Projects::owned($projectId, $userId);
        $rows = Db::all(
            'SELECT id, filename, original_name, mime, size FROM ' . Db::t('assets') . ' WHERE project_id = ? ORDER BY created_at DESC, id DESC',
            [$projectId]
        );
        return array_map(self::present(...), $rows);
    }

    public static function upload(int $projectId, int $userId): array
    {
        $project = Projects::owned($projectId, $userId);
        $file = $_FILES['file'] ?? null;

        if ($file === null) {
            // PHP drops $_FILES entirely when post_max_size is exceeded.
            throw new ApiError(413, 'No file received. It may exceed the server upload limit of ' . ini_get('post_max_size') . '.');
        }
        if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
            throw new ApiError(413, 'File exceeds the server upload limit of ' . ini_get('upload_max_filesize') . '.');
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            throw new ApiError(400, 'Upload failed.');
        }
        if ($file['size'] > self::MAX_BYTES) {
            throw new ApiError(413, 'File is larger than 32 MB.');
        }

        $original = basename((string) $file['name']);
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED, true)) {
            throw new ApiError(415, "Files of type .$ext are not allowed.");
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: 'application/octet-stream';
        if (in_array($ext, self::IMAGE, true) && !str_starts_with($mime, 'image/')) {
            throw new ApiError(415, 'That file is not a valid image.');
        }

        $dir = self::dir($project['token']);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new ApiError(500, 'Could not create the upload folder.');
        }
        $filename = self::uniqueName($dir, $original, $ext);
        if (!move_uploaded_file($file['tmp_name'], "$dir/$filename")) {
            throw new ApiError(500, 'Could not store the file.');
        }

        Db::run(
            'INSERT INTO ' . Db::t('assets') . ' (project_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)',
            [$projectId, $filename, $original, $mime, (int) $file['size']]
        );
        return self::present([
            'id' => Db::pdo()->lastInsertId(),
            'filename' => $filename,
            'original_name' => $original,
            'mime' => $mime,
            'size' => $file['size'],
        ]);
    }

    public static function delete(int $assetId, int $userId): array
    {
        $row = Db::one(
            'SELECT a.id, a.filename, p.token FROM ' . Db::t('assets') . ' a JOIN ' . Db::t('projects') . ' p ON p.id = a.project_id WHERE a.id = ? AND p.user_id = ?',
            [$assetId, $userId]
        ) ?? throw new ApiError(404, 'File not found.');

        Db::run('DELETE FROM ' . Db::t('assets') . ' WHERE id = ?', [$assetId]);
        $path = self::dir($row['token']) . '/' . $row['filename'];
        if (is_file($path)) {
            unlink($path);
        }
        return ['ok' => true];
    }

    public static function copyProject(int $fromId, string $fromToken, int $toId, string $toToken): void
    {
        $rows = Db::all('SELECT * FROM ' . Db::t('assets') . ' WHERE project_id = ?', [$fromId]);
        if ($rows === []) {
            return;
        }
        $to = self::dir($toToken);
        mkdir($to, 0775, true);
        foreach ($rows as $r) {
            $source = self::dir($fromToken) . '/' . $r['filename'];
            if (is_file($source) && copy($source, "$to/{$r['filename']}")) {
                Db::run(
                    'INSERT INTO ' . Db::t('assets') . ' (project_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)',
                    [$toId, $r['filename'], $r['original_name'], $r['mime'], $r['size']]
                );
            }
        }
    }

    public static function removeProjectDir(string $token): void
    {
        $dir = self::dir($token);
        foreach (glob("$dir/*") ?: [] as $file) {
            unlink($file);
        }
        if (is_dir($dir)) {
            rmdir($dir);
        }
        if (is_dir(SSM_UPLOADS . "/$token")) {
            rmdir(SSM_UPLOADS . "/$token");
        }
    }

    /** Absolute folder; the "assets/" name matches the path used in the export. */
    public static function dir(string $token): string
    {
        return SSM_UPLOADS . "/$token/assets";
    }

    private static function uniqueName(string $dir, string $original, string $ext): string
    {
        $stem = strtolower(pathinfo($original, PATHINFO_FILENAME));
        $stem = trim((string) preg_replace('/[^a-z0-9]+/', '-', $stem), '-') ?: 'file';
        $stem = substr($stem, 0, 120);
        $name = "$stem.$ext";
        for ($i = 2; file_exists("$dir/$name"); $i++) {
            $name = "$stem-$i.$ext";
        }
        return $name;
    }

    private static function present(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'filename' => $row['filename'],
            'originalName' => $row['original_name'],
            'mime' => $row['mime'],
            'size' => (int) $row['size'],
            'path' => 'assets/' . $row['filename'],
        ];
    }
}
