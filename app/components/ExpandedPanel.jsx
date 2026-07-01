"use client";
import { useState, useEffect } from "react";
import { BRAND } from "../lib/brand";
import { fmtDate, fmtTime, relInfo, travelTier, modesFor } from "../lib/helpers";
import VendorLogo from "./VendorLogo";

// Rich game-detail panel (tickets / city / hotels / transport / map) shared by
// the mobile schedule and the desktop schedule rail. Extracted verbatim from
// RoadGame.jsx along with its private helpers.

// Expedia Travel Creator deep-link tracking (from a generated affiliate link).
// Wrap ANY Expedia destination URL with expediaAffiliate(url) so the click is
// tracked for commission via camref. Swap the destination freely per game/city.
const EXPEDIA_AFFILIATE = { siteid: "1", camref: "1110lGF6u", creativeref: "1100l68075" };
function expediaAffiliate(destinationUrl) {
  const { siteid, camref, creativeref } = EXPEDIA_AFFILIATE;
  return `https://expedia.com/affiliate?siteid=${siteid}&landingPage=${encodeURIComponent(destinationUrl)}&camref=${camref}&creativeref=${creativeref}`;
}

const CITY_GUIDES = {
  "Nashville, TN": {
    tagline: "Music City — honky-tonks, hot chicken, and good times",
    eat: [
      { name: "Hattie B's Hot Chicken", type: "Iconic hot chicken", price: "$", note: "Get the Damn Hot — bucket-list spicy" },
      { name: "Husk Nashville", type: "Southern fine dining", price: "$$$", note: "Reserve 2+ weeks out" },
      { name: "Prince's Hot Chicken", type: "The original", price: "$", note: "Cash only — worth the wait" },
      { name: "Pancake Pantry", type: "Hillsboro brunch", price: "$$", note: "Sweet potato pancakes" },
    ],
    drink: [
      { name: "Broadway Honky-Tonks", type: "Live music strip", price: "Free cover", note: "Tootsies, Legends, AJ's" },
      { name: "Skull's Rainbow Room", type: "Printers Alley jazz", price: "$$", note: "Old-school vibes" },
      { name: "Bastion", type: "Small cocktail bar", price: "$$$", note: "Reservations required" },
    ],
    see: [
      { name: "Country Music Hall of Fame", type: "Music history", price: "$$", note: "Allow 2-3 hours" },
      { name: "Grand Ole Opry", type: "Live show", price: "$$$", note: "Check showtimes for game weekend" },
      { name: "The Parthenon", type: "Centennial Park", price: "$", note: "Full-scale replica" },
      { name: "Johnny Cash Museum", type: "Downtown", price: "$$", note: "Worth 90 min" },
    ],
  },
  "Pittsburgh, PA": {
    tagline: "Three rivers, steel city soul, and serious sports town",
    eat: [
      { name: "Primanti Bros", type: "Famous sandwich (fries inside)", price: "$", note: "Strip District original" },
      { name: "Pamela's Diner", type: "Pancakes Obama loved", price: "$", note: "Crepe-style hotcakes" },
      { name: "Altius", type: "Mt. Washington fine dining", price: "$$$$", note: "Best skyline view in city" },
    ],
    drink: [
      { name: "Church Brew Works", type: "Brewery in a church", price: "$$", note: "Pierogis and pints" },
      { name: "Hofbräuhaus", type: "South Side beer hall", price: "$$", note: "Walking distance from arena" },
    ],
    see: [
      { name: "Duquesne Incline", type: "City overlook", price: "$", note: "$5 for the view of a lifetime" },
      { name: "Andy Warhol Museum", type: "North Shore", price: "$$", note: "Largest single-artist museum" },
      { name: "Strip District", type: "Food & shopping", price: "Free", note: "Saturday mornings are best" },
    ],
  },
  "Boston, MA": {
    tagline: "History, harbors, and the best clam chowder you'll ever have",
    eat: [
      { name: "Neptune Oyster", type: "Seafood (North End)", price: "$$$", note: "No reservations — go early" },
      { name: "Regina Pizzeria", type: "1926 North End pizza", price: "$$", note: "The original location" },
      { name: "Mike's Pastry", type: "Famous cannoli", price: "$", note: "Pistachio or chocolate chip" },
    ],
    drink: [
      { name: "The Bell in Hand Tavern", type: "Oldest tavern in US (1795)", price: "$$", note: "Near Faneuil Hall" },
      { name: "Drink", type: "Fort Point speakeasy", price: "$$$", note: "No menu — tell them what you like" },
    ],
    see: [
      { name: "Freedom Trail", type: "2.5 mi walk", price: "Free", note: "16 historic sites" },
      { name: "Fenway Park Tour", type: "MLB shrine", price: "$$", note: "Even if you're not here for baseball" },
      { name: "Harvard Square", type: "Cambridge", price: "Free", note: "T to Harvard, walk around" },
    ],
  },
  "New York, NY": {
    tagline: "The city — pick a neighborhood and dive in",
    eat: [
      { name: "Joe's Pizza", type: "NY slice (Greenwich)", price: "$", note: "Cash only, fold the slice" },
      { name: "Katz's Delicatessen", type: "Pastrami sandwich icon", price: "$$", note: "Tip the carver" },
      { name: "Le Bernardin", type: "3-star seafood", price: "$$$$", note: "Reserve 30+ days out" },
    ],
    drink: [
      { name: "Please Don't Tell (PDT)", type: "Speakeasy behind a hot dog joint", price: "$$$", note: "Phone for reservations" },
      { name: "Top of the Rock", type: "Bar with skyline view", price: "$$$", note: "Sunset is unbeatable" },
    ],
    see: [
      { name: "Central Park", type: "843-acre park", price: "Free", note: "Bow Bridge, Bethesda Fountain" },
      { name: "9/11 Memorial", type: "Lower Manhattan", price: "$$", note: "Reserve a time slot" },
      { name: "High Line", type: "Elevated rail park", price: "Free", note: "Sunset walk from 34th to 14th" },
    ],
  },
  "Chicago, IL": {
    tagline: "Deep dish, blues clubs, and the best skyline in America",
    eat: [
      { name: "Lou Malnati's", type: "Deep-dish pizza", price: "$$", note: "Order the butter crust" },
      { name: "Portillo's", type: "Italian beef + Chicago dog", price: "$", note: "No ketchup on the dog. Ever." },
      { name: "Alinea", type: "3-star tasting menu", price: "$$$$", note: "Book 60+ days out" },
    ],
    drink: [
      { name: "The Aviary", type: "Cocktail laboratory", price: "$$$", note: "Reservations required" },
      { name: "Kingston Mines", type: "Live blues club", price: "$$", note: "Open until 4 AM" },
    ],
    see: [
      { name: "Millennium Park / The Bean", type: "Downtown landmark", price: "Free", note: "Crown Fountain at night" },
      { name: "Art Institute", type: "World-class museum", price: "$$", note: "American Gothic + Nighthawks" },
      { name: "Architecture Boat Tour", type: "Chicago River", price: "$$$", note: "90-min CAF tour is the one" },
    ],
  },
  "Los Angeles, CA": {
    tagline: "Beaches, tacos, and Hollywood neon",
    eat: [
      { name: "Bestia", type: "Arts District Italian", price: "$$$", note: "Bone marrow gnocchi" },
      { name: "Grand Central Market", type: "DTLA food hall", price: "$", note: "Eggslut, Sari Sari, Wexler's" },
      { name: "Sushi Gen", type: "Little Tokyo", price: "$$$", note: "Sashimi deluxe lunch" },
    ],
    drink: [
      { name: "Bar Marmont", type: "Chateau Marmont", price: "$$$", note: "Old Hollywood energy" },
      { name: "The Varnish", type: "Speakeasy in DTLA", price: "$$$", note: "Behind Cole's deli" },
    ],
    see: [
      { name: "Griffith Observatory", type: "City + stars view", price: "Free", note: "Sunset hike up" },
      { name: "Venice Beach + Santa Monica", type: "Beach walk", price: "Free", note: "Bike the boardwalk" },
      { name: "The Getty Center", type: "Hilltop museum", price: "Free (parking $)", note: "Half day minimum" },
    ],
  },
};

