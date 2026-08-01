# Security hardening (extension v1.7.17)

Independent review against UniSat Wallet `extension/v1.7.17` (`2b1b16c`).

This PR hardens real, reproducible issues found in the Chrome extension path. It does **not** claim a remote silent siphon / auto-sign critical.

## Summary

1. **Phishing UI clickjacking / WAR (High)**  
   - Remove `index.html` from `web_accessible_resources`  
   - Dedicated `phishing.html` (+ `pageProvider.js` only in WAR)  
   - CSP `frame-ancestors 'none'`  
   - Proceed blocked when framed (`window.top !== window`)  
   - Proceed `href` allowlist: **http(s) only** (blocks `chrome-extension:` / `javascript:` pivots)  
   - `SKIP_PHISHING_PROTECTION` requires `sender.url` under the extension origin  

2. **Vault KDF (Medium)**  
   - Replace browser-passworder default path with WebCrypto **PBKDF2-SHA256 @ 600_000** + AES-GCM  
   - Decrypt fallback: payload `iterations` → else try 600k then legacy **10k** so existing vaults still unlock  
   - Next persist re-encrypts at 600k  

3. **Mnemonic length on create**  
   - Create flow now offers **12 / 24** (import already did)  
   - Default for new wallets: **24 words (256-bit BIP39)**  
   - Entropy via `bip39.generateMnemonic(strength)` → `@noble/hashes` `randomBytes` → `crypto.getRandomValues`  

4. **`externally_connectable`**  
   - Remove `"ids": ["*"]` from Chrome/Edge/Brave manifests (keep `https://unisat.io/*`)  

5. **UI port sender check**  
   - Disconnect UI-named ports when `sender.id !== runtime.id`  

6. **Inscription iframe (Medium)**  
   - `sandbox="allow-scripts"` only (drop `allow-same-origin` / `allow-forms`)  
   - `pointer-events: none`, `referrerPolicy=no-referrer`  

7. **PSBT local risk (Medium)**  
   - Flag `SIGHASH_SINGLE` as warning  
   - Wire UI copy (`sighash_single_risk_*`) in `SignPsbtWithRisksPopover`  

## Test plan

- [x] Fresh create: 12 and 24 word radios; default 24; home screen after create  
- [x] Legacy-shaped 10k vault ciphertext decrypts; re-encrypt stamps `iterations: 600000`  
- [x] Real `@metamask/browser-passworder`-compatible 10k blob decrypts via fallback  
- [x] Phishing page: https Continue works top-level; `chrome-extension:` href does not pivot  
- [x] Hostile iframe of `phishing.html` → browser “refused to connect” (`frame-ancestors`)  
- [x] `window.unisat` injects; no page-facing `generateMnemonic` / `exportPrivateKey`  
- [x] `tx-helpers` unit tests including `SIGHASH_SINGLE`  
- [ ] Maintainer: existing production vault unlock → lock → confirm 600k persist  
- [ ] Maintainer: SignPsbt with `SIGHASH_SINGLE` shows localized warning  
- [ ] Maintainer: Chrome MV3 store/pro build (`gulp build`) smoke on provider injection  

## Build note

Local verification used Chrome MV3 webpack output. Please run the repo’s normal `gulp build --env=pro --browser=chrome --manifest=mv3` smoke (popup + `window.unisat` on a https page) before store publish.

## Out of scope / not claimed

- Remote silent siphon / auto-sign bypass (not found on this pin)  
- “Broken BIP39 CSPRNG” (uses `getRandomValues`)  
- Mobile app (separate surface; not covered by this extension PR)  
