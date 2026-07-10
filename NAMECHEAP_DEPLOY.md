# Deploying to Namecheap (cPanel shared hosting)

This repo now auto-builds and FTP-uploads to your Namecheap hosting on every
push to `main`, via `.github/workflows/deploy.yml`.

## 1. Get your FTP credentials
cPanel → **Files → FTP Accounts**
- If one already exists for the account, note the FTP **server** (often
  `ftp.yourdomain.com`) and **username**.
- Reset/set its password if you don't already know it — cPanel will let you
  set a new one right there.
- Note which folder it uploads into. For the main domain this is normally
  `public_html`. If this app should live at a subdomain or a subfolder
  (e.g. `console.yourdomain.com` or `yourdomain.com/console`), create that
  FTP account scoped to the right folder first (cPanel → FTP Accounts →
  give it its own home directory), so you don't overwrite anything else
  already in `public_html`.

## 2. Add repo secrets
GitHub repo → Settings → Secrets and variables → Actions → **New repository secret**,
one each for:
- `VITE_SCRIPT_URL` — your Apps Script web app URL (same value as on Netlify)
- `FTP_SERVER` — e.g. `ftp.yourdomain.com`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR` — the folder to upload into, e.g. `/public_html/`
  (keep the trailing slash)

## 3. Push
```
git add .
git commit -m "Deploy via FTP to Namecheap"
git push
```
Watch the run under the repo's **Actions** tab. On success, your site is live
at whatever domain/folder that FTP account points to — no separate "enable
Pages" step needed, since cPanel serves whatever's in that folder immediately.

## 4. Domain
If the domain is already registered with Namecheap and pointed at this same
hosting account (the normal default), there's nothing else to do — it's
already connected. If it's a *different* domain or a subdomain you haven't
set up yet: cPanel → **Domains** → add the (sub)domain and point its
document root at the same folder as `FTP_SERVER_DIR` above.

SSL: cPanel → **Security → SSL/TLS Status** → run **AutoSSL** if it isn't
already on (Namecheap shared hosting includes free Let's Encrypt certs).

## Notes
- `.htaccess` (already added to the repo, gets uploaded with every build)
  handles client-side routing properly via Apache `mod_rewrite` — routes
  like `/dashboard-mso` return a real 200, unlike the GitHub Pages fallback.
- `dangerous-clean-slate: false` in the workflow means the deploy only adds/
  updates files, it won't delete anything already in that folder that isn't
  part of this build. Flip it to `true` later once you're confident the
  folder is dedicated to this app and nothing else needs to survive there.
- **Service worker reminder:** this app is a PWA (`public/sw.js`). The
  first time you deploy to a *new* domain/origin, browsers won't have any
  old cache to worry about — but if you later switch this same domain
  between hosts again, bump `CACHE_NAME` in `sw.js` so staff phones don't
  keep serving an old cached bundle.
- The backend (`Code.gs` on Apps Script) is unaffected by any of this — it's
  hosted by Google regardless of where the frontend lives.
