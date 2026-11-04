<?php
declare(strict_types=1);

// Single entry point. The route travels in ?r= so no URL rewriting is needed,
// which keeps the platform working on any shared host and in any subfolder.
require dirname(__DIR__) . '/src/bootstrap.php';

set_exception_handler(static function (Throwable $e): void {
    if ($e instanceof ApiError) {
        Http::json(['error' => $e->getMessage()], $e->status);
    }
    error_log((string) $e);
    Http::json(['error' => 'Something went wrong on the server.'], 500);
});

$route = trim((string) ($_GET['r'] ?? ''), '/');
$method = $_SERVER['REQUEST_METHOD'];

$installed = Db::configure();
if ($route === 'config' && !$installed) {
    Http::json(['installed' => false]);
}
if (!$installed) {
    throw new ApiError(503, 'The platform is not installed yet.');
}

// Browsers cannot send this header cross-site without a CORS preflight, which
// this API never grants, so it doubles as CSRF protection.
if ($method !== 'GET' && ($_SERVER['HTTP_X_SSM'] ?? '') !== '1') {
    throw new ApiError(403, 'Missing request header.');
}

Auth::startSession();

$user = static fn(): int => Auth::requireUser();

/** @var array<string, callable> $routes "METHOD pattern" => handler(captures) */
$routes = [
    'GET config' => static fn() => [
        'installed' => true,
        'siteName' => Db::config('site_name', 'Static Site Maker'),
        'allowRegistration' => (bool) Db::config('allow_registration', false),
        'user' => Auth::publicUser(Auth::userId()),
    ],
    'POST auth/register' => static fn() => Auth::register(),
    'POST auth/login' => static fn() => Auth::login(),
    'POST auth/logout' => static fn() => Auth::logout(),

    'GET projects' => static fn() => Projects::list($user()),
    'POST projects' => static fn() => Projects::create($user()),
    'GET projects/(\d+)' => static fn($id) => Projects::get($id, $user()),
    'PUT projects/(\d+)' => static fn($id) => Projects::update($id, $user()),
    'DELETE projects/(\d+)' => static fn($id) => Projects::delete($id, $user()),
    'POST projects/(\d+)/duplicate' => static fn($id) => Projects::duplicate($id, $user()),
    'POST projects/(\d+)/export' => static fn($id) => Export::zip($id, $user()),

    'GET projects/(\d+)/assets' => static fn($id) => Assets::list($id, $user()),
    'POST projects/(\d+)/assets' => static fn($id) => Assets::upload($id, $user()),
    'DELETE assets/(\d+)' => static fn($id) => Assets::delete($id, $user()),

    'GET themes' => static fn() => Themes::list($user()),
    'POST themes' => static fn() => Themes::create($user()),
    'DELETE themes/(\d+)' => static fn($id) => Themes::delete($id, $user()),
];

foreach ($routes as $key => $handler) {
    [$verb, $pattern] = explode(' ', $key, 2);
    if ($verb === $method && preg_match("#^$pattern$#", $route, $m)) {
        Http::json($handler(...array_map('intval', array_slice($m, 1))));
    }
}
throw new ApiError(404, 'Unknown API route.');
