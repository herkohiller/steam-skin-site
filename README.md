# Steam Collect Demo

A small Steam OpenID + virtual collectible demo. It has no real-money gambling, trading, deposits, withdrawals, or cash-out.

## Run

1. Install Node.js 20+.
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open http://localhost:3000

For deployment, set `BASE_URL` to your HTTPS site URL and a strong `SESSION_SECRET`.

Steam OpenID is handled on the server. The site only uses the returned SteamID as the account identifier.
