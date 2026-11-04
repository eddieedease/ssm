<?php
declare(strict_types=1);

define('SSM_ROOT', dirname(__DIR__));
define('SSM_CONFIG_FILE', SSM_ROOT . '/config/config.php');
define('SSM_UPLOADS', SSM_ROOT . '/uploads');

require __DIR__ . '/Http.php';
require __DIR__ . '/Db.php';
require __DIR__ . '/Auth.php';
require __DIR__ . '/Projects.php';
require __DIR__ . '/Assets.php';
require __DIR__ . '/Themes.php';
require __DIR__ . '/Export.php';
