// ============================================
// PARTIE 1: BACKEND (server.js)
// ============================================


// ============================================
// PARTIE 2: FRONTEND HTML (public/index.html)
// ============================================
/*

*/


// ============================================
// PARTIE 3: PAGE FACTURE (public/invoice.html)
// ============================================
/*

*/


// ============================================
// FICHIER PACKAGE.JSON
// ============================================
/*
{
  "name": "perenkap-payment-system",
  "version": "1.0.0",
  "description": "Système de paiement mobile MTN/Orange avec liens de paiement",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "body-parser": "^1.20.2",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/


// ============================================
// STRUCTURE DES FICHIERS
// ============================================
/*
projet/
├── server.js                    (Code backend ci-dessus)
├── package.json                 (Dépendances)
├── payments.db                  (Base de données SQLite - créée automatiquement)
└── public/
    ├── index.html              (Page de création de lien)
    └── invoice.html            (Page de facture/paiement)


INSTRUCTIONS D'INSTALLATION ET DÉMARRAGE:
==========================================

1. Créer le dossier du projet:
   mkdir perenkap-payment
   cd perenkap-payment

2. Initialiser le projet:
   npm init -y

3. Installer les dépendances:
   npm install express sqlite3 body-parser axios
   npm install --save-dev nodemon

4. Créer la structure:
   - Copier le code serveur dans server.js
   - Créer le dossier public/
   - Créer index.html et invoice.html dans public/

5. Démarrer le serveur:
   npm start
   
   Ou en mode développement:
   npm run dev

6. Accéder à l'application:
   http://localhost:3000

7. IMPORTANT - Configuration de la route pour les factures:
   Ajouter cette route dans server.js après les autres routes:
*/

// Route pour servir la page de facture
app.get('/invoice/:paymentId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});

/*
FONCTIONNALITÉS:
=================

✅ Création de liens de paiement personnalisés
✅ Génération automatique d'ID uniques
✅ Formulaire responsive (mobile-first)
✅ Validation des numéros camerounais (237XXXXXXXXX)
✅ Page de facture professionnelle avec design moderne
✅ Intégration MTN Mobile Money (fonctionnel)
✅ Orange Money en mode simulation
✅ Vérification automatique du statut de paiement
✅ Base de données SQLite pour la persistance
✅ Interface Tailwind CSS moderne et adaptative
✅ Animations et transitions fluides
✅ Copie du lien de paiement en un clic
✅ Affichage en temps réel du statut

SÉCURITÉ:
=========
⚠️ Pour la production, ajoutez:
- Variables d'environnement pour les clés API
- Authentification utilisateur
- HTTPS obligatoire
- Rate limiting
- Validation côté serveur renforcée
- Logs de sécurité
- Protection CSRF

BASE DE DONNÉES:
================
La base SQLite contient 2 tables:
- payment_links: Liens de paiement créés
- payment_transactions: Historique des transactions

TESTS:
======
1. Créer un lien: http://localhost:3000
2. Remplir le formulaire avec un vrai numéro MTN Cameroun
3. Générer le lien
4. Ouvrir le lien de facture
5. Cliquer sur MTN MoMo
6. Valider le paiement sur votre téléphone
7. Le statut se met à jour automatiquement

NOTES:
======
- Les montants sont convertis en entiers (XAF)
- Les messages MTN sont limités à 30 caractères
- La vérification du statut se fait toutes les 3 secondes
- Orange Money est en simulation (retourne succès immédiat)
*/