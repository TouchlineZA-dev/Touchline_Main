# Not deployed

Netlify only publishes functions from the directory named in `netlify.toml`
(`functions = "netlify/functions"`). Files here are parked, not live.

Both of these write to the database and **have no authentication**. They were
written during the fantasy scope and must not go back into `netlify/functions/`
until a caller's identity is verified — a function is publicly reachable at
`/.netlify/functions/<name>` even with no redirect pointing at it, so simply
leaving a route out of `netlify.toml` does not protect it.

## gameweeks.js

`GET` lists gameweeks; `POST` seeds `app.gameweeks` from the fixture calendar.
The seed is idempotent (409s once rows exist) and the logic is still correct.

Before re-enabling: gate `POST` behind an admin check. The `GET` half is safe to
split out into a read-only function whenever the frontend needs it.

## users.js

Creates an `app.users` row for a Firebase-authenticated email.

**Obsolete as written** — Firebase was removed from the project, so the whole
premise (bridge an external identity provider into `app.users`) no longer
applies. Real auth needs password hashing and token issuing, which is a
different design. Kept only for the username-collision handling, which is
reusable.
