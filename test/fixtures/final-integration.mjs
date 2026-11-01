// SYNTHETIC CONFIGURATION FOR TESTS ONLY. No actual accepted policy is installed.
import {configuration} from './protected-integration.mjs';
export function integrationConfiguration(){const c=configuration();c.version='nyra.protected.integration.v1';c.acceptance.acceptedEvents=['push','workflow_dispatch'];
 for(const [role,p]of Object.entries(c.identities)){p.workflowRef=p.repository+'/.github/workflows/pages-orchestrator.yml@refs/heads/main';p.jobWorkflowRef=p.repository+'/.github/workflows/'+(role==='publication'?'pages-delivery':'nyra-'+role)+'.yml@'+p.jobWorkflowSHA;p.jobName={build:'build-inventory / trusted-build',inspection:'inspection / trusted-inspection',publication:'delivery / protected'}[role];p.events=['push','workflow_dispatch'];}
 return c;
}
