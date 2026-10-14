# Can I Run It?

Can my PC run this game? Compares your PC with the system requirements PC games publish on Steam, component by component, with an honest verdict: below, borderline, minimum, recommended, or "can't tell" — never a false ✅.

Static Angular app, hosted for free on Cloudflare (Workers static assets). All data is built ahead of time by a Node pipeline and versioned as JSON in `data/`. Design decisions: [`docs/DESIGN.md`](docs/DESIGN.md).

## Layout

| Path                 | What                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`           | Angular app: game search, "My PC" (GPU detected through WebGL), game page with verdicts. French and English (Transloco). |
| `apps/data-pipeline` | Builds `data/`: hardware catalog with gaming scores from Wikipedia, game requirements from Steam.                        |
| `libs/domain`        | Shared by both: requirement types, hardware name resolution, verdict rules, search.                                      |
| `data`               | Generated data — see [`data/README.md`](data/README.md) for sources and licences.                                        |

## Development

Commands run inside the project's devbox (`mmadb exec "<command>"`), or directly with Node ≥ 24.

```bash
npm start                            # dev server (port 4200 in the devbox)
npx nx run-many -t test              # all tests
npx nx run web:build                 # production build → dist/apps/web/browser
```

## Data pipeline

```bash
npx nx run data-pipeline:build-hardware   # Wikipedia → data/hardware (needs PIPELINE_CONTACT)
npx nx run data-pipeline:build-games      # Steam → data/games (--limit=N, default 1000)
npx nx run data-pipeline:calibrate-gpus   # refit GPU scores after editing gpu-anchors.ts
```

- `PIPELINE_CONTACT` (in `.env`, never committed) is the contact Wikimedia requires in the User-Agent.
- Downloads are rate-limited and cached in `.cache/pipeline`; reports of rejected rows and unresolved names land there too.
- Hand corrections: `apps/data-pipeline/hardware-overrides.json` (hardware), `apps/data-pipeline/extra-games.json` (games to add).

## Deployment

`.github/workflows/deploy.yml` tests, builds and deploys to Cloudflare on every push to `main`, and every Monday refreshes the data first and commits it. Hosting is configured in `wrangler.jsonc` (static assets only, so requests are never billed) and `apps/web/public/_headers` (cache rules). It needs these repository secrets:

- `CLOUDFLARE_API_TOKEN`: an account API token with the "Edit Cloudflare Workers" template;
- `CLOUDFLARE_ACCOUNT_ID`;
- `PIPELINE_CONTACT`: the contact Wikimedia requires in the pipeline's User-Agent.

## Licences

Code: MIT. `data/hardware`: CC BY-SA 4.0 (derived from Wikipedia). `data/games`: requirement data © their publishers, via Steam. Not affiliated with Valve.
