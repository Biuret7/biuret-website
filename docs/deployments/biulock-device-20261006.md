# BiuLock device activation source

The licensing source is restored from the archive used for the active Appwrite deployment, preserving the activate-device handler and analytics.

- Project: 6aa55a88003959a536e9
- Function: 6aa5abef002dd368d5cc
- Active deployment: 6ac5445872339f047a5a
- Previous deployment (rollback): 6ac20eec920e47f18ae6
- Archive: biuret-licensing-device-fix-20261006.tar.gz
- SHA-256: 493cde82a5da7ac84bffbe5f6125c641043e97825b49f1519f123aa41a8342ea

Rebuild from appwrite-functions/biuret-licensing (index.js, analytics.js, package.json). Run node --experimental-vm-modules --test tests/*.test.mjs before deployment. Website publication does not deploy the Appwrite function; the existing active function is unchanged.
