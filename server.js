import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.BASE_URL || `http://localhost:${PORT}`;

const db = new Database('data.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    steam_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    inventory TEXT NOT NULL DEFAULT '[]'
  )
`);

app.use(express.json({ limit: '100kb' }));

app.use(session({
  secret:
    process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString('hex'),

  resave: false,
  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(express.static('public'));


function getUser(req) {

  if (!req.session.steamId) {
    return null;
  }

  return db
    .prepare(
      'SELECT * FROM users WHERE steam_id = ?'
    )
    .get(req.session.steamId);
}


function requireUser(req, res, next) {

  if (!getUser(req)) {
    return res.status(401).json({
      error: 'Not logged in'
    });
  }

  next();
}


/*
  STEAM LOGIN
*/

app.get('/auth/steam', (req, res) => {

  const params = new URLSearchParams({

    'openid.ns':
      'http://specs.openid.net/auth/2.0',

    'openid.mode':
      'checkid_setup',

    'openid.return_to':
      `${BASE_URL}/auth/steam/callback`,

    'openid.realm':
      BASE_URL,

    'openid.identity':
      'http://specs.openid.net/auth/2.0/identifier_select',

    'openid.claimed_id':
      'http://specs.openid.net/auth/2.0/identifier_select'
  });

  res.redirect(
    `https://steamcommunity.com/openid/login?${params}`
  );

});


app.get('/auth/steam/callback', async (req, res) => {

  try {

    const query = req.query;

    if (
      query['openid.mode'] !== 'id_res' ||
      !query['openid.claimed_id']
    ) {

      return res.redirect(
        '/?error=steam_login_failed'
      );

    }


    const verify =
      new URLSearchParams();


    for (
      const [key, value]
      of Object.entries(query)
    ) {

      if (
        typeof value === 'string' &&
        key.startsWith('openid.')
      ) {

        verify.set(key, value);

      }

    }


    verify.set(
      'openid.mode',
      'check_authentication'
    );


    const response =
      await fetch(
        'https://steamcommunity.com/openid/login',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded'
          },

          body: verify
        }
      );


    const text =
      await response.text();


    if (
      !text.includes('is_valid:true')
    ) {

      return res.redirect(
        '/?error=steam_verification_failed'
      );

    }


    const match =
      String(
        query['openid.claimed_id']
      ).match(
        /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/
      );


    if (!match) {

      return res.redirect(
        '/?error=invalid_steam_id'
      );

    }


    const steamId =
      match[1];


    db.prepare(`
      INSERT OR IGNORE INTO users
      (steam_id, created_at)
      VALUES (?, datetime('now'))
    `).run(steamId);


    req.session.steamId =
      steamId;


    res.redirect('/');

  } catch {

    res.redirect(
      '/?error=steam_error'
    );

  }

});


/*
  CURRENT USER
*/

app.get('/api/me', (req, res) => {

  const user =
    getUser(req);


  if (!user) {

    return res.json({
      loggedIn: false
    });

  }


  res.json({

    loggedIn: true,

    steamId:
      user.steam_id,

    inventory:
      JSON.parse(user.inventory)

  });

});


/*
  OPEN CASE
  Virtual collection only.
*/

app.post(
  '/api/open',
  requireUser,
  (req, res) => {

    const user =
      getUser(req);


    const pool = [

      {
        name: 'Nebula',
        rarity: 'Common',
        weight: 55
      },

      {
        name: 'Aurora',
        rarity: 'Uncommon',
        weight: 25
      },

      {
        name: 'Eclipse',
        rarity: 'Rare',
        weight: 13
      },

      {
        name: 'Solaris',
        rarity: 'Epic',
        weight: 6
      },

      {
        name: 'Void Crown',
        rarity: 'Legendary',
        weight: 1
      }

    ];


    const roll =
      Math.random() * 100;


    let sum = 0;

    let item =
      pool[pool.length - 1];


    for (const x of pool) {

      sum += x.weight;

      if (roll < sum) {

        item = x;

        break;

      }

    }


    const inventory =
      JSON.parse(
        user.inventory
      );


    const newItem = {

      id:
        crypto.randomUUID(),

      name:
        item.name,

      rarity:
        item.rarity,

      wonAt:
        new Date().toISOString()

    };


    inventory.unshift(
      newItem
    );


    db.prepare(`
      UPDATE users
      SET inventory = ?
      WHERE steam_id = ?
    `).run(
      JSON.stringify(inventory),
      user.steam_id
    );


    res.json({

      item:
        newItem,

      inventory

    });

  }
);


/*
  LOGOUT
*/

app.post(
  '/api/logout',
  (req, res) => {

    req.session.destroy(
      () => {

        res.json({
          ok: true
        });

      }
    );

  }
);


app.listen(
  PORT,
  () => {

    console.log(
      `Steam Skin Collection running at ${BASE_URL}`
    );

  }
);
