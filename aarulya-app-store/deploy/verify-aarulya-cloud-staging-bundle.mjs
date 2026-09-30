import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const DIGEST=/^sha256:[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const IMAGE=/^[a-z0-9][a-z0-9._/-]*(?::[a-z0-9._-]+)?@sha256:[a-f0-9]{64}$/i;

const raw=String(process.env.AARULYA_STAGING_BUNDLE_FILE||'').trim();
if(!raw) throw new Error('AARULYA_STAGING_BUNDLE_FILE_REQUIRED');
const file=resolve(raw);
const info=await stat(file);
if(!info.isFile()) throw new Error('STAGING_BUNDLE_NOT_FILE');
if((info.mode&0o077)!==0) throw new Error('STAGING_BUNDLE_PERMISSIONS_TOO_OPEN');
const bundle=JSON.parse(await readFile(file,'utf8'));

if(bundle?.kind!=='AARULYA_STORE_CLOUD_NONPROD_STAGING_BUNDLE') throw new Error('STAGING_BUNDLE_KIND_INVALID');
if(!SHA40.test(bundle.cloudExactHead||'')||!SHA40.test(bundle.manifest?.sourceCommit||'')) throw new Error('EXACT_HEAD_REQUIRED');
if(bundle.manifest?.projectId!=='aarulya-store'||bundle.manifest?.repository!=='Amit75/Amit75') throw new Error('STORE_PROJECT_BINDING_INVALID');
if(bundle.manifest?.sourceRef!=='agent/aarulya-app-store-foundation') throw new Error('STORE_SOURCE_REF_INVALID');

for(const name of ['artifactDigest','rollbackArtifactDigest','sourceVerificationReceiptDigest','releaseEvidenceDigest']){
  if(!DIGEST.test(bundle.manifest?.[name]||'')) throw new Error('MANIFEST_DIGEST_INVALID:'+name);
}
for(const name of ['configurationDigest','runtimePolicyDigest','backupRestoreEvidenceDigest','rollbackPlanDigest']){
  if(!DIGEST.test(bundle.target?.[name]||'')) throw new Error('TARGET_DIGEST_INVALID:'+name);
}
if(bundle.target?.environment!=='NON_PRODUCTION') throw new Error('STAGING_TARGET_MUST_BE_NON_PRODUCTION');
if(bundle.truthBoundary?.productionDeployed!==false||bundle.truthBoundary?.publicPortsPublished!==false) throw new Error('STAGING_TRUTH_BOUNDARY_INVALID');

const components=[...(bundle.bootstrapJobs||[]),...(bundle.workloads||[])];
for(const component of components){
  const env=component.environment||{};
  for(const [name,value] of Object.entries(env)){
    if(/(^|_)(PASSWORD|PASSCODE|SECRET|PRIVATE_KEY|CREDENTIAL|API_KEY|ACCESS_KEY|AUTH_TOKEN|AUTHORIZATION)(_|$)/i.test(name)){
      const safe=name.endsWith('_FILE')&&String(value).startsWith('/opt/aarulya/secrets/');
      if(!safe) throw new Error('INLINE_SECRET_DENIED:'+name);
    }
  }
  for(const secret of component.secrets||[]){
    if(!String(secret.source||'').startsWith('/var/lib/aarulya-cloud/secrets/aarulya-store/')) throw new Error('SECRET_SOURCE_INVALID');
    if(!String(secret.target||'').startsWith('/opt/aarulya/secrets/')) throw new Error('SECRET_TARGET_INVALID');
  }
}
for(const workload of bundle.workloads||[]){
  if(!IMAGE.test(workload.imageRef||'')) throw new Error('IMMUTABLE_IMAGE_REQUIRED:'+workload.workloadId);
  if(workload.artifactDigest!==bundle.manifest.artifactDigest) throw new Error('ARTIFACT_DIGEST_MISMATCH:'+workload.workloadId);
  if(workload.sourceCommit!==bundle.manifest.sourceCommit) throw new Error('SOURCE_HEAD_MISMATCH:'+workload.workloadId);
  if(workload.policyAuthorization!==null) throw new Error('POLICY_AUTHORIZATION_MUST_BE_CLOUD_ISSUED:'+workload.workloadId);
}
for(const job of bundle.bootstrapJobs||[]){
  if(!IMAGE.test(job.imageRef||'')) throw new Error('IMMUTABLE_JOB_IMAGE_REQUIRED:'+job.jobId);
  if(job.artifactDigest!==bundle.manifest.artifactDigest) throw new Error('JOB_ARTIFACT_DIGEST_MISMATCH:'+job.jobId);
  if(job.sourceCommit!==bundle.manifest.sourceCommit) throw new Error('JOB_SOURCE_HEAD_MISMATCH:'+job.jobId);
}
const jobIds=new Set((bundle.bootstrapJobs||[]).map((x)=>x.jobId));
if(!jobIds.has('migrate')||!jobIds.has('seed-catalog')) throw new Error('DATABASE_BOOTSTRAP_JOBS_REQUIRED');

console.log(JSON.stringify({
  event:'AARULYA_STORE_CLOUD_STAGING_BUNDLE_VERIFIED',
  storeExactHead:bundle.manifest.sourceCommit,
  cloudExactHead:bundle.cloudExactHead,
  workloads:bundle.workloads.length,
  bootstrapJobs:bundle.bootstrapJobs.length,
  publicIngressEnabled:false,
  productionDeployed:false
}));
