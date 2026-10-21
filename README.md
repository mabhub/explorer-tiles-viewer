# Explorer tiles viewer

A map of [Statshunters](https://www.statshunters.com) explorer tiles shared by
several people. Paste the share links of a few accounts and every zoom-14 tile
gets colored by how many of them visited it.

The interface is in French.

## Features

- **Several color modes**: number of people (1, 2, 3 or more), owner (one
  color per person), age of the latest visit, or number of activities.
- **Tile popup**: who visited a tile and with which activities, with links to
  Strava.
- **Activity lines**: the simplified tracks of a share, when its owner allows
  it. Hover or click a line to see its activity.
- **Tracks**: add GPX or GeoJSON files. They are drawn on the map and color the
  unvisited tiles they cross, which helps when planning a ride.
- **Max areas**: largest square, row and column of each person.
- **[squadrats.com](https://squadrats.com) exports**: show the squadratinhos
  (zoom-17 tiles) of an account, and compare its squadrats with that person's
  Statshunters tiles.
- **Basemaps**: several basemaps, including Thunderforest ones when an API key
  is set.

Shares, tracks and settings stay in the browser (localStorage and IndexedDB).
Fetched activities are cached in IndexedDB for 30 days and refreshed in the
background.

## Getting started

Requires Node 24 (see `.nvmrc`).

```bash
npm install
touch .env.local   # then set the variables below
npm run dev
```

| Command         | Description                      |
|-----------------|----------------------------------|
| `npm run dev`   | Vite dev server                  |
| `npm run build` | Production build into `dist/`    |
| `npm run serve` | Preview the production build     |
| `npm run lint`  | ESLint                           |

## Configuration

Set these in `.env.local` (ignored by git) or in your hosting settings:

| Variable                   | Required | Description |
|----------------------------|----------|-------------|
| `VITE_DEFAULT_MAPSTYLE`    | yes      | MapLibre style URL of the default basemap |
| `VITE_ACTIVITIES_ENDPOINT` | yes      | Activities API, with an `{{id}}` placeholder for the share id |
| `VITE_ACCOUNT_ENDPOINT`    | no       | Account API (`{{id}}` placeholder). Without it, shares are listed by id |
| `VITE_LINES_ENDPOINT`      | no       | Activity lines API (`{{id}}` placeholder). Without it or the account API, no lines are offered |
| `VITE_THUNDERFOREST_KEY`   | no       | [Thunderforest](https://www.thunderforest.com) API key. Without it, their basemaps are hidden |

## Backend API

The viewer does not call Statshunters directly. It expects a small API, run
as serverless functions in a separate project, that answers:

- `<VITE_ACTIVITIES_ENDPOINT>/<page>` →
  `{ activities: [{ id, user_id, tiles: [{ x, y }], foreignId, name, date, type }], nextPage }`
- `<VITE_ACCOUNT_ENDPOINT>` → `{ id, firstname, lastname, lines }`
- `<VITE_LINES_ENDPOINT>/<page>` →
  `{ lines: [<encoded polyline>], ids: [<activity id>], nextPage }`

Pages start at 1, and `nextPage` is `null` on the last one. The API answers
404 for an unknown or revoked share (not retried) and 502 or 504 when
Statshunters fails or is too slow (retried).

## Stack

React 18, Vite 4, MUI 5, MapLibre GL 6 through
[`@vis.gl/react-maplibre`](https://visgl.github.io/react-maplibre/), TanStack
Query 4.

## License

[MIT](LICENSE)
