# RoadGame — To-Do List

---

## 1. PRIORITY: UX Simplification
- [ ] Audit every screen for visual clutter — aim for fewer elements per view
- [ ] Brighten the color palette (current dark slate feels too heavy)
- [ ] Simplify game card layout — surface only the most important info at a glance
- [ ] Remove the GAME PLAN feature entirely
- [ ] Review tab bar / navigation for anything that can be consolidated
- [ ] Goal: a first-time user should understand the app in under 10 seconds

---

## 2. Splash / Intro Screen
- [ ] Full-screen animated intro every time the app opens (signed-in or not)
- [ ] Show RoadGame logo + tagline: **"Your Team, Near You"**
- [ ] Animate across the screen, then transition to the home screen
- [ ] Keep it short (~1.5–2 seconds)

---

## 3. Affiliate Links — Hotels
Expedia is already wired up. Add two more hotel affiliates:
- [ ] **Booking.com** — sign up at booking.com/affiliate-program
- [ ] **Hotels.com** — sign up at hotels.com/affiliates (runs through CJ Affiliate)
- [ ] Add a button for each on the Hotels tab, in priority order:
  1. Expedia (already done)
  2. Booking.com
  3. Hotels.com
- [ ] Deep-link each button to hotels near the game venue/city

---

## 4. Affiliate Links — Flights
- [ ] Keep Expedia only for flights (already wired up)

---

## 5. Affiliate Links — Tickets
Sign up for all of these, then provide the tracking IDs to add to the code:

| Vendor | Network | Sign-Up |
|--------|---------|---------|
| TickPick | CJ Affiliate | tickpick.com/affiliates |
| Vivid Seats | Direct | vividseats.com/affiliates |
| Gametime | FlexOffers | flexoffers.com |
| SeatGeek | Impact | email seatgeek_affiliate@newengen.com |
| Ticketmaster | Impact | developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up |

- [ ] **PRIORITY:** Contact each vendor and ask specifically whether their affiliate
      tier includes live lowest-price data in the API. TickPick and Vivid Seats
      are most likely to say yes. Start there.
- [ ] Once IDs are in hand, wire tracking parameters into every vendor URL in
      RoadGame.jsx (same pattern as the existing Expedia camref)

---

## 6. City Page — Real Restaurants & Attractions
Replace the current "Google search" links with actual curated results:
- [ ] Show the **2 highest-rated restaurants/bars** near the venue
- [ ] Show the **2 highest-rated attractions** near the venue
- [ ] Add a **"Find More →"** button at the bottom that opens:
      `Google Maps search: things to do in [City]`
- [ ] Options to pull this data: Google Places API (free tier), Yelp Fusion API,
      or Foursquare — research which has the best free tier for this use case

---

## 7. Share / Plan with Friends
- [ ] Add a "Share This Trip" or "Plan with Friends" button on game cards
- [ ] Tapping it generates a shareable link or pre-filled message with the game
      details (team, date, venue, city)
- [ ] Could use Web Share API on mobile for native share sheet

---

## 8. After Affiliates Are Set Up
Once all affiliate IDs are submitted here, in one pass:
- [ ] Wrap all ticket vendor URLs with affiliate tracking
- [ ] Wrap Booking.com and Hotels.com links with affiliate tracking
- [ ] Verify every outbound link is tracked before shipping

---

## Notes
- Merge branch `claude/roadgame-complete-profile-ue7659` to `main` before
  deploying any of the above to production (myroadgame.com)
- SeatGeek deep-links are working and pointing to exact games — just no
  live prices until partner/pricing scope is approved
- Ticketmaster sometimes returns prices via API already; will show when available
