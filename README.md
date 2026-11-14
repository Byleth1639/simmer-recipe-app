# Simmer

Simmer is a recipe app built with React, TypeScript, Express, and MongoDB. Browse 105 recipes, save favorites, and add ingredients to a shopping list.

## Features

- Search by recipe name or ingredient and filter by diet or cooking time.
- Enter ingredients you already have to find matching recipes.
- Adjust the serving size to update ingredient quantities.
- Select an ingredient to highlight it in the 3D ingredient explorer.
- Check off ingredients as you prep and follow the cooking steps one at a time.

## Run locally

From the repository root, install the client and server dependencies:

```bash
npm run setup
```

Set `MONGODB_URI` to your MongoDB connection string, `APP_ORIGIN` to `http://localhost:5173`, and `PORT` to `3001` in the API process environment. See `env.example` for example values.

Start the API in one terminal:

```bash
npm start
```

Start the client in a second terminal:

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173).

## Recipe photos

Recipes display a saved image when one is available and a placeholder otherwise. The repository includes an optional image service for generating missing recipe illustrations. See [SETUP.md](SETUP.md) for configuration and [CREDITS.md](CREDITS.md) for photo credits.

## Checks

```bash
npm test
npm run typecheck
npm run build
```