const DEFAULT_GUIDE = {
  tagline: "Make a weekend of it",
  eat: [
    { name: "Local Top-Rated Restaurant", type: "Check Yelp/Google", price: "$$", note: "Search 'best restaurants' in city" },
    { name: "Stadium District Pub", type: "Pre-game crowd", price: "$$", note: "Walking distance to venue" },
    { name: "Iconic Breakfast Spot", type: "Game-day fuel", price: "$", note: "Open early on game day" },
  ],
  drink: [
    { name: "Local Brewery", type: "Beer scene", price: "$$", note: "Most cities have great craft beer" },
    { name: "Sports Bar Near Venue", type: "Pre/post-game", price: "$$", note: "Watch with fellow fans" },
  ],
  see: [
    { name: "Downtown Walking Tour", type: "City highlights", price: "Free", note: "2-3 hours self-guided" },
    { name: "Top-Rated Local Museum", type: "Indoor option", price: "$$", note: "Good for rainy days" },
    { name: "Main Park or Waterfront", type: "Outdoor space", price: "Free", note: "Stretch your legs" },
  ],
};

function guideFor(city) { return CITY_GUIDES[city] || DEFAULT_GUIDE; }

const TRAVEL = {
  fly:   { icon: "✈", label: "Fly",   color: "#9BB4E8" },
  drive: { icon: "🚗", label: "Drive", color: BRAND.green },
};

