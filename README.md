<p align="center">
  <img src="public/dfi3a-logo.svg" alt="Dfi3a" width="190" />
</p>

<h1 align="center">Dfi3a</h1>

<p align="center">
  La plateforme qui rapproche les bénévoles et les associations au Maroc.
</p>

<p align="center">
  <a href="https://github.com/elkhiar/dfi3a/actions/workflows/ci.yml"><img src="https://github.com/elkhiar/dfi3a/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

## À propos

Dfi3a est une application web mobile-first permettant de découvrir des missions bénévoles, de rejoindre des initiatives locales et de valoriser l'engagement grâce aux D-bux. Les associations disposent d'un espace dédié pour publier leurs missions, communiquer avec les participants et gérer les présences.

Le projet est actuellement en phase de développement actif de son MVP.

## Fonctionnalités

### Bénévoles

- Découverte des missions par liste ou carte
- Recherche par mots-clés, catégories et période
- Inscription, annulation et sauvegarde de missions
- Adresse exacte révélée uniquement après inscription
- Événements à venir et favoris
- Profils, amis, abonnements aux associations et invitations
- Discussions de groupe liées aux missions
- Notifications, D-bux et classement

### Associations

- Candidature et validation par un administrateur
- Tableau de bord opérationnel
- Publication guidée de missions
- Modification et annulation des missions
- Demande de statut urgent
- Gestion des présences et des discussions

### Administration

- Validation des associations
- Modération des demandes urgentes
- Contrôle des accès selon le rôle du compte

## Technologies

- React 19 et TypeScript
- Vite et Tailwind CSS
- Supabase : authentification, base de données, stockage et temps réel
- MapLibre GL et Geoapify
- Application web progressive (PWA)

## Installation locale

Prérequis : Node.js 22.12 ou version ultérieure et un projet Supabase configuré.

```bash
git clone https://github.com/elkhiar/dfi3a.git
cd dfi3a
npm install
```

Copiez ensuite `.env.example` vers `.env.local` et renseignez les variables :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_GEOAPIFY_API_KEY=your_geoapify_key
```

Appliquez les migrations du dossier `supabase/migrations` dans leur ordre chronologique, puis lancez l'application :

```bash
npm run dev
```

## Commandes

| Commande | Description |
| --- | --- |
| `npm run dev` | Lance le serveur de développement |
| `npm run build` | Vérifie TypeScript et génère la version de production |
| `npm run lint` | Analyse la qualité du code |
| `npm run check` | Exécute le lint et la compilation complète |
| `npm run preview` | Prévisualise la version de production |

## Structure du projet

```text
src/
  auth/          Authentification et rôles
  components/    Composants réutilisables
  layouts/       Interfaces bénévole et association
  lib/           Configuration et utilitaires
  pages/         Écrans de l'application
  services/      Accès aux données Supabase
supabase/
  migrations/    Schéma, règles RLS et fonctions SQL
public/          Identité visuelle et ressources PWA
```

## Sécurité et confidentialité

- Les comptes bénévole, association et administrateur sont séparés.
- Les règles Row Level Security protègent les données dans Supabase.
- Les coordonnées exactes des missions ne sont pas exposées publiquement.
- Les clés privées et les fichiers d'environnement ne doivent jamais être ajoutés au dépôt.

Consultez [SECURITY.md](SECURITY.md) pour signaler une vulnérabilité.

## Contribution

Les règles de contribution sont décrites dans [CONTRIBUTING.md](CONTRIBUTING.md).
