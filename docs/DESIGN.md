# Can I Run It? — Document de conception

Décisions prises lors de la session de cadrage du 2026-10-13.

## Produit

- **Concept** : savoir si son PC peut faire tourner un jeu vidéo. Windows uniquement.
- **Esprit** : projet fun et non commercial, mais **sérieux sur l'usage et la fiabilité**. Pas d'objectif de trafic ni d'analytics.
- **Parcours** : jeu d'abord → config utilisateur → verdict. URL partageable `/game/:appId/:slug`. SPA pure, pas de SSR.
- **Verdict par composant** (CPU, GPU, RAM, VRAM, DirectX, stockage) :
  - ❌ sous le minimum
  - ⚠️ minimum atteint
  - ✅ recommandé atteint
  - **limite** : score à ±10 % d'un seuil (±15 % pour un portable)
  - **?** indéterminé : texte brut + source toujours affichés. Jamais de faux ✅.
  - Verdict global = pire composant.
- **Règles précises du verdict** (`libs/domain/src/verdict.ts`) :
  - CPU/GPU : si l'utilisateur possède un modèle listé, comparaison exacte. Sinon, zone « limite » = ±10 % (±15 % pour un portable) autour du score minimum. ✅ dès que le score recommandé est atteint.
  - RAM, VRAM, DirectX, stockage : quantités exactes, sans zone limite. SSD exigé + HDD → ❌ ; type de disque inconnu → ?.
  - VRAM exigée = celle écrite dans la config, sinon la plus petite VRAM des GPU listés.
  - Ordre du pire au meilleur : ❌ < ? < limite < ⚠️ < ✅. Composant non mentionné par le jeu = omis.
- **Alternatives** (« GTX 970 / RX 290 ») : on retient la **plus faible**, toutes sont affichées.
- **FPS (v2)** : fourchette indicative, hypothèse min ≈ 30 FPS bas/1080p, recommandé ≈ 60 FPS élevé/1080p, extrapolée selon le score. Toujours étiquetée « estimation ». Livrée seulement une fois le verdict fiabilisé.

## Config utilisateur

- GPU détecté (WebGL `WEBGL_debug_renderer_info` / WebGPU), corrigeable.
- CPU choisi par autocomplétion (non détectable par le navigateur).
- RAM, espace libre et type de disque (SSD/HDD) saisis à la main (`navigator.deviceMemory` plafonne à 8 Go).
- Une seule config, persistée en `localStorage`.

## Données jeux

