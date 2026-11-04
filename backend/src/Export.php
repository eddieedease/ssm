<?php
declare(strict_types=1);

/**
 * Bundles the pages rendered by the editor with the project's assets into a
 * ZIP that can be unpacked and uploaded with any FTP client.
 */
final class Export
{
    public static function zip(int $projectId, int $userId): never
    {
        $project = Projects::owned($projectId, $userId);
        $files = Http::body()['files'] ?? null;
        if (!is_array($files) || $files === []) {
            throw new ApiError(422, 'Nothing to export.');
        }
        if (!class_exists(ZipArchive::class)) {
            throw new ApiError(500, 'The PHP zip extension is not available on this server.');
        }

        $path = tempnam(sys_get_temp_dir(), 'ssm');
        $zip = new ZipArchive();
        if ($path === false || $zip->open($path, ZipArchive::OVERWRITE) !== true) {
            throw new ApiError(500, 'Could not create the export archive.');
        }

        foreach ($files as $name => $content) {
            // Flat file names only, so nothing can escape the export root.
            if (!is_string($content) || !preg_match('/^[a-z0-9][a-z0-9._-]*\.(html|css|js|txt)$/', (string) $name)) {
                $zip->close();
                @unlink($path);
                throw new ApiError(422, 'Invalid export file name.');
            }
            $zip->addFromString((string) $name, $content);
        }

        $rows = Db::all('SELECT filename FROM ' . Db::t('assets') . ' WHERE project_id = ?', [$projectId]);
        foreach ($rows as $row) {
            $source = Assets::dir($project['token']) . '/' . $row['filename'];
            if (is_file($source)) {
                $zip->addFile($source, 'assets/' . $row['filename']);
            }
        }
        $zip->close();

        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($project['name'])), '-') ?: 'site';
        header('Content-Type: application/zip');
        header("Content-Disposition: attachment; filename=\"$slug.zip\"");
        header('Content-Length: ' . filesize($path));
        readfile($path);
        unlink($path);
        exit;
    }
}
