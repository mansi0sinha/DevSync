# DevSync client

React and Vite frontend for the DevSync collaborative engineering workspace.

## Development

1. Install dependencies with `npm install`.
2. Start the API from `../server` with `npm run dev`.
3. Start the client with `npm run dev`.

The local API defaults to `http://localhost:5000/api`. To use another API origin, set `VITE_API_BASE_URL` in an ignored local `.env` file. Production builds require an HTTPS `VITE_API_BASE_URL`; see `.env.production.example` for the variable name and format. Never put server credentials in a `VITE_*` variable.

## Checks

- `npm run lint`
- `npm run build`
