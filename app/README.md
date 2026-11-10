# Dash 955 · l'appli

L'application elle-même, pour Alfa Romeo MiTo 2009. Deux versions, une seule interface :

| Version | Pour quoi | Où |
|---|---|---|
| **APK Android** | Boîtier CarPlay sous Android, autoradio Android, tablette ou téléphone Android. Boîtier OBD, musique, LED, CarPlay en un glissement. | `sites/mito-2009/telechargement/dash955.apk` |
| **Version web** | iPhone ou n'importe quel navigateur. GPS, trajets, route, entretien. Pas de boîtier OBD (un navigateur ne peut pas lui parler). | `sites/mito-2009/app/` |

## Installer l'APK

**Par clé USB (le plus sûr)** : `dist/dash955-cle-usb.zip` (aussi dans
`sites/mito-2009/telechargement/`) contient `dash955.apk` et une notice `LISEZMOI.txt`.
Copie l'APK à la racine d'une clé FAT32, branche-la sur l'écran, ouvre-le avec l'appli Fichiers.

**Par le site** :

1. Sur le boîtier CarPlay Android (ou l'autoradio), ouvre le site et touche « Télécharger
   l'application ». Si le navigateur affiche « La connexion n'est pas privée », la date ou
   l'heure de l'écran est fausse : règle-les, ou passe par la clé USB.
2. Ouvre le fichier. Android demande d'autoriser les applications inconnues : accepte.
3. Ouvre Dash 955 et autorise la localisation (vitesse GPS, recherche Bluetooth).
4. **Réglages > CarPlay en un glissement** : choisis l'appli qui affiche CarPlay (ZLink,
   AutoKit, CarPlay…). Ensuite, un glissement vers la gauche sur l'accueil l'ouvre.
5. **Réglages > Musique** : autorise « Dash 955 · titre et pochette » dans l'accès aux
   notifications pour voir le titre et la pochette.
6. Pour en faire l'écran d'accueil du boîtier : **Réglages > Dash 955 en écran d'accueil**.
   Le bouton « Applis » en haut à droite ouvre les autres applis.

Un vrai CarPlay Apple, lui, n'installe aucune appli : il faut un boîtier ou un autoradio
qui tourne sous Android.

## L'interface

Écran façon tableau de bord : la MiTo à gauche (vitesse, limitation, eau, turbo, conso,
batterie, alertes), une grande carte à droite (position, recherche d'adresse, Maison, Travail,
station la moins chère), et une barre en bas : **Voiture** (Moteur, Trajets, Route, LED,
Entretien, Réglages), **mini-lecteur**, **Navigation**, **Musique**, **Téléphone**, **ZLink**,
**Applis**, volume.

- **Musique** : titre, pochette, avance dans le morceau, volume, et « Lancer sur Spotify » :
  tu tapes un artiste ou une playlist, Spotify le joue et Dash 955 revient à l'écran.
- **Navigation** : la recherche d'adresse (OpenStreetMap, internet nécessaire) pose la
  destination sur la carte. « Y aller avec Waze » lance le guidage dans Waze, ou Google Maps.
- **Téléphone** : clavier, favoris, et accès à l'appli Bluetooth de l'écran pour les appels et
  les messages (Android ne partage pas les SMS avec les autres applis).
- **Écran partagé** : « Ouvrir à côté » lance ZLink, Waze ou Spotify à côté de Dash 955 quand
  l'écran le permet.
- Les applis Spotify et Waze elles-mêmes ne peuvent pas être incrustées : Dash 955 les commande
  et les ouvre.

## Démarrage automatique

- Le plus fiable : Dash 955 en **écran d'accueil** (bouton Accueil > Dash 955 > Toujours).
- « Ouvrir Dash 955 au démarrage » (Réglages > Démarrage et connexion) l'ouvre à l'allumage. Sur
  Android 10 et plus, il faut l'autorisation « Afficher par-dessus les autres applis ».
- ZLink est choisi tout seul pour le bouton CarPlay (recherche « zlink » parmi toutes les applis
  installées, même sans icône).

## Boîtier RevKing (RevKingz)

Le RevKing est un boîtier OBD Bluetooth basse consommation (BLE) compatible ELM327 : son
fabricant le donne compatible avec les applis de diagnostic comme Car Scanner ou EOBD Facile.
Son nom Bluetooth exact n'est pas publié, donc l'appli le reconnaît de deux façons : un nom
contenant « rev », « king » ou « headz », ou les services Bluetooth des boîtiers ELM327 (FFF0,
FFE0…).

