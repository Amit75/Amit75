import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const SHA40=/^[a-f0-9]{40}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const IMAGE=/^(?:sha256:[a-f0-9]{64}|[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?@sha256:[a-f0-9]{64})$/i;
const ID=/^[A-Za-z0-9._:-]{3,128}$/;

function required(name) {
  const value=String(process.env[name]||'').trim();
  if(!value) throw new Error(name+'_REQUIRED');
  return value;
}
function id(name) {
  const value=required(name);
  if(!ID.test(value)) throw new Error(name+'_INVALID');
  return value;
}
function digest(name) {
  const value=required(name).toLowerCase();
  if(!DIGEST.test(value)) throw new Error(name+'_INVALID');
  return value;
}
function image(name) {
  const value=required(name).toLowerCase();
  if(!IMAGE.test(value)) throw new Error(name+'_IMMUTABLE_IMAGE_REQUIRED');
  return value;
}
function imageDigest(value) {
  return value.startsWith('sha256:') ? value : value.slice(value.lastIndexOf('@')+1);
}
function git(repoRoot,...args) {
  return execFileSync('git',['-C',repoRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

const repoRoot=resolve(new URL('../..',import.meta.url).pathname);
const exactHead=git(repoRoot,'rev-parse','HEAD').toLowerCase();
if(!SHA40.test(exactHead)) throw new Error('EXACT_SOURCE_HEAD_INVALID');
const expected=required('AARULYA_STORE_SOURCE_COMMIT').toLowerCase();
if(expected!==exactHead) throw new Error('EXACT_SOURCE_HEAD_MISMATCH');
if(git(repoRoot,'status','--porcelain=v1','--untracked-files=no')) throw new Error('TRACKED_SOURCE_NOT_CLEAN');

const backendImage=image('AARULYA_STORE_STAGING_BACKEND_IMAGE');
const rollbackImage=image('AARULYA_STORE_STAGING_ROLLBACK_IMAGE');
const artifactDigest=imageDigest(backendImage);
const rollbackArtifactDigest=imageDigest(rollbackImage);
const cloudExactHead=required('AARULYA_CLOUD_EXACT_HEAD').toLowerCase();
if(!SHA40.test(cloudExactHead)) throw new Error('AARULYA_CLOUD_EXACT_HEAD_INVALID');
const nodeId=id('AARULYA_CLOUD_TARGET_NODE_ID');

const secretSource=(name)=>'/var/lib/aarulya-cloud/secrets/aarulya-store/'+name;
const secretTarget=(name)=>'/opt/aarulya/secrets/'+name;
const secret=(name)=>({name,source:secretSource(name),target:secretTarget(name)});

const commonEnvironment={
  NODE_ENV:'production',
  AARULYA_ENV:'production',
  HOST:'0.0.0.0',
  AARULYA_PRIVATE_CONTAINER_NETWORK:'true',
  AARULYA_DATABASE_SSL_MODE:'verify-full',
  AARULYA_OIDC_ISSUER:'https://identity.aarulya.com',
  AARULYA_OIDC_AUDIENCE:'aarulya-store-api',
  AARULYA_OIDC_JWKS_URI:'https://identity.aarulya.com/.well-known/jwks.json',
  AARULYA_OIDC_ALGORITHMS:'EdDSA,ES256,PS256,RS256',
  AARULYA_OIDC_CLOCK_TOLERANCE_SECONDS:'60'
};

function workload(workloadId,command,environment={},secrets=[],volumes=[],resources={cpuMillis:500,memoryMiB:512,gpuMemoryMiB:0}) {
  return {
    projectId:'aarulya-store',
    workloadId,
    nodeId,
    sourceCommit:exactHead,
    artifactDigest,
    imageRef:backendImage,
    computeClass:'cpu',
    resources,
    command,
    environment:{...commonEnvironment,...environment},
    volumes,
    secrets,
    policyAuthorization:null
  };
}

const bundle={
  schemaVersion:1,
  kind:'AARULYA_STORE_CLOUD_NONPROD_STAGING_BUNDLE',
  generatedAt:new Date().toISOString(),
  cloudExactHead,
  manifest:{
    projectId:'aarulya-store',
    repository:'Amit75/Amit75',
    sourceRef:'agent/aarulya-app-store-foundation',
    sourceCommit:exactHead,
    artifactDigest,
    rollbackArtifactDigest,
    computeClass:'cpu',
    domains:['store.aarulya.com','api.store.aarulya.com','downloads.store.aarulya.com','evidence.store.aarulya.com'],
    backupPolicyId:'aarulya-store-staging-backup-v1',
    deploymentMode:'AARULYA_CLOUD_MANAGED',
    directHostDeployment:false,
    rawHostDockerSocket:false,
    crossProjectDatabaseJoin:false,
    secretDeliveryMode:'FILE_REFERENCES_ONLY',
    runtimeIsolation:'PROJECT_DEDICATED',
    sourceVerificationReceiptDigest:digest('AARULYA_SOURCE_VERIFICATION_RECEIPT_DIGEST'),
    releaseEvidenceDigest:digest('AARULYA_RELEASE_EVIDENCE_DIGEST'),
    networkPolicyId:'aarulya-store-private-staging-v1',
    healthPolicyId:'aarulya-store-staging-health-v1'
  },
  target:{
    nodeId,
    environment:'NON_PRODUCTION',
    configurationDigest:digest('AARULYA_STAGING_CONFIGURATION_DIGEST'),
    runtimePolicyDigest:digest('AARULYA_STAGING_RUNTIME_POLICY_DIGEST'),
    backupRestoreEvidenceDigest:digest('AARULYA_BACKUP_RESTORE_EVIDENCE_DIGEST'),
    rollbackPlanDigest:digest('AARULYA_ROLLBACK_PLAN_DIGEST')
  },
  bootstrapJobs:[
    {
      jobId:'migrate',
      executionKind:'ONE_SHOT_GOVERNED_JOB',
      imageRef:backendImage,
      artifactDigest,
      sourceCommit:exactHead,
      command:['src/migrate.js'],
      environment:{
        ...commonEnvironment,
        AARULYA_DATABASE_URL_FILE:secretTarget('migrator-database-url'),
        AARULYA_DATABASE_APP_NAME:'aarulya-store-staging-migrations',
        AARULYA_DATABASE_POOL_MAX:'1'
      },
      secrets:[secret('migrator-database-url')],
      mustSucceedBefore:['seed-catalog','api','worker','downloads']
    },
    {
      jobId:'seed-catalog',
      executionKind:'ONE_SHOT_GOVERNED_JOB',
      imageRef:backendImage,
      artifactDigest,
      sourceCommit:exactHead,
      command:['src/seed-catalog.js'],
      environment:{
        ...commonEnvironment,
        AARULYA_DATABASE_URL_FILE:secretTarget('migrator-database-url'),
        AARULYA_DATABASE_APP_NAME:'aarulya-store-staging-catalog-seed',
        AARULYA_DATABASE_POOL_MAX:'1',
        AARULYA_SOURCE_COMMIT_SHA:exactHead
      },
      secrets:[secret('migrator-database-url')],
      mustSucceedBefore:['api','worker']
    }
  ],
  workloads:[
    workload('api',['src/server.js'],{
      PORT:'8080',
      AARULYA_PUBLIC_ORIGIN:'https://api.store.aarulya.com',
      AARULYA_DATABASE_URL_FILE:secretTarget('api-database-url'),
      AARULYA_PUBLISHER_DATABASE_URL_FILE:secretTarget('publisher-database-url'),
      AARULYA_DOWNLOAD_TOKEN_HMAC_KEY_FILE:secretTarget('download-token-hmac-key'),
      AARULYA_WEB_SESSION_KEY_FILE:secretTarget('web-session-key'),
      AARULYA_WEB_OIDC_CLIENT_ID:'aarulya-store-web',
      AARULYA_WEB_OIDC_REDIRECT_URI:'https://store.aarulya.com/auth/callback',
      AARULYA_DATABASE_APP_NAME:'aarulya-store-staging-api',
      AARULYA_DATABASE_POOL_MAX:'10'
    },[
      secret('api-database-url'),
      secret('publisher-database-url'),
      secret('download-token-hmac-key'),
      secret('web-session-key')
    ],[],{cpuMillis:1000,memoryMiB:1024,gpuMemoryMiB:0}),
    workload('worker',['src/worker.js'],{
      AARULYA_DATABASE_URL_FILE:secretTarget('worker-database-url'),
      AARULYA_DATABASE_APP_NAME:'aarulya-store-staging-worker',
      AARULYA_DATABASE_POOL_MAX:'5',
      AARULYA_WORKER_ID:'aarulya-store-staging-worker-01'
    },[secret('worker-database-url')],[],{cpuMillis:500,memoryMiB:512,gpuMemoryMiB:0}),
    workload('downloads',['src/artifact-server.js'],{
      PORT:'8081',
      AARULYA_ARTIFACT_MODE:'downloads',
      AARULYA_PUBLIC_ORIGIN:'https://downloads.store.aarulya.com',
      AARULYA_ARTIFACT_ROOT:'/srv/artifacts',
      AARULYA_DATABASE_URL_FILE:secretTarget('downloads-database-url'),
      AARULYA_DATABASE_APP_NAME:'aarulya-store-staging-downloads',
      AARULYA_DATABASE_POOL_MAX:'5'
    },[secret('downloads-database-url')],[{
      name:'aarulya-store-staging-apk-artifacts',
      target:'/srv/artifacts',
      readOnly:true
    }]),
    workload('evidence',['src/artifact-server.js'],{
      PORT:'8082',
      AARULYA_ARTIFACT_MODE:'evidence',
      AARULYA_PUBLIC_ORIGIN:'https://evidence.store.aarulya.com',
      AARULYA_ARTIFACT_ROOT:'/srv/artifacts'
    },[],[{
      name:'aarulya-store-staging-evidence',
      target:'/srv/artifacts',
      readOnly:true
    }]),
    workload('edge',['src/cloud-staging-edge.js'],{
      PORT:'8083',
      AARULYA_STOREFRONT_ROOT:'/app/storefront',
      AARULYA_STORE_INTERNAL_API_ORIGIN:'http://aarulya-aarulya-store-api:8080',
      AARULYA_EDGE_ALLOWED_HOSTS:'store.aarulya.com'
    },[],[],{cpuMillis:250,memoryMiB:256,gpuMemoryMiB:0})
  ],
  sequencing:[
    'migrate',
    'seed-catalog',
    'api',
    'worker',
    'downloads',
    'evidence',
    'edge',
    'health-acceptance',
    'rollback-restore-acceptance'
  ],
  requiredCloudCapabilities:{
    nonProdManagedWorkloadRuntime:'AARULYA_CLOUD_MANAGED_WORKLOAD_NONPROD_STAGING_V1',
    governedOneShotJobExecutor:true,
    projectDedicatedNetwork:'aarulya-aarulya-store-internal',
    publicIngressEnabled:false
  },
  truthBoundary:{
    secretsEmbedded:false,
    publicPortsPublished:false,
    publicDnsRequired:false,
    productionApplyAllowed:false,
    productionAuthorityGranted:false,
    productionDeployed:false
  }
};

const output=resolve(required('AARULYA_STAGING_BUNDLE_OUTPUT'));
await mkdir(dirname(output),{recursive:true,mode:0o700});
await writeFile(output,JSON.stringify(bundle,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({
  event:'AARULYA_STORE_CLOUD_STAGING_BUNDLE_PREPARED',
  output,
  storeExactHead:exactHead,
  cloudExactHead,
  artifactDigest,
  workloadCount:bundle.workloads.length,
  bootstrapJobCount:bundle.bootstrapJobs.length,
  productionDeployed:false
}));
