# Publish Biuret at `biuret.dev`

The project has a ready-to-run GitHub Pages workflow at `.github/workflows/deploy-pages.yml`. It publishes the production-safe `dist` directory whenever you push to `main` or `master`.

## 1. GitHub repository

Create a repository under the **Biuret7** GitHub account, then push this `Website` folder to it. The site uses public browser configuration only; do not add Appwrite API keys, Paddle API keys, or webhook secrets to Git.

In the repository, go to **Settings > Pages** and select **GitHub Actions** under *Build and deployment*. The workflow deploys `dist` automatically after the next push.

## 2. Add the custom domain before DNS

In **Settings > Pages > Custom domain**, enter:

```
biuret.dev
```

Save it before changing DNS. GitHub recommends this order to prevent custom-domain takeover risks.

## 3. Name.com DNS records

In the Name.com DNS panel, replace only conflicting website records for `@` and `www` (do not remove MX records if you add email later).

| Type | Host | Answer |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `Biuret7.github.io` |

DNS can take up to 24 hours to propagate. When GitHub shows the custom-domain check as successful, enable **Enforce HTTPS**. `.dev` requires HTTPS, and GitHub Pages provisions the certificate automatically when DNS is correct.

## 4. Allow the deployed site in connected services

After `https://biuret.dev` works, add these web platforms in the Appwrite project:

```
biuret.dev
www.biuret.dev
```

Then, in the **Paddle Sandbox** dashboard:

1. Add `biuret.dev` in **Checkout > Website approval**.
2. Set `https://biuret.dev` as the **Default payment link** in **Checkout > Checkout settings**.

## 5. Security boundary

GitHub Pages only hosts the static interface. Appwrite must continue to handle accounts, database reads, and future server Functions. Paddle API keys and webhook secrets belong only in Appwrite Function variables — never in this repository or the website files.
