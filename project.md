# Objectif

Crée un filemanager web moderne et propre, à usage perso (1 à 2 utilisateurs),
pour gérer les fichiers d'un serveur. Stack : Laravel 13 + starter kit React
officiel (Inertia 2 + React 19 + TypeScript + Tailwind + shadcn/ui).
Fonctionnel : comptes utilisateurs avec rôles, navigation dans les fichiers,
upload de gros fichiers géré proprement, download, opérations de base, et
monitoring de perf.

# Stack

- Laravel 13
- Starter kit React officiel (Inertia 2, React 19, TS, Tailwind, shadcn/ui)
- Auth fournie par le starter kit (Fortify) : l'utiliser, ne PAS la réécrire
- spatie/laravel-permission pour les rôles/permissions
- laravel/pulse pour le monitoring de perf (slow requests/queries, exceptions,
  usage). Storage DB, PAS de Redis.
- Filesystem : disque `local` de Laravel (Storage / Flysystem) UNIQUEMENT

# Scope — implémente UNIQUEMENT ceci

1. Auth & comptes : login du starter kit. Toute l'app derrière auth.
   - Rôles via spatie/laravel-permission, MINIMAL : 2 rôles `admin` et `user`.
   - Permissions : `manage-users`, `upload-files`, `delete-files`,
     `create-folders`. Le browse et le download sont ouverts à tout user connecté.
   - Seeder qui crée les rôles, les permissions, et un premier compte admin.
   - Page d'administration des comptes (CRUD users + assignation de rôle),
     accessible UNIQUEMENT au rôle `admin` (middleware permission).
2. Navigation : lister un dossier, y entrer, remonter, breadcrumb du chemin
   courant. Afficher nom, taille lisible, date, type (dossier/fichier).
3. Upload (réservé à `upload-files`) : gros fichiers gérés proprement → upload
   CHUNKÉ / resumable côté front (Uppy ou protocole tus) + endpoint Laravel qui
   reçoit les chunks et réassemble. Tu peux utiliser `pion/laravel-chunk-upload`
   pour ne pas réinventer. Barre de progression côté UI.
4. Download : STREAMED response (`response()->streamDownload()` ou équivalent),
   JAMAIS charger le fichier entier en mémoire. Commente où brancher
   X-Accel-Redirect (nginx) plus tard pour décharger PHP-FPM.
5. Opérations : mkdir (réservé à `create-folders`), rename, delete fichier/dossier
   (réservé à `delete-files`).
6. Monitoring : laravel/pulse installé, dashboard `/pulse` protégé derrière le
   rôle `admin` via la Gate `viewPulse` (réutilise spatie/permission).

# Sécurité (important)

- Confine TOUTES les opérations à la racine du disque `local`. Empêche le path
  traversal (`../../etc/passwd`) : valide/normalise chaque chemin entrant et
  vérifie qu'il reste sous le root du disque. Passe par l'abstraction Storage,
  jamais de chemins système en dur.
- Gate chaque action destructive ou sensible derrière la permission correspondante,
  côté back ET côté UI (cacher les boutons non autorisés).
- `/pulse` inaccessible à un user simple.

# Hors scope — n'implémente RIEN de tout ça (ce sera une v2)

- Disques distants (S3, SFTP, FTP via Flysystem)
- Queues, Redis, Horizon, jobs en arrière-plan
- Zip d'un dossier, thumbnails/previews, scan antivirus, recherche
- Partages publics, quotas, versioning
- spatie/laravel-activitylog (audit) : prévu pour la v2, ne pas l'ajouter ici

# Contraintes

- MVP propre mais simple, pas de sur-engineering. Modèle de permissions minimal.
- Code lisible. Le projet doit build et tourner.

# Ordre de travail (valide chaque étape avant la suivante)

1. Scaffold via le starter kit React officiel. Vérifie que login + build marchent.
2. Installe spatie/laravel-permission. Crée rôles, permissions, seeder admin,
   middleware. Vérifie qu'un admin et un user simple se comportent différemment.
3. Backend filemanager : FileController (list/upload/download/rename/delete/mkdir)
   sur le disque local + validation des chemins. Gate par permissions.
4. Page admin de gestion des comptes (CRUD users + rôles).
5. Front Inertia : page Browser (liste, breadcrumb, navigation, actions selon
   permissions), composant upload chunké (Uppy) avec progression.
6. Installe laravel/pulse, publie la config + migre. Protège `/pulse` via la Gate
   `viewPulse` sur le rôle `admin`. Vérifie que `/pulse` est inaccessible à un user.
7. README court (prérequis, install, comptes de test, commandes pour lancer).
