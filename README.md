# Static Site Maker

A platform where users log in, build static websites with drag-and-drop
components and custom themes, and export them as plain HTML, CSS and JavaScript
to upload with any FTP client (FileZilla, for example). It is aimed at single
page apps and simple sites.

- **Frontend:** Angular (zoneless, signals) and Tailwind, in `frontend/`
- **Backend:** plain PHP 8.1+ and MySQL with no Composer dependencies, in `backend/`
- **Hosting:** runs on ordinary shared hosting, set up through a web installer

## Development

Start the backend (PHP/Apache, MySQL, phpMyAdmin):

```bash
docker compose up -d --build
```

Start the frontend:

```bash
cd frontend && npm install && npm start
```

| What | Where |
| --- | --- |
| App (`ng serve`, proxies to PHP) | http://localhost:4200 |
| Web installer | http://localhost:4200/install/ |
| PHP backend | http://localhost:8080 |
| phpMyAdmin | http://localhost:8081 |
| MySQL from the host | `localhost:3307`, user `ssm`, password `ssm` |

On first run the app sends you to the installer; the database fields are
prefilled in development. To reinstall, delete `backend/config/config.php` and
drop the tables in phpMyAdmin.

## Releasing to shared hosting

```bash
./scripts/build-release.sh
```

1. Upload `release/site/` (or unpack `release/static-site-maker.zip`) to your
   host. Any folder works, including a subfolder.
2. Make `config/` and `uploads/` writable.
3. Open `/install/` in the browser and follow the steps.
4. Delete the `install/` folder.

The host needs PHP 8.1+ with `pdo_mysql`, `zip` and `fileinfo`, MySQL or
MariaDB, and `.htaccess` support. The installer checks the PHP parts.

To rehearse an upload locally, in a subfolder:

```bash
docker compose --profile release up -d --build release
```

Then open http://localhost:8090/my-site/. The rehearsal writes its config and
uploads into `release/site/`, so run the build script again before a real upload.

## How it fits together

- A site is one JSON document (pages, theme, settings) stored per project. The
  editor autosaves it with a revision number, so a second open tab can't
  silently overwrite the first.
- `frontend/src/app/engine/` is the only renderer. The canvas, the preview and
  the export all use it, so what you see is what you export. To add a component,
  add an entry to `BLOCKS` in `engine/blocks.ts`.
- The canvas is an iframe sandboxed without scripts, with an overlay handling
  selection and drag and drop. Custom HTML therefore can't reach the platform.
- Uploads are stored at `uploads/<token>/assets/` and referenced as
  `assets/name.png`, the same path they have in the export.
- API routes use `api/index.php?r=…` and the app uses hash routes, so neither
  needs URL rewriting.
