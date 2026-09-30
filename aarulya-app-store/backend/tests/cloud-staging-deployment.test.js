import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root=new URL('../../',import.meta.url);
const source=async(path)=>readFile(new URL(path,root),'utf8');

test('Cloud staging bundle generator is exact-head, digest-pinned and fail-closed',async()=>{
  const generator=await source('deploy/generate-aarulya-cloud-staging-bundle.mjs');
  const verifier=await source('deploy/verify-aarulya-cloud-staging-bundle.mjs');
  assert.match(generator,/AARULYA_CLOUD_EXACT_HEAD/);
  assert.match(generator,/AARULYA_STORE_STAGING_BACKEND_IMAGE/);
  assert.match(generator,/NON_PRODUCTION/);
  assert.match(generator,/FILE_REFERENCES_ONLY/);
  assert.match(generator,/policyAuthorization:null/);
  assert.match(generator,/ONE_SHOT_GOVERNED_JOB/);
  assert.match(generator,/publicIngressEnabled:false/);
  assert.match(verifier,/INLINE_SECRET_DENIED/);
  assert.match(verifier,/POLICY_AUTHORIZATION_MUST_BE_CLOUD_ISSUED/);
  assert.match(verifier,/DATABASE_BOOTSTRAP_JOBS_REQUIRED/);
});

test('Cloud staging bundle declares every required Store runtime role',async()=>{
  const generator=await source('deploy/generate-aarulya-cloud-staging-bundle.mjs');
  for(const role of ["workload('api'","workload('worker'","workload('downloads'","workload('evidence'","workload('edge'"]){
    assert.ok(generator.includes(role),role);
  }
  assert.match(generator,/jobId:'migrate'/);
  assert.match(generator,/jobId:'seed-catalog'/);
  assert.match(generator,/aarulya-aarulya-store-internal/);
});

test('staging backend image includes storefront assets and private edge entrypoint',async()=>{
  const dockerfile=await source('backend/Dockerfile');
  const edge=await source('backend/src/cloud-staging-edge.js');
  assert.match(dockerfile,/\/app\/storefront/);
  assert.match(dockerfile,/policies \/app\/storefront\/policies/);
  assert.match(edge,/aarulya-store-cloud-staging-edge/);
  assert.match(edge,/canonical-internal-store-api-origin-required/);
  assert.match(edge,/untrusted-store-host/);
  assert.match(edge,/static-path-escape-denied/);
  assert.match(edge,/redirect: 'manual'/);
});


test('staging image builder requires exact clean source and rootless immutable image identity', async () => {
  const builder = await source('deploy/build-cloud-staging-image.sh');
  assert.match(builder, /rootless-build-required/);
  assert.match(builder, /exact-source-head-mismatch/);
  assert.match(builder, /tracked-source-not-clean/);
  assert.match(builder, /org\.opencontainers\.image\.revision/);
  assert.match(builder, /IMAGE_ID=.*sha256/);
  assert.match(builder, /PRODUCTION_DEPLOYED=false/);
});
