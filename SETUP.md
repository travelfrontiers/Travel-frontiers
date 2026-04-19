# Travel Frontiers Promotions - Setup Guide

This project is a Next.js application with a Sanity.io backend for managing promotions.

## 1. Sanity (CMS) Setup

You need a Sanity Project ID to store your data.

1.  Run the following command in your terminal (inside this folder):
    ```bash
    npx sanity init
    ```
    -   It will ask you to log in.
    -   Select **Create new project**.
    -   Give it a name (e.g., `travelfrontiers-promos`).
    -   Use the default dataset configuration (`production`).
    -   **Important**: When asked to overwrite configuration, check carefully. If you already have `sanity.config.ts`, you can skip scaffolding or just copy the Project ID to your env file.
    -   **Easiest Way**: Go to [sanity.io/manage](https://www.sanity.io/manage) -> Create Project -> Get Project ID.

2.  **Update Environment Variables**:
    -   Open `.env.local`
    -   Replace the `NEXT_PUBLIC_SANITY_PROJECT_ID` with your new ID.

## 2. Running Locally

```bash
npm run dev
```
-   **Frontend**: [http://localhost:3000](http://localhost:3000) (redirects to /pt)
-   **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
    -   Go here to add "Promotion" entries.
    -   **Important**: You must add `http://localhost:3000` to your CORS origins in Sanity Manage if fetching fails (though usually localhost is allowed by default).

## 3. How to Deploy (Vercel)

1.  Push this code to your GitHub.
2.  Go to [Vercel](https://vercel.com) and "Add New Project".
3.  Import the repository.
4.  In "Environment Variables", add:
    -   `NEXT_PUBLIC_SANITY_PROJECT_ID`: Your Project ID.
    -   `NEXT_PUBLIC_SANITY_DATASET`: `production`.
5.  Click **Deploy**.

## 4. Features
-   **Multilingual**: `/pt` and `/en` supported.
-   **CMS**: Add promotions with Title, Price, Image, and Rich Text.
-   **Design**: Matches Travel Frontiers orange/amber theme.
