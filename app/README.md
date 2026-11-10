# Dash 955 · l'appli

L'application elle-même, pour Alfa Romeo MiTo 2009. Deux versions, une seule interface :

| Version | Pour quoi | Où |
|---|---|---|
| **APK Android** | Boîtier CarPlay sous Android, autoradio Android, tablette ou téléphone Android. Boîtier OBD, musique, LED, CarPlay en un glissement. | `sites/mito-2009/telechargement/dash955.apk` |
| **Version web** | iPhone ou n'importe quel navigateur. GPS, trajets, route, entretien. Pas de boîtier OBD (un navigateur ne peut pas lui parler). | `sites/mito-2009/app/` |

## Installer l'APK

1. Sur le boîtier CarPlay Android (ou l'autoradio), ouvre le site et touche « Télécharger
   l'application ». Autre solution : copie `dash955.apk` sur une clé USB.
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
et effacement). La consommation se calcule à partir du débit d'air : compare avec tes pleins et
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
