# Build with bun (matches bun.lock), run the standalone output with node.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
ENV BETTER_AUTH_SECRET="build-only-secret-not-used-at-runtime-000000" \
    BETTER_AUTH_URL="http://localhost" \
    DATABASE_URL="postgres://localhost/songdraw"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build
# Bundled to a single file because the runner is Next's `standalone` output,
# where drizzle-kit isn't installed and drizzle-orm isn't even resolvable — it's
# compiled into the server bundle. See scripts/migrate.ts.
RUN bun build scripts/migrate.ts --target=node --outfile=migrate.mjs

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/fly-cron.mjs ./fly-cron.mjs
# The migrator and the SQL it applies. `drizzle/` has to ship too — the migrator
# reads the .sql files and meta/_journal.json at run time.
COPY --from=builder --chown=nextjs:nodejs /app/migrate.mjs ./migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY app-entrypoint.sh ./app-entrypoint.sh
RUN chmod +x ./app-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./app-entrypoint.sh"]
