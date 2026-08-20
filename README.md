# Zanfibre Billing System

Zanfibre is an internet billing and network management system for MikroTik/RouterOS networks. It includes an admin dashboard, a customer payment portal, manual Mixx payment approval, billing packages, device/client monitoring, and network operations tools.

Current deployment is for testing on Render free tier.

## Live Links

Admin dashboard:

https://zanfibre-frontend.onrender.com/login

Customer portal:

https://zanfibre-frontend.onrender.com/portal

Backend API:

https://zanfibre-backend.onrender.com

Backend health check:

https://zanfibre-backend.onrender.com/api/health

GitHub repository:

https://github.com/zda23b024/zanfibre_billing_system

## Important Render Note

This project is currently deployed on Render free tier. Free services can sleep when not used. When the backend is sleeping or restarting, you may see:

- `502 Bad Gateway`
- slow first request
- login/payment requests taking 30 to 60 seconds

To check if backend is awake, open:

https://zanfibre-backend.onrender.com/api/health

Working response should look like:

```json
{"status":"ok","timestamp":"2026-08-20T14:35:30.981Z"}
```

## Admin Access

Open:

https://zanfibre-frontend.onrender.com/login

Default login after a fresh database:

```text
Username: admin
Password: admin
```

After first login, change the password immediately:

```text
Settings -> Change My Password
```

The password fields include an eye icon so you can show/hide the password while typing.

## Customer Access

Customer opens:

https://zanfibre-frontend.onrender.com/portal

Customer flow:

1. Customer chooses a package.
2. Customer pays manually to the Mixx merchant number shown on the page.
3. Customer enters phone number and transaction reference.
4. Payment becomes pending.
5. Admin checks the payment in the Billing page.
6. Admin approves or rejects the payment.
7. After approval, the system creates/activates the customer internet access.

Current Mixx details:

```text
Mixx Merchant Number: 18198639
Merchant Name: IBRAHIM YAHYA ALLY
```

For a Mixx SMS like this:

```text
Muamala: 26995570469543
Risiti: 41904/71307481
```

The customer should enter this as the transaction reference:

```text
26995570469543
```

Only approve payment if the money really arrived to your Zanfibre/Mixx account.

## Payment Method Now

Current payment mode is:

```text
Manual Mixx payment with admin approval
```

This means Selcom is not required right now.

The customer pays manually, then admin approves after checking the Mixx payment message/account.

Selcom can be added later when you have:

- Selcom vendor ID
- API key
- secret key
- callback URL
- business onboarding completed

## Billing Packages

Admin can manage packages here:

```text
Admin Dashboard -> Billing
```

You can edit:

- package name
- price
- duration
- download speed
- upload speed
- data limit in MB
- unlimited data
- device limit
- active/inactive status

Default starter packages may appear after database setup:

| Package | Price | Speed | Data | Devices |
|---|---:|---|---|---:|
| 1 Hour | TSh 500 | 3M | Unlimited | 1 |
| 24 Hours | TSh 2,000 | 5M | 2 GB | 1 |
| 7 Days | TSh 10,000 | 8M | 20 GB | 2 |

These are editable. They are starter data, not fixed production prices.

## What Admin Should Check Before Approving

Before approving a manual Mixx payment, admin should check:

- customer phone number
- selected package
- amount paid
- transaction reference
- Mixx/SMS confirmation
- merchant number/name paid to

Approve only when:

- amount matches package price
- transaction ID is real
- money arrived to your Mixx account
- payment was made to the correct merchant number

Reject when:

- amount is wrong
- transaction ID is fake or reused
- money went to another merchant
- customer entered incorrect details

## Render Environment Variables

Set these on the backend service:

```env
JWT_SECRET=zanfibre_super_secret_login_key_2026_make_it_long
ENCRYPTION_KEY=12345678901234567890123456789012
CORS_ORIGIN=https://zanfibre-frontend.onrender.com
CUSTOMER_PORTAL_BASE_URL=https://zanfibre-frontend.onrender.com/portal
PAYMENT_PROVIDER=manual_mixx
DEFAULT_CURRENCY=TZS
MIXX_MERCHANT_NUMBER=18198639
MIXX_MERCHANT_NAME=IBRAHIM YAHYA ALLY
INFLUXDB_URL=http://127.0.0.1:9
INFLUXDB_TOKEN=
INFLUXDB_ORG=zanfibre
INFLUXDB_BUCKET=metrics
```

Set this on the frontend static site:

```env
VITE_API_BASE_URL=https://zanfibre-backend.onrender.com/api
```

## Render Deployment Steps

1. Push latest code to GitHub.

```powershell
git status
git add .
git commit -m "Update Zanfibre deployment"
git push origin main
```

2. Open Render dashboard.

https://dashboard.render.com

3. If using Blueprint:

```text
Blueprints -> zanfibre-billing -> Syncs -> Manual sync
```

4. If deploying services one by one:

