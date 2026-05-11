# Privacy policy hosting

This folder is published to GitHub Pages so it can be linked from the Play Store
listing of **Export GPX for Komoot**.

## Setup (one-off)

1. Push the repo to GitHub on the `main` branch (`git push origin main`).
2. On GitHub → Settings → Pages, set:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/docs`
3. After ~1 minute the policy is live at
   `https://<owner>.github.io/komoot-to-gpx/privacy-policy/`
   (replace `<owner>` with the actual GitHub account / org).

## Updating the policy

Edit `index.html`. Bump the "Last updated" date at the top. Commit + push.
GitHub Pages republishes within a minute.

## Where this URL is used

- Play Console → Main store listing → Privacy policy
- Play Console → Policy → Data safety → Privacy policy URL
- In-app: not linked from the UI in v1 (the Play listing is the canonical surface)
