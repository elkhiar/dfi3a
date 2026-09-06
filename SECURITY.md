# Politique de sécurité

## Signaler une vulnérabilité

N'ouvrez pas de ticket public pour une vulnérabilité ou une exposition de données.

Utilisez la fonctionnalité **Report a vulnerability** dans l'onglet Security du dépôt GitHub. Décrivez le problème, son impact potentiel et les étapes permettant de le reproduire, sans inclure de données personnelles réelles.

## Informations sensibles

Les éléments suivants ne doivent jamais être publiés :

- clés de service Supabase ;
- jetons d'accès ou mots de passe ;
- fichiers `.env` ;
- documents d'inscription des associations ;
- adresses privées des missions ;
- données personnelles des bénévoles.

Les clés publiques utilisées par le client doivent être accompagnées de règles RLS strictes côté Supabase.

