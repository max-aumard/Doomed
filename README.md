# Doomed

Application iOS **gratuite et open source** pour arrêter le doomscroll sans perdre le contact avec ses amis.

- **Instagram** : messages, stories, profils et fil restent là. L'onglet Reels et Explorer disparaissent. Un reel envoyé par un ami en DM s'ouvre seul, sans pouvoir swiper vers le suivant.
- **YouTube** : les Shorts disparaissent. Un lien Short s'ouvre dans le lecteur classique.
- **Blocage des apps officielles** via Screen Time, pour ne pas pouvoir retourner scroller dans l'app Instagram ou YouTube.

## Comment ça marche

iOS interdit à une app de modifier une autre app. Personne ne peut retirer les Reels *dans* l'app Instagram officielle. Doomed fait donc deux choses :

1. Il affiche instagram.com et m.youtube.com dans une WebView et injecte [`Doomed/Web/filter.js`](Doomed/Web/filter.js) :
   - du CSS qui cache les points d'entrée (onglet Reels, Explorer, rayons Shorts) ;
   - des redirections sur les URL de fil infini :

     | URL | Devient |
     |---|---|
     | `instagram.com/reels/` | `instagram.com/direct/inbox/` |
     | `instagram.com/reels/<id>/` | `instagram.com/reel/<id>/` (reel seul) |
     | `instagram.com/<user>/reels/` | `instagram.com/<user>/` |
     | `instagram.com/explore/...` | `instagram.com/direct/inbox/` |
     | `youtube.com/shorts/<id>` | `youtube.com/watch?v=<id>` |
     | `youtube.com/shorts`, `/feed/shorts` | `youtube.com/` |

2. Il pose un écran de blocage Screen Time (FamilyControls / ManagedSettings) sur les apps Instagram et YouTube natives.

Chaque filtre se désactive dans l'onglet Réglages.

## Structure

```
Doomed/
  App/        App SwiftUI, onglets, réglages
  Web/        WebView filtrée + filter.js (le cœur du filtre)
  Blocking/   Blocage Screen Time des apps natives
tests/        Tests du filtre (Node)
project.yml   Spécification XcodeGen (le .xcodeproj est généré)
.github/      CI : tests + build iOS sur macOS
```

## Développer sans Mac

Tout se compile sur GitHub Actions (runner macOS), pas besoin de Mac.

1. Pousse le repo sur GitHub. Le workflow **iOS** se lance tout seul.
2. Il exécute les tests du filtre, génère le projet avec XcodeGen, compile l'app et publie un artefact `Doomed-unsigned-ipa`.
3. Tests du filtre en local (Windows/Linux/Mac) :

   ```bash
   node --test tests/*.test.js
   ```

Pour mettre à jour les règles quand Instagram ou YouTube change son site : modifier `filter.js`, ajouter un cas dans `tests/filter.test.js`, puis pousser.

## Installer sur un iPhone

- **Rapide, gratuit** : télécharger l'IPA non signée depuis l'onglet Actions, puis la signer et l'installer avec [Sideloadly](https://sideloadly.io) ou AltStore et un Apple ID gratuit. L'app expire au bout de 7 jours, et le blocage Screen Time peut ne pas marcher avec un compte gratuit.
- **TestFlight / App Store** : demande un compte Apple Developer (99 €/an) et les étapes ci-dessous.

## Publication App Store (à faire)

1. Compte Apple Developer, puis renseigner `DEVELOPMENT_TEAM` et un vrai `PRODUCT_BUNDLE_IDENTIFIER` dans `project.yml`.
2. Demander à Apple l'autorisation de distribuer FamilyControls : <https://developer.apple.com/contact/request/family-controls-distribution>.
3. Ajouter au workflow une étape de signature et d'envoi sur TestFlight (certificat et profil en secrets GitHub, ou clé App Store Connect API + `fastlane`).
4. Rédiger la fiche App Store en précisant que Doomed est un navigateur centré sur le bien-être numérique, non affilié à Meta ni Google. Il y a un risque de refus au titre de la règle 5.2.2 (contenu de tiers).

## Limites connues

- Les sélecteurs CSS dépendent du site web d'Instagram et de YouTube, qui changent souvent. Il faudra des mises à jour.
- Pas de notifications push dans la WebView. Les notifications de l'app officielle bloquée continuent normalement d'arriver.
- La connexion Google dans une WebView peut être refusée par Google. YouTube marche sans compte.
- À vérifier sur un vrai iPhone : comportement de `/reel/<id>/` sur le web mobile (s'il propose un défilement, ajouter une règle).

## Licence

MIT, voir [LICENSE](LICENSE).
