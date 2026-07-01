# WhatsApp Meta Business Templates

Templates to create and submit for approval in
[Meta Business Manager → WhatsApp → Message Templates](https://business.facebook.com/wa/manage/message-templates/)

Phone number ID: **815105745024217**

---

## Status

| Template Name | Status | Notes |
|---|---|---|
| `sold_message` | ✅ Already approved | Existing, working |
| `unsold_message` | ✅ Already approved | Existing, working |
| `team_purchase_summary` | ✅ Already approved | Existing, working |
| `auction_announcement` | ✅ Already approved | Existing, working |
| `post_auction_player_summary` | ⏳ Needs creation | New |
| `post_auction_owner_summary` | ⏳ Needs creation | New |
| `category_auction_starting` | ⏳ Needs creation | New |
| `budget_warning` | ⏳ Needs creation | New |

---

## Templates to Create

### 1. `post_auction_player_summary`

**Category:** `UTILITY`
**Language:** English

**Header:** None

**Body:**
```
Hi *{{1}}* 🏏
The *{{2}}* auction has ended!

Your result: *{{3}}*

All the best for the upcoming matches. View the full results at the link below.
```

**Variables:**
| # | Value | Example |
|---|---|---|
| {{1}} | Player name | Rahul Sharma |
| {{2}} | Tournament name | JPL 2026 |
| {{3}} | Team name (or UNSOLD) | Rajasthan Warriors |

**Footer:** None

**Button:** Call To Action → Visit Website
- Button text: `View Results`
- URL type: Dynamic
- URL: `https://cricbid.online/tournament/{{1}}`

---

### 2. `post_auction_owner_summary`

**Category:** `UTILITY`
**Language:** English

**Header:** None

**Body:**
```
Hi *{{1}}* 🏆
The *{{2}}* auction for *{{3}}* is complete!

Your final squad ({{4}} players):
{{6}}

Total spent: *{{5}}*

All the best for the tournament! 🎉
```

**Variables:**
| # | Value | Example |
|---|---|---|
| {{1}} | Owner name | Amit Patel |
| {{2}} | Team name | Rajasthan Warriors |
| {{3}} | Tournament name | JPL 2026 |
| {{4}} | Number of players bought | 12 |
| {{5}} | Total budget used | 85,000 Pts |
| {{6}} | Squad list (comma separated) | Rahul, Vikas, Suresh +9 more |

**Footer:** None

**Button:** Call To Action → Visit Website
- Button text: `View Squad`
- URL type: Dynamic
- URL: `https://cricbid.online/tournament/{{1}}`

---

### 3. `category_auction_starting`

**Category:** `UTILITY`
**Language:** English

**Header:** None

**Body:**
```
🚨 Heads up *{{1}}*!
The *{{2}}* category auction is starting right now in the *{{3}}* tournament. Get ready!
```

**Variables:**
| # | Value | Example |
|---|---|---|
| {{1}} | Player name | Vikas Yadav |
| {{2}} | Category name | Diamond |
| {{3}} | Tournament name | JPL 2026 |

**Footer:** None

**Button:** None (or optional Visit Website to the live auction page)

---

### 4. `budget_warning`

**Category:** `UTILITY`
**Language:** English

**Header:** None

**Body:**
```
⚠️ *{{1}}*, your team *{{2}}* has used *{{3}}%* of your budget!

Remaining budget: *{{4}}*

Choose your remaining picks wisely.
```

**Variables:**
| # | Value | Example |
|---|---|---|
| {{1}} | Owner name | Amit Patel |
| {{2}} | Team name | Rajasthan Warriors |
| {{3}} | Percentage used | 82 |
| {{4}} | Remaining budget | 18,000 Pts |

**Footer:** None

**Button:** None

---

## How to Submit in Meta Business Manager

1. Go to [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates/)
2. Click **Create template**
3. Select:
   - **Category:** Utility
   - **Name:** (exact name from above, lowercase with underscores)
   - **Language:** English
4. Fill in the Body text exactly as written above
5. Add variables using the `+ Add variable` button — they appear as `{{1}}`, `{{2}}` etc.
6. Add the CTA button if specified
7. Submit for review

**Approval time:** Usually 1–24 hours for Utility templates.

---

## Notes

- Template names must be **exact** — the backend code references them by name
- Use **Utility** category (not Marketing) — faster approval, lower cost per message
- Do NOT use emojis in the template **name**, only in the body text
- Variables must be sequential: `{{1}}`, `{{2}}`, `{{3}}` — no gaps
- Once approved, the template name cannot be changed — only the content can be edited (requires re-approval)
