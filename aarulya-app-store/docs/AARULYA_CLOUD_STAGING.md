# Aarulya Store on Aarulya Cloud — private staging

This path is deliberately **non-public**. A staging bundle never publishes public DNS or host ports and never grants production authority.

## Exact artifacts

The Store source must be a clean exact Git commit. `build-cloud-staging-image.sh` runs under the same non-root container-runtime identity used for Cloud workloads and builds the Store backend plus immutable storefront assets. The resulting local `sha256:<image-id>` is accepted as the staging artifact only when it matches the bundle artifact digest.

The previous known-good immutable image ID is supplied separately as the rollback image. Neither current nor rollback image may be mutable tags in the generated bundle.

## Runtime roles

The staging bundle defines five long-running private workloads: API, worker, downloads, evidence and storefront edge. Database migration and catalog seeding are two separate governed one-shot jobs. Migration credentials therefore never need to exist in the long-running API or worker.

All secrets are mounted read-only from `/var/lib/aarulya-cloud/secrets/aarulya-store/` into `/opt/aarulya/secrets/`. Secret values do not belong in GitHub, bundle JSON, logs or chat.

## Execution order

1. Verify exact Store and Cloud heads.
2. Build and pin the local Store image.
3. Verify current and rollback artifact IDs.
4. Generate and verify the private staging bundle.
5. Aarulya Cloud registers and schedules `migrate` as a `job`.
6. Cloud issues an operation-bound workload policy authorization and prepares its exact plan.
7. The rootless one-shot executor requires exit code 0 and a durable `COMPLETED` receipt.
8. Repeat for `seed-catalog`.
9. Register, authorize and start API, worker, downloads, evidence and edge on the project-dedicated internal network.
10. Accept staging only after bound health plus backup/restore and rollback evidence pass.

A built image, generated bundle, STARTED container, or successful migration is not by itself staging acceptance. Staging acceptance is still not production deployment.
