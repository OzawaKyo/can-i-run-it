# Can I Run It? — Suivi

> Dernière mise à jour : 14 octobre 2026
> Site : https://can-i-run-it.ozawakyo.workers.dev · Dépôt : https://github.com/OzawaKyo/can-i-run-it
> Détails des décisions : [DESIGN.md](DESIGN.md)

Légende : 🔴 prioritaire · 🟠 important · 🟢 bonus · 👤 à faire par toi · 🤖 à faire par Claude

---

## 🧪 À tester

- [ ] 👤 **Commande PowerShell « Détecter mon PC » sur un vrai PC Windows**
  Site → « ⚡ Détecter mon PC » → suivre les 3 étapes. Si ça bloque, envoyer ce qu'affiche PowerShell.
  _Seul élément livré sans avoir été exécuté (développé sous Linux)._

## 🔴 Fiabilité des données

- [ ] 🤖 **Brancher PCGamingWiki** en secours de Steam quand la config Steam est illisible ou vague
  _Prévu dans la conception, pas encore fait : aujourd'hui seul Steam alimente les jeux._
- [ ] 🤖 **Réduire les « ? »** — aujourd'hui **14 % des CPU** et **20 % des GPU** minimaux non reconnus
  - [ ] Familles de cartes (« GeForce 500 series », « Radeon HD 6000 series »)
  - [ ] Cartes d'avant DirectX 10 (GeForce 6/7, Radeon X1000)
  - [ ] Athlon / Pentium / Celeron manquants
- [ ] 🤖 **Revoir les ~200 lignes Wikipédia rejetées** et compléter les corrections manuelles (ex. portables RTX 50)

## 🟠 Fonctionnalités

- [ ] 🤖 **Estimation des FPS (v2)** — fourchette indicative « ≈ 45-60 FPS en moyen, 1080p »
- [ ] 🤖 **Partager un verdict** — lien « mon PC vs ce jeu » à envoyer à un ami _(idée)_

## 🟢 Finitions

- [ ] 🤖 **Aperçus de partage** (Discord, WhatsApp…) : titre + bannière du jeu au lieu d'un titre générique
- [ ] 👤 **Nom de domaine** perso (~10 €/an, seul coût éventuel)

## ❓ Décisions en attente

- [ ] 👤 Dossier `.claude/` (tes skills) : l'ajouter au dépôt public, ou l'ignorer définitivement ?

---

## ✅ Fait

- [x] Cadrage complet ([DESIGN.md](DESIGN.md))
- [x] Logique métier testée : lecture des configs Steam, reconnaissance du matériel, verdict
- [x] Catalogue matériel depuis Wikipédia : ~1 700 GPU, ~2 200 CPU, scores calibrés sur des équivalences en jeu
- [x] ~1 000 jeux populaires, rafraîchis automatiquement chaque lundi
- [x] Site : recherche, page « Mon PC », page jeu avec verdict par composant, FR/EN
- [x] Look sombre « gaming », bannières Steam, jeux populaires, page « Sources & méthode »
- [x] Bouton « ⚡ Détecter mon PC » (GPU via le navigateur + détection complète Windows guidée)
- [x] Bouton « Signaler une erreur » (issue GitHub pré-remplie)
- [x] Hébergement gratuit Cloudflare + déploiement automatique à chaque push (GitHub Actions)
- [x] Vérifié sur iPhone