```text
zanfibre-backend -> Manual Deploy -> Deploy latest commit
zanfibre-frontend -> Manual Deploy -> Deploy latest commit
```

5. Wait until both services show `Live`.

6. Test backend:

https://zanfibre-backend.onrender.com/api/health

7. Test admin:

https://zanfibre-frontend.onrender.com/login

8. Test customer portal:

https://zanfibre-frontend.onrender.com/portal

## If Backend Shows 502

Do this:

1. Wait 1 minute and refresh. Render free service may be waking up.
2. Open Render:

```text
zanfibre-backend -> Logs
```

3. Search for errors.
4. If the service is sleeping or restarted, open:

https://zanfibre-backend.onrender.com/api/health

5. If still failing, redeploy:

```text
zanfibre-backend -> Manual Deploy -> Deploy latest commit
```

If logs show `GET /api/health 200`, backend is working.

## If Admin Login Fails

First check backend health:

https://zanfibre-backend.onrender.com/api/health

If backend works but admin login fails, reset the admin user in Render Postgres:

```sql
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$12$3SBZeIcWVerDHgp6x2bf7eZM7wBnyUKtkiPqXeZgC.z9cDZODD5Te', 'admin')
ON CONFLICT (username)
DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin';
```

This sets:

```text
Username: admin
Password: admin
```

Change it immediately after login.

## Customer Portal Warning

You may see this message:

```text
Reopen this page from the WiFi login screen so we can connect this device after payment.
```

This means the customer opened the portal directly, not from the MikroTik Hotspot captive login page.

Direct opening is okay for testing payment submission, but automatic device connection needs MikroTik Hotspot redirect data like MAC address and IP address.

For automatic customer device activation, the portal should be opened from the MikroTik WiFi login page.

## MikroTik Hotspot Setup

Use WinBox to configure MikroTik.

Download WinBox for Windows:

https://download.mikrotik.com/routeros/winbox/4.3/WinBox_Windows.zip

Basic steps:

1. Extract the ZIP.
2. Open `WinBox.exe`.
3. Click `Neighbors`.
4. Select your MikroTik router.
5. Login to the router.
6. Go to:

```text
IP -> Hotspot -> Hotspot Setup
```

7. Choose the customer WiFi/LAN interface, usually `bridge`, `wlan1`, or your hotspot bridge.
8. Follow the wizard.
9. Create a test hotspot user.
10. Connect with a phone and check that the captive login page appears.

## Hotspot Redirect To Zanfibre Portal

For real captive portal use, MikroTik login page should redirect customers to:

```text
https://zanfibre-frontend.onrender.com/portal?routerId=ROUTER_ID&mac=$(mac)&ip=$(ip)&loginUrl=$(link-login)&originalUrl=$(link-orig)
```

Replace `ROUTER_ID` with the device/router ID from Zanfibre admin.

Also allow these domains in MikroTik Hotspot walled garden:

```text
zanfibre-frontend.onrender.com
zanfibre-backend.onrender.com
```

Without walled garden, unpaid customers may not be able to open the payment portal.

## Important Network Limitation

Render is cloud hosting. Your MikroTik router is usually inside your local network.

For Zanfibre backend to create Hotspot users automatically, the backend must be able to reach the MikroTik RouterOS API.

Options:

- expose RouterOS API safely with firewall rules and strong password
- use VPN between Render/backend and router network
- later move backend to a VPS/server near the router network
- run backend locally/on-premise for the router site

For now, manual approval can work for testing the payment workflow, but full automatic internet activation needs backend-to-router connectivity.

## Admin Dashboard Sections

Dashboard:

Shows online/offline devices, connected clients, alerts, traffic summary, and network health.

Billing:

Shows packages, payments, pending approvals, revenue, and customer sessions.

Topology:

Shows a visual network map of routers, switches, access points, and clients.

Traffic:

Shows usage, top clients, upload/download, and traffic analytics. It needs MikroTik/NetFlow setup for full data.

Events:

Shows system events, alerts, login activity, device changes, and network problems.

Security:

Shows risky router settings, unsafe services, firewall warnings, and hardening recommendations.

Clients:

Shows connected customer devices, MAC/IP, usage, online status, and troubleshooting details.

Network Services:

Manages services like DHCP, DNS, NTP, WireGuard, Syslog, NetFlow, Discovery, and SNMP.

Firmware:

Checks RouterOS versions and helps manage firmware updates.

Backups:

Creates and stores MikroTik configuration backups.

Settings:

Manages device credentials, alerts, automation, config templates, tags, maintenance, users, password change, and 2FA.

## Production Checklist

Before real customer use:

- change default admin password
- use a real domain name
- set correct Render environment variables
- test customer payment approval
- test MikroTik Hotspot redirect
- test backend access to MikroTik API
- configure backups for database and router configs
- decide long-term hosting/database plan
- later replace manual Mixx approval with Selcom or another real payment provider if needed

## Local Development

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Docker local deployment:

```powershell
docker compose up -d
```

## License

AGPLv3
