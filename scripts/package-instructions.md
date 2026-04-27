# Instructions de Packaging

## Étapes pour créer le package portable

1. **Sauvegarder le projet actuel** :
   ```bash
   # Faire une copie de sécurité
   cp -r "d:\gestion-armes-vdp-Copie" "d:\gestion-armes-vdp-Copie-BACKUP"
   ```

2. **Créer le package portable** :
   ```bash
   cd "d:\gestion-armes-vdp-Copie"
   npm run create-package
   ```

3. **Installer les dépendances du package** :
   ```bash
   cd vdp-manager-portable
   npm install --production
   ```

4. **Tester le package** :
   ```bash
   # Dans le dossier vdp-manager-portable
   npm start
   ```

5. **Créer l'archive pour envoi** :
   - Compresser le dossier `vdp-manager-portable` en ZIP
   - Nom suggéré : `VDP-Manager-Portable-v1.0.zip`

## Checklist avant envoi

- [ ] Le build React est à jour
- [ ] Les dépendances sont installées dans le package
- [ ] Le script DEMARRER.bat fonctionne
- [ ] L'application démarre correctement
- [ ] La connexion admin/admin123 fonctionne
- [ ] Les modules principaux sont accessibles
- [ ] Le README est inclus et à jour

## Contenu du package final

```
VDP-Manager-Portable-v1.0.zip
├── DEMARRER.bat
├── README-PORTABLE.md
├── package.json
├── main.js
├── preload.js
├── server.js
├── .env
├── build/
├── database/
├── utils/
├── routes/
└── node_modules/
```

## Taille approximative
- Package compressé : ~150-200 MB
- Package décompressé : ~400-500 MB
