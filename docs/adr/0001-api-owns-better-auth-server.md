# API owns the Better Auth server

`apps/api` is the single host for Better Auth server configuration and routes because it already owns authenticated APIs, tenancy enforcement, and persistence-facing application boundaries. `apps/web` uses the Better Auth client rather than hosting auth itself, avoiding split ownership of sessions and Organization access at the cost of configuring browser-to-API cookies and trusted origins explicitly.
