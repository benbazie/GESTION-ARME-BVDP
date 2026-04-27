# Migrations PostgreSQL

Ce dossier contient les migrations gérées par [node-pg-migrate](https://salsita.github.io/node-pg-migrate/).

## Prérequis
- Variables d'environnement Postgres (`PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD`, `PG_SSL`...) configurées dans `.env` ou `.env.local`.
- Base Postgres accessible (Docker ou serveur distant).

## Commandes utiles
- `npm run migrate` : applique toutes les migrations ascendantes.
- `npm run migrate:down` : annule la dernière migration (utiliser avec précaution).
- `npm run migrate:new -- <nom>` : crée un nouveau fichier (via `node-pg-migrate create`).

## Convention de nommage
Utiliser le format `YYYYMMDDHHMM_<resume>.js` afin de conserver un ordre chronologique explicite.

Chaque fichier exporte :
```js
exports.up = (pgm) => {
  // DDL/seed vers l'état souhaité
};

exports.down = (pgm) => {
  // rollback vers l'état précédent
};
```

## Intégration
Le serveur Node/Electron exécutera `npm run migrate` avant de démarrer, garantissant un schéma aligné avec le code applicatif.