function SectionHeader({ children }) {
  return (
    <div className="oswald" style={{
      fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 2,
      marginBottom: 8, textTransform: "uppercase",
    }}>{children}</div>
  );
}

export default function ExpandedPanel({ game, activeTeam, travelTab, setTravelTab, userCity, showToast }) {
  const matchup = game.isHome ? `${activeTeam.team} vs ${game.away}` : `${game.home} vs ${activeTeam.team}`;
  const guide = guideFor(game.city);
  const [tmInfo, setTmInfo] = useState(null);
  const [sgInfo, setSgInfo] = useState(null);
  const [cityGuide, setCityGuide] = useState(null);
  const [cityGuideLoading, setCityGuideLoading] = useState(false);

  useEffect(() => {
    if (travelTab !== "city") return;
    if (!game.lat || !game.lng) return;
    if (cityGuide) return;
    setCityGuideLoading(true);
    fetch(`/api/city-guide?lat=${game.lat}&lng=${game.lng}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error && (data.eat?.length || data.drink?.length || data.see?.length)) setCityGuide(data);
        setCityGuideLoading(false);
      })
      .catch(() => setCityGuideLoading(false));
  }, [travelTab, game.lat, game.lng]);

  function shareGame() {
    const rel = relInfo(game.dateISO);
    const text = `${matchup} · ${rel?.label ?? ""} · ${game.venue}, ${game.city}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "RoadGame", text, url: "https://myroadgame.com" }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text}\nhttps://myroadgame.com`).then(() => showToast?.("Copied to clipboard!")).catch(() => {});
    }
  }

  useEffect(() => {
    let cancelled = false;
    const date = game.dateISO;
    const h = encodeURIComponent(game.home);
    const a = encodeURIComponent(game.away);
    fetch(`/api/tm-price?home=${h}&away=${a}&date=${date}`)
      .then(r => r.json()).then(info => { if (!cancelled) setTmInfo(Object.keys(info).length ? info : null); }).catch(() => {});
    fetch(`/api/sg-price?home=${h}&away=${a}&date=${date}`)
      .then(r => r.json()).then(info => { if (!cancelled) setSgInfo(Object.keys(info).length ? info : null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [game.id]);

  return (
    <div style={{
      background: BRAND.slateDark,
      border: `1.5px solid ${BRAND.green}`, borderTop: "none",
      borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
      padding: 13, marginBottom: 7,
    }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {[
          ["tickets", "TICKETS"],
          ["city", "CITY"],
          ["hotels", "HOTELS"],
          ["transport", "GO"],
        ].map(([t, lbl]) => (
          <button key={t} onClick={() => setTravelTab(t)} className="oswald" style={{
            padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            background: travelTab === t ? BRAND.green : BRAND.slateLight,
            color: travelTab === t ? BRAND.charcoal : BRAND.muted,
            fontSize: 11, fontWeight: 700, letterSpacing: 1,
          }}>{lbl}</button>
        ))}
        <button onClick={shareGame} title="Share game" style={{
          marginLeft: "auto", padding: "5px 10px", borderRadius: 6, border: "none",
          cursor: "pointer", background: BRAND.slateLight, color: BRAND.muted,
          fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center",
        }}>⬆</button>
      </div>

      {travelTab === "tickets" && (() => {
        const date = game.dateISO.split('T')[0];
        const gameQ = encodeURIComponent(matchup);
        const sgSlug = activeTeam.team.toLowerCase().replace(/[.']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const vendors = [
          { name: "SeatGeek", desc: "Deal Score rated", color: "#FF5B49", domain: "seatgeek.com",
            url: sgInfo?.url || `https://seatgeek.com/${sgSlug}-tickets`,
            price: sgInfo?.price ?? game.ticketsFrom ?? null },
          { name: "Ticketmaster", desc: "Official primary", color: "#026CDF", domain: "ticketmaster.com",
            url: tmInfo?.url || `https://www.ticketmaster.com/search?q=${gameQ}&dateStart=${date}`,
            price: tmInfo?.price || null },
          { name: "Vivid Seats", desc: "Rewards program", color: "#7B2D8B", domain: "vividseats.com",
            url: `https://www.vividseats.com/search?searchTerm=${gameQ}` },
          { name: "Gametime", desc: "Last-minute deals", color: "#00A86B", domain: "gametime.co",
            url: `https://gametime.co/search?q=${gameQ}` },
          { name: "TickPick", desc: "No fees · Best price", color: "#1A3A6B", domain: "tickpick.com",
            url: `https://www.tickpick.com/search?q=${gameQ}` },
        ];
        // Feature whichever vendor actually returns the lowest real price.
        // SeatGeek's lowest_price is gated (often null), while Ticketmaster's
        // priceRanges work on a standard key — so don't hard-feature SeatGeek
        // when a cheaper, real number is available elsewhere. Falls back to
        // SeatGeek (deal-score deep link) when no source has a price.
        const priced = vendors.filter(v => v.price != null);
        const featured = priced.length
          ? priced.reduce((lo, v) => (v.price < lo.price ? v : lo))
          : vendors[0];
        const sg = featured;
        const rest = vendors.filter(v => v !== featured);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ background: BRAND.slateLight, borderRadius: 8, padding: "8px 12px", marginBottom: 2 }}>
              <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: BRAND.green }}>FIND TICKETS · {matchup.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 500, marginTop: 2 }}>Compare prices across all major sellers</div>
            </div>

            {/* SeatGeek — featured card */}
            <a href={sg.url} target="_blank" rel="noopener noreferrer" style={{
              background: "rgba(124,194,66,0.10)",
              border: `2px solid ${BRAND.green}`,
              borderRadius: 10, padding: "14px 14px", textDecoration: "none",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <VendorLogo domain={sg.domain} name={sg.name} color={sg.color} size={36} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: BRAND.cream }}>{sg.name}</div>
                    <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, background: BRAND.green, color: BRAND.charcoal, borderRadius: 4, padding: "2px 6px" }}>BEST PICK</div>
                  </div>
                  <div style={{ fontSize: 10, color: BRAND.green, fontWeight: 600 }}>
                    {sg.price ? `From $${sg.price} · ${sg.desc}` : "Deal Score rated · Best prices guaranteed"}
                  </div>
                </div>
              </div>
              <div className="oswald" style={{ fontSize: 12, color: BRAND.green, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>GET TICKETS →</div>
            </a>

            {/* Other vendors */}
            {rest.map(v => (
              <a key={v.name} href={v.url} target="_blank" rel="noopener noreferrer" style={{
                background: BRAND.slateLight,
                border: `1px solid rgba(245,239,226,0.06)`,
                borderRadius: 8, padding: "10px 12px", textDecoration: "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <VendorLogo domain={v.domain} name={v.name} color={v.color} size={30} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: v.price ? BRAND.green : BRAND.muted, fontWeight: 500 }}>
                      {v.price ? `From $${v.price}` : v.desc}
                    </div>
                  </div>
                </div>
                <div className="oswald" style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, letterSpacing: 1 }}>GET TICKETS →</div>
              </a>
            ))}
          </div>
        );
      })()}

      {travelTab === "city" && (() => {
        const liveGuide = cityGuide || null;
        const fallback = guide;
        const sections = [
          { key: "eat", title: "WHERE TO EAT", items: liveGuide?.eat?.length ? liveGuide.eat : fallback.eat },
          { key: "drink", title: "WHERE TO DRINK", items: liveGuide?.drink?.length ? liveGuide.drink : fallback.drink },
          { key: "see", title: "WHAT TO DO", items: liveGuide?.see?.length ? liveGuide.see : fallback.see },
        ];
        return (
          <div>
            <div style={{
              background: BRAND.cream, color: BRAND.charcoal,
              borderRadius: 10, padding: "11px 13px", marginBottom: 12,
              borderLeft: `4px solid ${BRAND.green}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="oswald" style={{ fontSize: 10, color: BRAND.greenDark, fontWeight: 700, letterSpacing: 1.5 }}>CITY GUIDE</div>
                {cityGuideLoading && <div style={{ fontSize: 9, color: "#5A6770", fontStyle: "italic" }}>loading…</div>}
                {liveGuide && <div style={{ fontSize: 9, color: BRAND.greenDark, fontWeight: 600 }}>Live data</div>}
              </div>
              <div className="oswald" style={{ fontSize: 17, fontWeight: 700, color: BRAND.charcoal, marginTop: 1, letterSpacing: -0.3 }}>{game.city.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: "#5A6770", fontStyle: "italic", marginTop: 4, fontWeight: 500 }}>{fallback.tagline}</div>
            </div>

            {sections.map(section => (
              <div key={section.key} style={{ marginBottom: 12 }}>
                <SectionHeader>{section.title}</SectionHeader>
                {(section.items || []).map((item, i) => (
                  <a key={i} href={`https://www.google.com/search?q=${encodeURIComponent(item.name + " " + game.city)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "block", textDecoration: "none", background: BRAND.slateLight, borderRadius: 8, padding: "9px 12px", marginBottom: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.cream }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1, fontWeight: 500 }}>{item.type}</div>
                        <div style={{ fontSize: 10, color: BRAND.green, marginTop: 3, fontStyle: "italic", fontWeight: 500 }}>{item.note}</div>
                      </div>
                      <div className="oswald" style={{
                        fontSize: 10, color: BRAND.amber, fontWeight: 700, flexShrink: 0,
                        background: "rgba(242,165,56,0.12)", padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5,
                      }}>{item.price}</div>
                    </div>
                  </a>
                ))}
              </div>
            ))}

            <a href={`https://www.google.com/maps/search/things+to+do+in+${encodeURIComponent(game.city)}`}
              target="_blank" rel="noopener noreferrer" className="oswald"
              style={{
                display: "block", textAlign: "center",
                background: BRAND.green, color: BRAND.charcoal,
                borderRadius: 8, padding: "11px",
                fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textDecoration: "none",
                boxShadow: `0 3px 0 ${BRAND.greenDark}`,
              }}>EXPLORE {game.city.split(",")[0].toUpperCase()} →</a>
          </div>
        );
      })()}

      {travelTab === "hotels" && (() => {
        const checkIn = game.dateISO.split('T')[0];
        const nextDay = new Date(checkIn);
        nextDay.setDate(nextDay.getDate() + 1);
        const checkOut = nextDay.toISOString().split('T')[0];
        const cityName = game.city.split(",")[0];
        const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(game.city)}&checkin=${checkIn}&checkout=${checkOut}&no_rooms=1&group_adults=2`;
        const hotelsComUrl = `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(game.city)}&q-check-in=${checkIn}&q-check-out=${checkOut}&q-rooms=1`;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ background: BRAND.slateLight, borderRadius: 8, padding: "8px 12px", marginBottom: 2 }}>
              <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: BRAND.green }}>HOTELS NEAR {cityName.toUpperCase()}</div>
              <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 500, marginTop: 2 }}>Compare rates across top booking sites</div>
            </div>

            {/* Expedia */}
            {["Hotels Near Venue", "Downtown Hotels", "Airport Hotels"].map((label, i) => {
              const searches = [
                encodeURIComponent(`hotels near ${game.venue}`),
                encodeURIComponent(`downtown ${cityName} hotel`),
                encodeURIComponent(`airport hotel ${cityName}`),
              ];
              const hotelDest = `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(game.city)}&term=${searches[i]}`;
              return (
                <a key={i} href={expediaAffiliate(hotelDest)} target="_blank" rel="noopener noreferrer" style={{
                  background: BRAND.slateLight,
                  border: i === 0 ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                  borderRadius: 8, padding: "10px 12px", textDecoration: "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <VendorLogo domain="expedia.com" name="Expedia" color="#1B3E94" size={30} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{label}</div>
                      <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>Expedia · Compare rates</div>
                    </div>
                  </div>
                  <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>SEARCH →</div>
                </a>
              );
            })}

            {/* Booking.com */}
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" style={{
              background: BRAND.slateLight, border: `1px solid rgba(245,239,226,0.06)`,
              borderRadius: 8, padding: "10px 12px", textDecoration: "none",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VendorLogo domain="booking.com" name="Booking.com" color="#003580" size={30} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>Hotels Near {cityName}</div>
                  <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>Booking.com · Compare rates</div>
                </div>
              </div>
              <div className="oswald" style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, letterSpacing: 1 }}>SEARCH →</div>
            </a>

            {/* Hotels.com */}
            <a href={hotelsComUrl} target="_blank" rel="noopener noreferrer" style={{
              background: BRAND.slateLight, border: `1px solid rgba(245,239,226,0.06)`,
              borderRadius: 8, padding: "10px 12px", textDecoration: "none",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VendorLogo domain="hotels.com" name="Hotels.com" color="#C8102E" size={30} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>Hotels Near {cityName}</div>
                  <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>Hotels.com · Compare rates</div>
                </div>
              </div>
              <div className="oswald" style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, letterSpacing: 1 }}>SEARCH →</div>
            </a>
          </div>
        );
      })()}

      {travelTab === "transport" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {modesFor(game.dist).map(m => {
            const info = m === "fly"
              ? { est: `~$${Math.round(80 + game.dist * 0.11)}`, time: `${Math.ceil(game.dist / 450)}h`, link: expediaAffiliate(`https://www.expedia.com/Flights`), cta: "SEARCH →" }
              : { est: `~$${Math.round(game.dist * 0.17)} gas`, time: `${Math.round(game.dist / 60)}h`, link: `https://www.google.com/maps/dir/${encodeURIComponent(userCity)}/${encodeURIComponent(game.venue + " " + game.city)}`, cta: "DIRECTIONS →" };
            return (
              <div key={m} style={{ background: BRAND.slateLight, borderLeft: `4px solid ${TRAVEL[m].color}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{TRAVEL[m].icon}</span>
                  <div>
                    <div className="oswald" style={{ fontSize: 12, fontWeight: 700, color: BRAND.cream, letterSpacing: 0.5 }}>{TRAVEL[m].label.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>{info.time} · {info.est}</div>
                  </div>
                </div>
                <a href={info.link} target="_blank" rel="noopener noreferrer" className="oswald" style={{
                  background: BRAND.green, color: BRAND.charcoal, borderRadius: 6, padding: "5px 10px",
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, textDecoration: "none",
                }}>{info.cta}</a>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
