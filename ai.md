# How I used AI in FieldWise

**Name:** Himanshu Singh · **Roll:** 21F1003237

Here’s how I estimated AI share. I treat the codebase as three slices by how big each slice feels in this project: **frontend ~40%**, **backend ~50%**, **infra ~10%**. Inside each slice I guess how much Cursor actually contributed (0–100%), multiply by that slice’s weight, then **sum** → one overall percentage. That lands **under 20%**.

**Tool:** Almost always **Cursor** (chat + completions). I **read diffs**, **fixed bugs**, and **ran the app myself**—nothing like pasting a prompt and shipping whatever came back.

---

## Frontend (React / Vite) — weight **40%** total for this band

In my repo that mostly means `frontend/src/components`, `frontend/src/pages`, `frontend/src/lib/api.ts`, `frontend/src/context`, `frontend/src/hooks`, plus `App.tsx` / `main.tsx`.

| Module          | What it covers                                   | Weight (%) | My gut feel for AI share | Points toward total |
| --------------- | ------------------------------------------------ | ---------- | ------------------------ | ------------------- |
| Components      | UI bits, map wrappers, layout                    | 10         | ~22%                     | **2.2**             |
| Pages           | Screens for farmer / agronomist / admin / browse | 15         | ~8%                      | **1.2**             |
| Services / API  | Typed helpers talking to my backend              | 5          | ~18%                     | **0.9**             |
| Context / hooks | Auth context, small hooks                        | 5          | ~26%                     | **1.3**             |
| Main setup      | Router wiring, bootstrap                         | 5          | basically none           | **0**               |

**My frontend total:** **~5.6%**

Cursor helped most where JSX and layout get repetitive; routing and behaviour were mostly mine.

---

## Backend (Express + TypeORM) — weight **50%**

Handlers live in `routes/*.ts` (there’s no separate `controllers/` folder), so **route handlers** in the table below are what I’d call the controller layer.

| Module                         | What it covers                 | Weight (%) | My gut feel for AI share | Points toward total |
| ------------------------------ | ------------------------------ | ---------- | ------------------------ | ------------------- |
| Entities                       | TypeORM models                 | 10         | I typed these myself     | **0**               |
| Route handlers (“controllers”) | auth, fields, advisories, etc. | 15         | ~13%                     | **2.0**             |
| Services                       | matching + weather helpers     | 10         | ~11%                     | **1.1**             |
| Route mounting                 | how `app.ts` wires paths       | 5          | mine                     | **0**               |
| Middleware                     | JWT guard, errors              | 5          | mine                     | **0**               |
| Utils                          | JWT, passwords, small helpers  | 5          | ~22%                     | **1.1**             |

**My backend total:** **~4.2%**

The tricky bit—**matching fields to advisories with Turf**, when to recompute, caches—I worked through and coded myself so it matched how geometries are actually stored.

---

## Infrastructure — weight **10%**

| Module                              | Weight (%) | AI share | Points |
| ----------------------------------- | ---------- | -------- | -----: |
| TypeORM / Postgres config           | 4          | 0%       |  **0** |
| Redis helpers                       | 3          | 0%       |  **0** |
| Express boot (`app.ts`, `index.ts`) | 3          | 0%       |  **0** |

**Infra total:** **0%** — I didn’t lean on AI here.

---

## Documentation & write-ups (extra row — where AI helped me most)

The breakdown above is code-shaped; **prose is different**. README polish, `FINAL_APP_DEV_REPORT.md`, this file, and a few ASCII diagrams are where Cursor actually saved the most time, so I’m counting them **explicitly** instead of burying that inside “frontend.”

| What                                    | Why I’m counting it          | Nominal weight (%) | AI share |   Points |
| --------------------------------------- | ---------------------------- | ------------------ | -------- | -------: |
| README, final report, `ai.md`, comments | drafting / structure / edits | **9**              | ~88%     | **~7.9** |

Separate row so the numbers don’t hide how much editing help went into submission text.

---

## Totals

| Bucket                    |     Points |
| ------------------------- | ---------: |
| Frontend                  |       ~5.6 |
| Backend                   |       ~4.2 |
| Infrastructure            |         ~0 |
| Docs / submission writing |       ~7.9 |
| **Sum**                   | **~17.7%** |

In the report I say **about 18–19%** and **≤ 19%** so it’s clearly **under 20%**.

---

## What I did _not_ outsource to AI

- Choosing **map-first matching**, storing GeoJSON in JSONB, and skipping PostGIS on purpose.
- Designing **`field_advisory_matches`** and when recomputation runs.
- Sitting with **MapLibre + draw** bugs until overlays behaved.
- Testing flows end-to-end and fixing what broke.

---

## One-line summary

I used **Cursor** mostly for **documentation** and **occasional UI / small refactors**. Core backend logic, spatial matching, auth, and testing were **mine**. Weighted total: **roughly 18–19%**, **under 20%**.