Après la première connexion, il se reconnecte tout seul au démarrage, au réveil de l'écran et
quand le Bluetooth revient (nouvel essai toutes les 30 s sinon).

**Moteur > Connecter mon RevKing** guide la connexion : boîtier branché, contact mis, appli
RevHeadz du téléphone fermée (un boîtier BLE n'accepte qu'une connexion), puis Rechercher. Le
journal de connexion en bas de l'onglet Moteur montre chaque échange avec le boîtier.

## Brancher le boîtier OBD

Prise OBD de la MiTo : sous la planche de bord, à gauche du volant, derrière une trappe.

1. Branche le boîtier et mets le contact.
2. Onglet **Moteur > Détecter mon boîtier**. L'appli essaie dans l'ordre :
   - les boîtiers Bluetooth déjà appairés dont le nom ressemble à OBD, ELM, Vgate, iCar… ;
   - une recherche Bluetooth basse consommation (boîtiers « BLE ») ;
   - le Wi-Fi (192.168.0.10, port 35000).
3. Un boîtier Bluetooth classique s'appaire d'abord une fois (code 1234 ou 0000) :
   **Choisir un appareil > Rechercher**, puis touche le boîtier.
4. Un boîtier Wi-Fi : connecte d'abord l'appareil au Wi-Fi du boîtier (souvent
   « WiFi_OBDII »), puis **Boîtier Wi-Fi > Connecter**.

Le boîtier choisi est retenu et se reconnecte tout seul au démarrage.

## Ce que lit le boîtier (ELM327, données standard)

Régime, vitesse, charge, pression d'admission (turbo), débit d'air, papillon, température
d'eau et d'air, pression atmosphérique, tension batterie, voyant moteur et codes défaut (lecture
et effacement). Pour le 1.6 JTDM diesel, en plus si le calculateur les donne : pression du rail,
vanne EGR et débit de carburant (consommation alors exacte). La consommation se calcule à partir du débit d'air : compare avec tes pleins et
ajuste « Correction conso » dans Réglages. Le couple est une estimation.

**Pas encore gérés** (honnêtement) :

- **Clignotants et frein à main** : sur la MiTo, ils passent par le réseau carrosserie
  (B-CAN, broches 1 et 9 de la prise), qu'un ELM327 standard ne lit pas.
- **Portes, feux, marche arrière** : ils arrivent dans l'autoradio par son décodeur CAN, et la
  plupart des autoradios ne les partagent pas avec les applis.

## Internet

Météo (alerte verglas), limitations de vitesse (OpenStreetMap) et prix des carburants (données
publiques prix-carburants) demandent une connexion : Wi-Fi, 4G du boîtier, ou partage de
connexion du téléphone. Sans internet, le reste marche.

## Tester sans voiture

**Réglages > Mode démo** : un trajet simulé avec données moteur, pour tout essayer à l'arrêt.

## Recompiler l'APK

```bash
sudo apt-get install android-sdk-platform-23 aapt apksigner zipalign dalvik-exchange openjdk-17-jdk-headless
./app/build.sh
```

Le script compile sans Gradle, signe l'APK, puis le copie dans le site avec la version web.
La clé de signature (`app/android/signing/`) n'est pas versionnée : un APK signé avec une autre
clé ne peut pas remplacer l'ancien. Exporte tes données (Réglages > Mes données), désinstalle,
installe le nouveau, puis importe.

## Fichiers

```
app/
├── build.sh               compilation de l'APK + copie vers le site
├── android/
│   ├── AndroidManifest.xml
│   ├── res/               icônes, nom, thème
│   └── src/com/dash955/app/
│       ├── MainActivity.java   WebView + pont JavaScript
│       ├── Obd.java            ELM327 : détection, connexion, lecture
│       ├── Ble.java            Bluetooth basse consommation
│       ├── Gps.java            vitesse et position
│       ├── Led.java            rubans LED Bluetooth
│       ├── MediaListener.java  titre, pochette, commandes musique
│       ├── TrackService.java   garde l'appli active pendant un trajet
│       └── Hub.java            relie tout à l'interface
└── web/                   l'interface (aussi servie comme version web)
```
