# Can I Run It? — Suivi

Dernière mise à jour : 14 octobre 2026

- Site : https://can-i-run-it.ozawakyo.workers.dev
- Dépôt : https://github.com/OzawaKyo/can-i-run-it
- Décisions de conception : [DESIGN.md](DESIGN.md)

Chaque tâche indique sa priorité (**P1** prioritaire, **P2** important, **P3** bonus) et qui s'en charge (**toi** ou **Claude**).

---

## À tester

- [ ] **P1 · toi** — Commande PowerShell « Détecter mon PC » sur un vrai PC Windows
  Site → « Détecter mon PC » → suivre les 3 étapes. Si ça bloque, envoyer ce qu'affiche PowerShell.
  _Seul élément livré sans avoir été exécuté (développé sous Linux)._

## Fiabilité des données

- [ ] **P2 · Claude** — Les derniers « ? » : 66 jeux sur 998 gardent un verdict global « ? » (1 % des CPU et 4 % des GPU minimaux non reconnus)
  - [ ] Passer en revue ces 66 jeux un par un (exigences absurdes, cartes pro type Quadro, fautes de frappe)
  - [ ] Athlon / Pentium / Celeron récents (Athlon 3000G, Pentium Gold), absents du catalogue
- [ ] **P1 · Claude** — Revoir les ~200 lignes Wikipédia rejetées et compléter les corrections manuelles (ex. portables RTX 50)

## Fonctionnalités

- [ ] **P2 · Claude** — Partager un verdict : lien « mon PC vs ce jeu » à envoyer à un ami _(idée)_

## Finitions

- [ ] **P3 · Claude** — Aperçus de partage (Discord, WhatsApp…) : titre et bannière du jeu au lieu d'un titre générique
- [ ] **P3 · toi** — Nom de domaine perso (~10 €/an, seul coût éventuel)

## Décisions en attente

- [ ] **toi** — Dossier `.claude/` (tes skills) : l'ajouter au dépôt public, ou l'ignorer définitivement ?

---

## Fait

- [x] Cadrage complet ([DESIGN.md](DESIGN.md))
- [x] Logique métier testée : lecture des configs Steam, reconnaissance du matériel, verdict
- [x] Catalogue matériel depuis Wikipédia : ~1 700 GPU, ~2 200 CPU, scores calibrés sur des équivalences en jeu
- [x] ~1 000 jeux populaires, rafraîchis automatiquement chaque lundi
- [x] Site : recherche, page « Mon PC », page jeu avec verdict par composant, FR/EN
- [x] Look sombre « gaming », bannières Steam, jeux populaires, page « Sources & méthode »
- [x] Bouton « Détecter mon PC » (GPU via le navigateur + détection complète Windows guidée)
- [x] Bouton « Signaler une erreur » (issue GitHub pré-remplie)
- [x] Hébergement gratuit Cloudflare + déploiement automatique à chaque push (GitHub Actions)
- [x] Vérifié sur iPhone
- [x] Icônes Lucide (badges de verdict, boutons) à la place des symboles et emoji
- [x] PCGamingWiki en secours de Steam : ~170 jeux complétés, mention « via PCGamingWiki » sur le site
- [x] Reconnaissance plus stricte : plus de confusion de marque (« Radeon 8500 » ≠ « GeForce 8500 GT »), ni de famille générique (« Intel HD Graphics »), ni de puce portable dans une famille desktop
- [x] Lecture de DirectX corrigée (« dx90c » était lu 90, « DirectX (November 2007) » était lu 2007, d'où de faux « Insuffisant » sur de vieux jeux)
- [x] GPU minimaux reconnus : de 79 % à 87 % ; CPU : de 88 % à 93 %
- [x] Processeurs portables mieux repérés (page mobile Intel, suffixes UM/LM)
- [x] Exigences vagues traitées : CPU d'avant l'ère Core (Pentium 4, Athlon XP…), nombre de cœurs seul, « Intel i5 », DirectX / Pixel Shader / OpenGL écrits de mille façons, mémoire seule (« 256 MB »), séries (« GeForce 200 series »), ancien format en paragraphe
- [x] Estimation des FPS (1080p, réglages bas et élevés) sur chaque page de jeu, expliquée dans « Sources & méthode »
- [x] Reconnaissance : CPU 99 %, GPU 96 % ; verdicts « ? » de 232 à 66 jeux, sans nouveau faux « Insuffisant »
