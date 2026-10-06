import { useSyncExternalStore } from 'react';

const query = '(max-width: 650px)';
const subscribe = notify => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export default function useMobileCards() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
