# Object storage — Cloudflare R2

Profile pictures live in a Cloudflare R2 bucket (S3-compatible). R2 is used in
every environment, including local dev — there is no self-hosted storage
container. The code is provider-neutral (`lib/storage.ts`, plain `@aws-sdk/client-s3`);
swapping `S3_*` env vars points it at any S3-compatible service.

## One-time setup

1. **Create the bucket** in the Cloudflare dashboard → R2 → *Create bucket*
   (e.g. `songdraw-avatars`). Location hint is fine on default.
2. **Make it publicly readable.** R2 has no `PutBucketPolicy`, so this is
   dashboard-only:
   - *Settings → Public access → Custom Domains* → connect a domain
     (e.g. `avatars.roddickshare.space`). This is what `S3_PUBLIC_URL` must be.
   - Or enable the *r2.dev subdomain* for a throwaway public URL and use that
     as `S3_PUBLIC_URL` (rate-limited; fine for dev, not prod).
3. **Create an API token** → R2 → *Manage R2 API Tokens* → *Create API token*,
   scoped to *Object Read & Write* on that bucket. Copy the Access Key ID and
   Secret Access Key.
4. **Find your account ID** (R2 overview page). The S3 endpoint is
   `https://<account-id>.r2.cloudflarestorage.com`.

## Env vars

| Var | Value |
|---|---|
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | API token Access Key ID |
| `S3_SECRET_ACCESS_KEY` | API token Secret Access Key |
| `S3_BUCKET` | bucket name, e.g. `song-draw` |
| `S3_PUBLIC_URL` | public base objects are served from, no trailing slash — see below |

Object keys are `avatars/<user-id>/<uuid>.<ext>`; the browser-facing URL is
`${S3_PUBLIC_URL}/avatars/<user-id>/<uuid>.<ext>`. `deleteAvatarIfOwned` only
removes URLs under `S3_PUBLIC_URL`, so dicebear seed avatars are never touched.

### Getting `S3_PUBLIC_URL` right

The code appends `/avatars/...` to `S3_PUBLIC_URL` — nothing else. So the value
depends on what your public host resolves to:

- **R2 custom domain bound straight to the bucket** (dashboard → bucket →
  Settings → Custom Domains): the domain *is* the bucket root, so
  `S3_PUBLIC_URL=https://avatars.roddickshare.space` and objects sit at
  `https://avatars.roddickshare.space/avatars/...`.
- **Domain resolves a level above the bucket**, or you point at the r2.dev
  subdomain / the S3 endpoint: the bucket name must be in the path, so
  `S3_PUBLIC_URL=https://avatars.roddickshare.space/song-draw` and objects sit
  at `https://.../song-draw/avatars/...`.

A `404` (not `403`) on a freshly uploaded avatar almost always means the bucket
segment is missing from `S3_PUBLIC_URL`. Changing it doesn't rewrite URLs
already stored on users — those need a re-upload or an avatar shuffle.
