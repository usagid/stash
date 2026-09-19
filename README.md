# stash

**Stash** is a minimalistic opinionated privacy-focused pastebin service.

## What it does and what it doesn't do

✅ **Stash** stores pastes securely with zero knowledge of the contents to the server. It allows to transfer pastes, texts and forms online; secure it with a password or set access rules.

❌ **Stash** does not create trust with the server or the user. The server owner is able to inject malicious code. You have to trust the server, your ISP and any jurisdiction the traffic passes through to not be compromised. A server owner can also be forced to hand over access to logs or their other data, compromising your privacy.

## Zero-knowledge storage

Stash content is encrypted in the browser with Web Crypto before it is sent to the API. The server stores only an authenticated AES-GCM envelope in SQLite; it never receives plaintext, the password, or the unprotected decryption key. For passwordless stashes, the key is placed after `#` in the URL fragment, which browsers do not send in HTTP requests. Password-protected stashes always retain the fragment key and add a second outer AES-GCM layer derived from the password with PBKDF2-SHA-256. Both the fragment key and password are required to decrypt.

AES-256-GCM is the default. AES-128-GCM is available as an optional browser-side alternative; both provide authenticated encryption.

Set `STASH_DATABASE_PATH` to change the database location; it defaults to `.data/stashes.sqlite`.
