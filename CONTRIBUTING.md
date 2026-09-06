# Contribuer à Dfi3a

Merci de contribuer au projet. Toute modification doit préserver la séparation des rôles, la confidentialité des données et l'expérience mobile-first.

## Développement

1. Créez une branche depuis `main` avec un nom explicite, par exemple `feat/mission-reminders` ou `fix/map-location`.
2. Installez les dépendances avec `npm install`.
3. Travaillez avec `npm run dev`.
4. Avant de proposer vos changements, exécutez `npm run check`.

## Bonnes pratiques

- Ne publiez jamais de clé privée, de jeton ou de fichier `.env`.
- Utilisez les composants et les styles existants avant d'en créer de nouveaux.
- Conservez Helvetica et le système visuel Dfi3a.
- Ajoutez une migration horodatée pour toute évolution de la base de données.
- Ne modifiez pas une migration déjà appliquée en production.
- Vérifiez les règles RLS pour toute nouvelle table ou fonction Supabase.
- Décrivez clairement le comportement testé dans la pull request.

## Commits

Utilisez des messages courts et orientés résultat :

```text
Add volunteer invitation notifications
Fix NGO mission date validation
```

