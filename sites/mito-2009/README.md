# Dash 955 · site pour Alfa Romeo MiTo 2009

Site de présentation et de téléchargement de l'application, avec les 19 options de la
référence (12 sans boîtier OBD, 7 avec boîtier), adaptées à la MiTo de 2009.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page, et le réglage du lien de téléchargement (en haut) |
| `dash.css` | Le design (couleurs, écrans, mise en page mobile) |
| `dash.js` | Les écrans animés, les thèmes, le sélecteur DNA, le formulaire |
| `scrollcraft.js` / `.css` | Le moteur de scroll (ne pas modifier) |
| `telechargement/` | Dépose ici le fichier de l'application |

## Brancher le fichier de l'application

Deux façons, au choix :

1. **Le plus simple** : dépose ton fichier dans `telechargement/` sous le nom
   `dash955.apk`. Les deux boutons « Télécharger l'application » pointent déjà dessus.
2. **Fichier hébergé ailleurs** (Google Drive, GitHub Releases, etc.) : dans
   `index.html`, remplace la valeur de `fichier` :

   ```js
   window.DASH955 = {
     fichier: "https://ton-lien-vers-le-fichier.apk",
     version: "1.0",
     android: "Android 8 ou plus récent"
   };
   ```

Tant que le fichier est introuvable sur le serveur, le bouton affiche « Le fichier
arrive très bientôt » au lieu d'une erreur 404.

## Voir le site en local

```bash
cd sites/mito-2009
python3 -m http.server 4500
# puis ouvre http://localhost:4500
```

## Mettre en ligne

Le dossier est statique : il suffit de l'envoyer tel quel sur Netlify (glisser-déposer
du dossier), Vercel, GitHub Pages ou n'importe quel hébergeur.

## Changer le nom

« Dash 955 » (955 est le code de type de la MiTo) est un nom provisoire. Il apparaît dans
`index.html` (titre, barre, pied de page, étapes) et une fois dans `dash.js`.

## Ce qui est une démo

Les écrans du site tournent sur un trajet simulé, marqué « DÉMO » sur chaque vue. Les
prix, stations et trajets affichés sont des exemples. Les intervalles d'entretien sont
des réglages à caler sur le carnet d'entretien de la voiture.
