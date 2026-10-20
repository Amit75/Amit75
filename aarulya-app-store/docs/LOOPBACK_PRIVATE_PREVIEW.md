# Aarulya Store: first private loopback preview

This is a **working but deliberately limited local staging preview**, not AARULYA Cloud-managed staging acceptance and not a production release.

## Safety

- Store runtime source: pinned head `a007331b09572bb6932cc4df439102ecd9b8145e`.
- Uses the already-built, immutable rootless Podman image from `/var/tmp/aarulya-store-fixed.IA2miyS0`.
- Creates **only** a dedicated rootless Podman internal network and the Store static edge container.
- Publishes **only** `127.0.0.1:18940`, never `0.0.0.0` or a public port.
- Network is `--internal`; no database, production identity, hosted downloads or internet access is provided.
- User remains `10001:10001`, with a read-only filesystem and no added capabilities.
- The existing Cloud Docker containers, other Podman networks, Caddy reverse proxy, TLS, DNS and production data are untouched.
- Exact image digest and source revision are checked before startup. Existing resources are not replaced.
- If startup probes fail, **only newly created preview resources** are removed. Resources that existed before this command are never changed.

## Start

Run as `admin1` on the Aarulya host from a clean checkout of this branch:

```bash
bash aarulya-app-store/deploy/start-loopback-private-preview.sh
```

The script prints `AARULYA_STORE_PRIVATE_PREVIEW=PASS` only after verifying health, HTML output, untrusted-host rejection, binding and image identity.

## Inspect

```bash
podman ps --filter name=aarulya-store-private-preview-edge
curl --noproxy '*' -fsS http://127.0.0.1:18940/health
curl --noproxy '*' -fsS -H 'Host: store.aarulya.com' http://127.0.0.1:18940/ | head
```

To access safely from a laptop, use an SSH local port forward and a request with the required Host header. This preview is HTTP **only on loopback**; do not publish it on external interfaces or use real user credentials.

## Shutdown (requires separate operator action)

```bash
podman rm -f aarulya-store-private-preview-edge
podman network rm aarulya-store-private-preview-v1
```

## What remains blocked

This preview confirms only static Storefront delivery and a bounded edge process. It is **not** evidence that authenticated Store API, Postgres, account sign-in, downloads, update/rollback, user installation, backup/restore or AARULYA Cloud governed staging are working. Those require separate isolated stages, an internal OIDC/test issuer, dedicated database credentials and owner-authorized controls. The source's canonical production hostnames must **not** be mapped to public production services to make tests pass. Production promotion remains prohibited without an explicit, digest-bound release approval.
