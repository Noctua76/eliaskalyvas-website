#!/usr/bin/env python3
"""Read-only dependency/capacity report. No network, private-file reads or writes."""
import json
import platform
import shutil
import subprocess

tools = {name: shutil.which(name) is not None
         for name in ("python3", "node", "pwsh", "docker", "unzip", "tar")}
node = {"status": "ABSENT"}
if tools["node"]:
    try:
        outcome = subprocess.run(["node", "--version"], capture_output=True,
                                 text=True, timeout=5, check=False)
        value = outcome.stdout.strip()
        node = {"status": "PASS" if outcome.returncode == 0 and value.startswith("v")
                else "UNVERIFIED", "version": value if value.startswith("v") else None}
    except (OSError, subprocess.TimeoutExpired):
        node = {"status": "UNVERIFIED"}
capacity = {}
for path in ("/opt", "/tmp"):
    try:
        capacity[path] = {"freeBytes": shutil.disk_usage(path).free}
    except OSError:
        capacity[path] = {"freeBytes": None}
print(json.dumps({
    "marker": "NYRA_PREPARATION_READONLY_FEASIBILITY",
    "python": platform.python_version(),
    "operatingSystem": platform.system(),
    "toolsPresent": tools,
    "node": node,
    "capacity": capacity,
    "privateFilesRead": False,
    "networkRequested": False,
    "fileWritesRequested": False,
    "dockerOrServicesInvoked": False,
    "preparationAuthorized": False,
    "liveAcceptance": "NOT_TESTED"
}, sort_keys=True))
