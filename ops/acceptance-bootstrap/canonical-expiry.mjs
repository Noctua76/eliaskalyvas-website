// One shared canonical expiry service/timer source. No install side effects.
const need=(v,c)=>{if(!v)throw Error('OFFLINE_BOOTSTRAP_'+c);};
export function renderCanonicalExpiryService(){
 return '[Unit]\nDescription=NYRA acceptance deadline cleanup\nAfter=docker.service\nAssertPathExists=/usr/local/sbin/nyra-repository-expire\n[Service]\nType=oneshot\nTimeoutStartSec=180\nExecStart=/usr/local/sbin/nyra-repository-expire\nStandardOutput=journal\nStandardError=journal\n';
}
export function renderCanonicalExpiryTimer(calendar='@@DEADLINE@@'){
 need(calendar==='@@DEADLINE@@'||/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(calendar),'EXPIRY_CALENDAR');
 return '[Unit]\nDescription=NYRA acceptance deadline\n[Timer]\nOnCalendar='+calendar+'\nAccuracySec=1s\nPersistent=true\nUnit=nyra-repository-expiry.service\n[Install]\nWantedBy=timers.target\n';
}
