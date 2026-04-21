# Project Context — Salon Next POS Customization

## Overview

This project is a **continuation of an existing customization** on a purchased script called **Salon Next** — an AI-powered salon, spa & parlor management system originally from CodeCanyon.

The goal is to extend the system with 6 new feature modules while preserving all existing functionality.

---

## Client Info

| Field | Detail |
|---|---|
| Platform | Sribulancer (freelance marketplace) |
| Communication | WhatsApp |
| Budget | Rp 1.500.000 (Deal approved) |
| Timeline | 30 days (Start: 21 April 2026) |
| Script Source | CodeCanyon — Salon Next |

---

## Environment & Access

| Resource | Detail |
|---|---|
| Live / Staging Site | `fukomo.com` |
| Superadmin Email | `Admin@gmail.com` |
| Superadmin Password | `Admin#123` |
| Source Code | Google Drive (Provided 21/4/2026) |
| VPS Access | (Pending from client) |

---

## What Already Exists (Do Not Break)

These features were built by a previous developer and must remain intact:

| Feature | Notes |
|---|---|
| Sistem Paket Saldo | Credit-based package system |
| WA Automation | Follow-up customer via Fonnte |
| QRIS Payment | Already integrated |
| Split Commission | Employee commission splitting |
| Xendit Payment Gateway | Do NOT touch |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js |
| Database | MongoDB |
| ODM | Mongoose (verify in package.json) |
| WA Gateway | Fonnte |
| Payment Gateway | Xendit (existing, untouched) |

---

## Developer Notes

- Always read existing models before creating new ones
- Always read existing API routes before adding new endpoints
- Communicate blockers immediately via WhatsApp
- Progress is tracked in `docs/PROGRESS.md`
- Client can monitor via Trello board (link to be shared after project starts)
