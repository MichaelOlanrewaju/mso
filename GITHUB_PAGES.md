# Deploying to GitHub Pages (with a custom domain)

> **Note:** the workflow currently wired up in this repo
> (`.github/workflows/deploy.yml`) deploys to **Namecheap via FTP** — see
> `NAMECHEAP_DEPLOY.md` instead. Keep this file only if you want GitHub
> Pages as an alternative/parallel deploy target later; you'd need to
> either rename this workflow or add it as a second file alongside the
> Namecheap one.

## 1. Push this project to a GitHub repo
If it's not already a repo:
```
cd mso-vite
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2. Add your backend URL as a repo secret
Settings → Secrets and variables → Actions → **New repository secret**
- Name: `VITE_SCRIPT_URL`
- Value: your Apps Script web app URL (the same one currently in Netlify's env vars)

## 3. Enable GitHub Pages
Settings → Pages → **Source: GitHub Actions**

That's it — `.github/workflows/deploy.yml` (already added) builds the app and deploys
`dist/` automatically on every push to `main`. First deploy will show up at
`https://<you>.github.io/<repo>/`.

**Note on that default URL:** it includes `/<repo>/` as a path prefix. Since this repo's
Vite config uses the default `base: '/'`, asset paths assume the site is served from a
domain root — which is true once you attach a custom domain (step 4), but will 404 on
assets if you only use the raw `github.io/<repo>` URL. If you want to keep using the
raw GitHub URL *without* a custom domain, tell me and I'll set `base: '/<repo>/'` in
`vite.config.js` instead.

## 4. Connect your custom domain
Settings → Pages → **Custom domain** → enter your domain (e.g. `console.msolimpid.com`)
GitHub will create a `CNAME` file in the repo automatically.

Then at your DNS provider:
- **Subdomain** (e.g. `console.msolimpid.com`): add a `CNAME` record pointing to
  `<you>.github.io`
- **Apex/root domain** (e.g. `msolimpid.com`): add four `A` records pointing to GitHub's
  Pages IPs:
  ```
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
  ```

Once DNS propagates, tick **Enforce HTTPS** in the same Pages settings page — GitHub
issues a free certificate automatically (can take a few minutes to a few hours).

## Notes
- The backend (`Code.gs` on Google Apps Script) doesn't change at all — this only
  affects where the frontend is hosted.
- `public/_redirects` (Netlify's SPA-fallback config) is now dead weight — harmless to
  leave, since GitHub Pages just ignores files it doesn't recognize, but fine to delete.
- You can run Netlify and GitHub Pages in parallel with no conflict — nothing here
  requires taking Netlify down first, so it's safe to test this before switching your
  domain over.