| Rôle | Source | Notes |
|---|---|---|
| Principale | Steam Store `appdetails` (`l=english`) | HTML libre à parser ; statut de l'endpoint non officiel |
| Fallback + contrôle croisé | PCGamingWiki | Modèle `{{System requirements}}` structuré. Bot password, ≤ 1 req/s, User-Agent avec contact. CC BY-NC-SA 3.0 |
| Dernier recours | GOG `api.gog.com/v2/games/{id}` | Non documenté |
| Corrections | `overrides` manuels versionnés | Alimentés par les signalements |
| Exclues | RAWG (CGU anti-redistribution), Epic (pas d'API) | IGDB n'a pas de configs requises |

- **Catalogue** : ~1000 jeux de départ, top SteamSpy (jeux seulement, sans DLC ni logiciels), plus `extra-games.json` pour les ajouts manuels.
- **Scalabilité** : un JSON par jeu chargé à la demande, plus un index de recherche léger.

### Pièges du HTML Steam

- Configs minimale et recommandée parfois réunies dans le seul champ `minimum`.
- Libellés `<li><strong>Label:</strong>` variables : forcer `l=english`.
- ®, ™, « or equivalent », séparateurs `,` `/` `or` `|`.
- VRAM incluse dans la chaîne GPU (« HD 7790 (2 GB) ») ou GPU générique (« 1 GB DirectX 11 card »).
- Lignes parasites (« Requires a 64-bit… », « Additional Notes », « Network »).
- `recommended` absent ; app sans configs requises → `[]` au lieu d'un objet.

### Correspondance des noms

1. Découper sur les séparateurs.
2. Normaliser : retirer ®/™, la marque et la casse ; unifier ti/super/xt.
3. Extraire la VRAM.
4. Résoudre via une table d'alias versionnée et une recherche floue, avec un seuil de confiance.
5. Journaliser les noms non résolus pour revue manuelle.

## Scores matériel

Uniquement des sources **légalement réutilisables**. Sont exclus : PassMark, TechPowerUp, Tom's Hardware, UserBenchmark, Notebookcheck, OpenBenchmarking (tous droits réservés), ainsi que les datasets « MIT » qui reprennent ces données (dbgpu…).

### Catalogue (`nx run data-pipeline:build-hardware` → `data/hardware/`)

- Specs extraites des listes Wikipédia (GPU NVIDIA/AMD/Intel, CPU Intel Core desktop/mobile, Intel, Ryzen, APU, FX, Phenom). L'API REST est appelée au plus une fois toutes les 2 s, avec cache local (`.cache/pipeline`, 30 jours) ; le User-Agent porte le contact de `PIPELINE_CONTACT`, exigé par Wikimedia.
- Les tableaux sont lus par en-tête de colonne. Une ligne illisible est **rejetée avec sa raison** (rapport `.cache/pipeline/hardware-report.json`), jamais devinée.
- Mêmes noms, specs différentes (GT 1030 GDDR5/DDR4/Kepler) → variantes distinctes nommées par leur nom de code ; une exigence « GT 1030 » les résout toutes et le verdict prend la plus faible.
- Architecture : nom de code (NVIDIA, AMD, Intel Arc), colonne « Architecture » (AMD récent), titre de section (CPU, iGPU Intel). DirectX : colonne Direct3D, sinon déduit de l'architecture.

### Score GPU (`score-gpu.ts`)

- Score = FP32 × facteur d'architecture, **mélangé à la bande passante mémoire** (poids 0,4 ; échelle : GTX 1060 6 Go = 4372).
- Les facteurs sont **ajustés par moindres carrés** (`nx run data-pipeline:calibrate-gpus`) sur ~50 équivalences de jeu documentées dans `gpu-anchors.ts` (ex. GTX 1060 6 Go ≈ RX 580, GTX 1660 ≈ 1,15 × GTX 1060). Ces paires viennent de la connaissance des benchmarks publics, pas d'un dataset cité.
- Écart médian < 5 %, maximum ~21 % (écarts au sein d'une même architecture, en partie dus au goulot CPU en 1080p) ; les cartes grand public les plus citées sont tenues à ±10 % par les tests.
- Blender Open Data a été écarté pour le calibrage : c'est du rendu, il surestime Turing de ~25 % et ne compare pas CUDA et HIP.
- RX 6500 XT exclue des paires (PCIe x4 + bus 64 bits : hors modèle).

### Score CPU (`score-cpu.ts`)

- Score = 60 % mono-thread + 40 % multi-thread, référence Core i5-8400 = 100.
- Mono = IPC × turbo ; multi = IPC × (base + turbo)/2 × cœurs effectifs × SMT (×1,25). Cœurs effectifs = P + 0,5 × E, **plafonnés à 8** (les jeux n'en exploitent pas plus). X3D : ×1,12.
- IPC par microarchitecture (Skylake = 1) calé sur les **équivalences publiées par les éditeurs dans Steam** (Cyberpunk : i7-6700 ≈ Ryzen 5 1600 ; Elden Ring : i7-8700K ≈ Ryzen 5 3600X…) et sur des équivalences connues ; tests à ±12 %.

### Exigences génériques

- CPU donné seulement en GHz (« 2.4 GHz Dual Core ») → score estimé comme une puce de l'ère Core 2 à cette fréquence (1 cœur si non précisé).
- GPU donné seulement par ses capacités (« DirectX 11 card », « Shader Model 5.0 ») → pas de verdict GPU par modèle ; vérification par DirectX et VRAM.
- Famille seule (« Intel Core i5 ») ou GPU d'avant DirectX 10 → « ? ».

## Technique

- **Nx** :
  - `apps/web` : Angular 22
  - `apps/data-pipeline` : Node (fetch, parse, match, écriture du JSON)
  - `libs/domain` : types, normalisation, verdict ; partagée par les deux apps
- **UI** : Angular Material **uniquement** pour le thème et les tokens de couleur, design SCSS maison (pas le design system Material).
- **i18n** : FR + EN via Transloco (runtime).
- **Hébergement** : Firebase Hosting, plan Spark gratuit, rewrite SPA.
- **CI** : repo GitHub public + Actions. Job hebdomadaire : pipeline → commit du JSON si diff → build → `firebase deploy`.
- **Signalement** : bouton « Signaler une erreur » → issue GitHub pré-remplie → correction dans les overrides.
- **Tests** : TDD Vitest sur le parsing, la correspondance des noms et le verdict, avec des fixtures réelles. Tests UI légers.

## Licences

- Code : MIT.
- `data/hardware/` : CC BY-SA 4.0 (dérivé de Wikipédia).
- `data/games/` : CC BY-NC-SA 3.0 (dérivé de PCGamingWiki).
- Les deux jeux de données restent **séparés** (licences incompatibles entre elles).
- Page « Sources & licences » : attributions Steam, PCGamingWiki, Wikipédia, Blender ; mention de non-affiliation à Valve.

## Ordre de livraison

1. ✅ `libs/domain` + parsing et correspondance des noms en TDD
2. ✅ Pipeline sur ~50 jeux
3. ✅ UI minimale de bout en bout (recherche, Mon PC avec détection GPU WebGL, page jeu + verdict, FR/EN Transloco)
4. Montée à ~1000 jeux, i18n, thème, CI et déploiement
5. (v2) Estimation des FPS

## Suivi

- Dev local : le devbox expose le serveur Angular sur le port hôte **47200** (le 4200 est pris par un autre projet).
- Bouton « Signaler une erreur » (issue GitHub pré-remplie) : à ajouter une fois le dépôt GitHub créé.
- Corrections manuelles (`overrides`) : à créer (ex. Intel HD 4000, dont le tableau Wikipédia est mal formé).

- Données jeux : seul Steam est branché ; PCGamingWiki (secours / contrôle croisé) et GOG restent à faire.
- UI : quand le jeu ne publie pas de config recommandée, « minimum atteint » est le meilleur verdict possible ; l'afficher comme tel.

## Risques

- Endpoint Steam sans statut officiel ; Valve peut révoquer l'accès.
- Calibration Blender = benchmark de rendu, pas de jeu ; HIP sous-performant côté AMD.
- Mono-thread CPU estimé, non mesuré.
