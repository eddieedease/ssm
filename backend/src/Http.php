<?php
declare(strict_types=1);

final class ApiError extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

final class Http
{
    /** Sends a JSON response and ends the request. */
    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    /** @return array<string, mixed> */
    public static function body(): array
    {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new ApiError(400, 'Invalid JSON body.');
        }
        return $data;
    }

    public static function str(array $data, string $key, int $max = 255): string
    {
        $value = $data[$key] ?? '';
        if (!is_string($value)) {
            throw new ApiError(422, "Field '$key' must be text.");
        }
        $value = trim($value);
        if (strlen($value) > $max) {
            throw new ApiError(422, "Field '$key' is too long.");
        }
        return $value;
    }
}
