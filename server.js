const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3011;

// Configuration de la base de données
const db = new sqlite3.Database('./payments.db', (err) => {
  if (err) {
    console.error('Erreur connexion BD:', err);
  } else {
    console.log('✅ Connecté à la base de données SQLite');
  }
});

// Création des tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS payment_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    amount REAL NOT NULL,
    reference TEXT,
    reason TEXT,
    service_type TEXT,
    status TEXT DEFAULT 'pending',
    mtn_reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    transaction_status TEXT,
    mtn_reference_id TEXT,
    response_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payment_links(payment_id)
  )`);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuration MTN MoMo
const MTN_CONFIG = {
  apiUserId: "6781091b-a813-4eda-990c-904efdfc3ccd",
  apiKey: "b106358ee1cb49edb199cd63c6db862f",
  subscriptionKey: "d88580c245d642af91bbb3f9397c8d00",
  targetEnvironment: "mtncameroon",
  baseUrl: "https://proxy.momoapi.mtn.com"
};

// Fonction pour obtenir le token MTN
async function getMTNToken() {
  try {
    const auth = Buffer.from(`${MTN_CONFIG.apiUserId}:${MTN_CONFIG.apiKey}`).toString('base64');
    
    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/collection/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
          'X-Target-Environment': MTN_CONFIG.targetEnvironment
        }
      }
    );
    
    console.log('✅ Token MTN obtenu');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Erreur obtention token MTN:', error.message);
    return null;
  }
}

// Fonction pour initier un paiement MTN
async function initiateMTNPayment(amount, phoneNumber, externalId, payerMessage) {
  try {
    const token = await getMTNToken();
    if (!token) throw new Error('Token non disponible');

    const referenceId = crypto.randomUUID();
    const amountInt = parseInt(amount);

    console.log(`💳 Initiation paiement MTN: ${amountInt} XAF vers ${phoneNumber}`);

    const response = await axios.post(
      `${MTN_CONFIG.baseUrl}/collection/v1_0/requesttopay`,
      {
        amount: String(amountInt),
        currency: "XAF",
        externalId: externalId,
        payer: {
          partyIdType: "MSISDN",
          partyId: phoneNumber
        },
        payerMessage: payerMessage.substring(0, 30),
        payeeNote: "Global Bush Travel"
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': MTN_CONFIG.targetEnvironment,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Paiement MTN initié - Ref: ${referenceId}`);
    return {
      success: true,
      referenceId: referenceId,
      status: response.status
    };
  } catch (error) {
    console.error('❌ Erreur paiement MTN:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Fonction pour vérifier le statut d'un paiement MTN
async function checkMTNPaymentStatus(referenceId) {
  try {
    const token = await getMTNToken();
    if (!token) throw new Error('Token non disponible');

    const response = await axios.get(
      `${MTN_CONFIG.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': MTN_CONFIG.targetEnvironment,
          'Ocp-Apim-Subscription-Key': MTN_CONFIG.subscriptionKey
        }
      }
    );

    console.log(`📊 Statut paiement: ${response.data.status}`);
    return {
      success: true,
      status: response.data.status,
      data: response.data
    };
  } catch (error) {
    console.error('❌ Erreur vérification statut:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// ROUTES API
// ============================================

// Route page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour la facture
app.get('/invoice/:paymentId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoice.html'));
});

// Créer un lien de paiement
app.post('/api/create-payment-link', (req, res) => {
  const { firstName, lastName, phone, email, amount, reference, reason, serviceType } = req.body;

  // Validation
  if (!firstName || !lastName || !phone || !amount) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  if (!phone.startsWith('237') || phone.length !== 12) {
    return res.status(400).json({ error: 'Numéro invalide (doit commencer par 237 et avoir 12 chiffres)' });
  }

  const paymentId = crypto.randomBytes(16).toString('hex');

  db.run(
    `INSERT INTO payment_links (payment_id, first_name, last_name, phone, email, amount, reference, reason, service_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [paymentId, firstName, lastName, phone, email, amount, reference, reason, serviceType],
    function(err) {
      if (err) {
        console.error('❌ Erreur création lien:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }

      const paymentLink = `${req.protocol}://${req.get('host')}/invoice/${paymentId}`;
      
      console.log(`✅ Lien créé: ${paymentId} - ${amount} XAF`);
      res.json({
        success: true,
        paymentId: paymentId,
        paymentLink: paymentLink
      });
    }
  );
});

// Obtenir tous les paiements (pour l'historique)
app.get('/api/all-payments', (req, res) => {
  db.all(
    'SELECT * FROM payment_links ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('❌ Erreur récupération paiements:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json(rows);
    }
  );
});

// Obtenir les détails d'un paiement
app.get('/api/payment/:paymentId', (req, res) => {
  const { paymentId } = req.params;

  db.get(
    'SELECT * FROM payment_links WHERE payment_id = ?',
    [paymentId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Paiement introuvable' });
      }
      res.json(row);
    }
  );
});

// Initier un paiement
app.post('/api/initiate-payment', async (req, res) => {
  const { paymentId, provider, phoneNumber } = req.body;

  db.get(
    'SELECT * FROM payment_links WHERE payment_id = ?',
    [paymentId],
    async (err, payment) => {
      if (err || !payment) {
        return res.status(404).json({ error: 'Paiement introuvable' });
      }

      if (payment.status === 'completed') {
        return res.status(400).json({ 
          error: 'Paiement déjà effectué',
          paid_at: payment.paid_at
        });
      }

      // Utiliser le numéro fourni ou celui du client
      const targetPhone = phoneNumber || payment.phone;

      if (provider === 'mtn') {
        const result = await initiateMTNPayment(
          payment.amount,
          targetPhone,
          paymentId,
          `Paiement ${payment.reason || 'Global Bush'}`
        );

        if (result.success) {
          // Sauvegarder la transaction
          db.run(
            `INSERT INTO payment_transactions (payment_id, provider, mtn_reference_id, transaction_status)
             VALUES (?, ?, ?, ?)`,
            [paymentId, provider, result.referenceId, 'pending']
          );

          // Mettre à jour le lien de paiement
          db.run(
            'UPDATE payment_links SET mtn_reference_id = ? WHERE payment_id = ?',
            [result.referenceId, paymentId]
          );

          res.json({
            success: true,
            message: 'Paiement initié. Vérifiez votre téléphone.',
            referenceId: result.referenceId,
            phoneNumber: targetPhone
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'initiation du paiement'
          });
        }
      } else if (provider === 'orange') {
        // Simulation Orange Money
        res.json({
          success: true,
          message: 'Orange Money en mode simulation',
          simulation: true
        });
      } else {
        res.status(400).json({ error: 'Fournisseur invalide' });
      }
    }
  );
});

// Vérifier le statut d'un paiement
app.get('/api/check-status/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  db.get(
    'SELECT * FROM payment_links WHERE payment_id = ?',
    [paymentId],
    async (err, payment) => {
      if (err || !payment) {
        return res.status(404).json({ error: 'Paiement introuvable' });
      }

      if (!payment.mtn_reference_id) {
        return res.json({ 
          status: payment.status,
          paid_at: payment.paid_at
        });
      }

      const statusResult = await checkMTNPaymentStatus(payment.mtn_reference_id);

      if (statusResult.success) {
        const newStatus = statusResult.status === 'SUCCESSFUL' ? 'completed' : 
                         statusResult.status === 'FAILED' ? 'failed' : 'pending';

        if (newStatus === 'completed' && payment.status !== 'completed') {
          db.run(
            'UPDATE payment_links SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE payment_id = ?',
            [newStatus, paymentId]
          );
          
          console.log(`✅ Paiement complété: ${paymentId}`);
        }

        res.json({
          status: newStatus,
          transactionStatus: statusResult.status,
          details: statusResult.data,
          paid_at: newStatus === 'completed' ? new Date().toISOString() : payment.paid_at
        });
      } else {
        res.json({ 
          status: payment.status,
          paid_at: payment.paid_at
        });
      }
    }
  );
});

// Statistiques globales
app.get('/api/statistics', (req, res) => {
  db.all('SELECT status, service_type, COUNT(*) as count FROM payment_links GROUP BY status, service_type', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(rows);
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     🌍 GLOBAL BUSH PAYMENT SYSTEM 🌍     ║
╠═══════════════════════════════════════════╣
║  Serveur démarré sur:                     ║
║  👉 http://localhost:${PORT}                  ║
║                                           ║
║  Status: ✅ Opérationnel                  ║
║  Database: ✅ SQLite connectée            ║
║  MTN MoMo: ✅ Configuré                   ║
╚═══════════════════════════════════════════╝
  `);
});