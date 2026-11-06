#!/bin/bash
# Disposable local QEMU guest only. No provider API, DNS, dispatch or real keys.
set -euo pipefail
umask 077
work=$(mktemp -d)
cleanup(){ if test -n "${vm_pid:-}"; then kill "$vm_pid" 2>/dev/null || true; wait "$vm_pid" 2>/dev/null || true; fi; rm -rf -- "$work"; }
trap cleanup EXIT
curl -fsSL --retry 3 https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img -o "$work/base.img"
printf '%s  %s\n' '04e8f2461a16a44e78a370284471f29616cdd9baf1893df25807b71f985b6c94' "$work/base.img" | sha256sum --check --strict
qemu-img create -f qcow2 -F qcow2 -b "$work/base.img" "$work/guest.qcow2" 28G
ssh-keygen -q -t ed25519 -N '' -f "$work/guest-key"
key=$(cat "$work/guest-key.pub")
cat > "$work/user-data" <<YAML
#cloud-config
hostname: nyra-acceptance-native-bootstrap
ssh_pwauth: false
disable_root: false
users:
  - name: root
    lock_passwd: true
    ssh_authorized_keys:
      - $key
YAML
printf '%s\n' 'instance-id: nyra-disposable-native-reboot' > "$work/meta-data"
cloud-localds "$work/seed.iso" "$work/user-data" "$work/meta-data"
accel=tcg
if test -r /dev/kvm && test -w /dev/kvm; then accel=kvm; fi
printf 'NYRA_DISPOSABLE_VM_ACCELERATOR=%s\n' "$accel"
qemu-system-x86_64 -accel "$accel" -m 4096 -smp 2 -nographic -serial "file:$work/serial.log" -monitor none \
 -drive "file=$work/guest.qcow2,if=virtio,format=qcow2" -drive "file=$work/seed.iso,if=virtio,format=raw,readonly=on" \
 -netdev user,id=net0,hostfwd=tcp:127.0.0.1:2222-:22 -device virtio-net-pci,netdev=net0 > "$work/qemu.log" 2>&1 &
vm_pid=$!
ssh_opts=(-i "$work/guest-key" -p 2222 -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$work/known-hosts")
remote(){ ssh "${ssh_opts[@]}" root@127.0.0.1 "$@"; }
ready=false
for i in $(seq 1 120); do if remote true 2>/dev/null; then ready=true; break; fi; if ! kill -0 "$vm_pid"; then cat "$work/qemu.log"; exit 1; fi; sleep 3; done
if test "$ready" != true; then cat "$work/serial.log"; cat "$work/qemu.log"; exit 1; fi
remote 'cloud-init status --wait >/dev/null'
# Include only the source + locked dependencies; ephemeral SSH key stays outside.
tar --exclude=./.git --exclude=./dist -czf "$work/source.tgz" .
scp -q -i "$work/guest-key" -P 2222 -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$work/known-hosts" \
 "$work/source.tgz" "$(command -v node)" root@127.0.0.1:/root/
remote 'mkdir /root/source; tar xzf /root/source.tgz -C /root/source; install -m 0755 /root/node /usr/local/bin/node; cd /root/source; env NYRA_NATIVE_BOOTSTRAP=1 NYRA_NATIVE_KEEP_FOR_REBOOT=1 node --test test/nyra-bootstrap-native.test.mjs'
old_boot=$(remote 'cat /proc/sys/kernel/random/boot_id')
remote 'systemctl reboot' || true
ready=false
for i in $(seq 1 120); do
 current_boot=$(remote 'cat /proc/sys/kernel/random/boot_id' 2>/dev/null || true)
 if test -n "$current_boot" && test "$current_boot" != "$old_boot"; then ready=true; break; fi
 if ! kill -0 "$vm_pid"; then cat "$work/qemu.log"; exit 1; fi; sleep 3
done
test "$ready" = true
printf 'NYRA_NATIVE_REBOOT_BOOT_IDS=%s,%s\n' "$old_boot" "$current_boot"
remote 'set -e; ready=false; for i in $(seq 1 120); do if systemctl is-active --quiet docker && docker exec nyra-repository-pg pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi; sleep 2; done; if test "$ready" != true; then systemctl show docker --property=ActiveState --property=Result; journalctl -u docker --no-pager -n 30; exit 1; fi; echo NYRA_POST_REBOOT_DOCKER_AND_PG_READY; cd /root/source; env NYRA_NATIVE_REBOOT_READBACK=1 node test/native-bootstrap-reboot-readback.mjs'
