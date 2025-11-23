# Home Asssistant Wishlist Add-on

Static Go web server that serves a Christmas wishlist frontend for Home Assistant or any static hosting setup.  
All runtime data lives in `/data` inside the container/host so restarts are safe.

## Features

- Separate wishlist per family member with portrait-driven navigation (`index.html` + `wishes.js`).
- Optional admin interface (`admin.html` + `admin.js`) for creating, updating, and deleting wishes.
- Fancy snow canvas overlay (`snow.js`) and lightweight styling in `styles/`.
- JSON persistence with optimistic caching on the client.

## Architecture Overview

| Layer            | Files                                     | Notes                                                  |
| ---------------- | ----------------------------------------- | ------------------------------------------------------ |
| Public frontend  | `index.html`, `styles/`, `wishes.js`      | Read-only view backed by `/api/wishes` + reservations. |
| Admin frontend   | `admin.html`, `admin.js`                  | Only load for trusted users; talks to `/api/admin/*`.  |
| API server (Go)  | `main.go`                                 | Serves static assets + JSON endpoints.                 |
| Data storage     | `/data/wishes.private.json`, `/data/reservations.json` | Created automatically if missing.                     |

## Data Schema

`Wish` objects (see `main.go`) serialize to `wishes.private.json`:

```json
{
  "id": "owner-title-<timestamp>",
  "title": "Wish title",
  "url": "https://example.org",
  "price": "30 EUR",
  "owner": "lena",
  "image": "media/pic.jpg",
  "description": "Optional notes"
}
```

`Reservations` is a map `{ "<wish-id>": true }` persisted in `reservations.json`.

Images can point to `media/...` or remote URLs.

## API Endpoints

| Path                     | Method(s) | Purpose                                   |
| ------------------------ | --------- | ----------------------------------------- |
| `/api/wishes`            | GET       | Public wish list                          |
| `/api/reservation`       | GET/POST  | Reservation map (simple overwrite)        |
| `/api/admin/wishes`      | GET/POST  | Admin list + create                       |
| `/api/admin/wishes/:id`  | PUT/DELETE| Admin update/delete                       |

Route handlers live in `main.go` (`wishesHandler`, `reservationHandler`, `adminWishesHandler`).

## Quick Start (local)

```bash
# Run directly (Go ≥ 1.21)
go run .

# or build + run
GOOS=linux GOARCH=arm64 go build -o wishlist-linux-arm64 ./
./wishlist-linux-arm64
```

Local testing

```bash
go run main.go
```

Open `http://localhost:5000/` for the public view or `http://localhost:5000/admin.html` for admin (if served).

## Admin UI Hardening

- Serve `admin.html`, `admin.js`, and `/api/admin/*` only behind authentication (reverse proxy, Home Assistant ingress, VPN, etc.).
- Block `/api/admin/*` at the firewall for unauthenticated networks.
- Consider removing `admin.html` from public builds entirely when not needed.

## Deployment to Home Assistant Add-on host

Minimalstic way only supports my raspberry 5 architecture not meant to be published in any way
```bash
GOOS=linux GOARCH=arm64 go build -o wishlist-linux-arm64 ./
scp -r * root@192.168.178.28:/addons/wishlist/
```

Home Assistant mounts `/data`, so the server reads/writes JSON without extra configuration.

## Housekeeping / Git Hygiene

- Keep `/data` and `/media` out of Git (already excluded) to avoid leaking private wishes or large assets.
- Ensure binaries like `wishlist-linux-arm64` stay untracked (`git ls-files wishlist-linux-arm64` should return nothing).
- Review `config.yaml` or other deployment descriptors before publishing to ensure no internal IPs or credentials are exposed.