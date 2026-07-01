import { useState, useEffect, useMemo, useRef } from "react";
import { fetchTeamSchedule } from "./espn";
import { VENUES } from "./venues";
import { findCity, geocodeCity, reverseGeocode } from "./cities";
import { sendOtpCode, verifyEmailOtp, signInWithGoogle, getCurrentUser, getMyProfile, upsertMyProfile, signOutSupabase, supabase } from "./supabase";
import { BRAND } from "./lib/brand";
import { LEAGUES, LEAGUE_POPULARITY, leagueInSeason, SORTED_LEAGUES, TEAMS_BY_LEAGUE } from "./lib/leagues";
import { haversine, fmtDate, fmtTime, relInfo, travelTier, modesFor } from "./lib/helpers";
import VendorLogo from "./components/VendorLogo";
import DesktopApp from "./components/desktop/DesktopApp";
import ExpandedPanel from "./components/ExpandedPanel";
import LogoMark from "./components/LogoMark";
import AuthModal from "./components/AuthModal";
import LocationPicker from "./components/LocationPicker";
import TeamLogo from "./components/TeamLogo";

// ─── Desktop layout plumbing (PR 1 of the desktop build) ────────────────────
// The desktop UI activates at >= DESKTOP_MIN px, but stays gated behind
// DESKTOP_ENABLED until every desktop view is built (full-parity launch).
// useIsDesktop resolves after mount so the first render always matches the
// mobile default — no hydration mismatch.
const DESKTOP_MIN = 1280;
const DESKTOP_ENABLED = true; // desktop layout live at >= DESKTOP_MIN px

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);
  return isDesktop;
}

// Opt-in preview: ?desktop=1 forces the desktop layout on wide screens even
// while DESKTOP_ENABLED is off, so the WIP can be reviewed on the live site
// without exposing it to everyone. Read post-mount to avoid hydration mismatch.
function useDesktopPreviewFlag() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(new URLSearchParams(window.location.search).has("desktop")); } catch {}
  }, []);
  return on;
}

// ─── AFFILIATE IDs ────────────────────────────────────────────────────────────
// expediaAffiliate moved to ./components/ExpandedPanel

// ─── BRAND PALETTE (matched to logo) ──────────────────────────────────────────
// BRAND tokens moved to ./lib/brand

// ─── STORAGE ABSTRACTION ──────────────────────────────────────────────────────
const memStore = {};
const storage = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
        try { const r = await window.storage.get(key); return r && r.value ? r.value : null; } catch (e) { return null; }
      }
      if (typeof localStorage !== "undefined") return localStorage.getItem("roadgame:" + key);
      return memStore[key] || null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.set === "function") {
        try { await window.storage.set(key, value); return true; } catch (e) {}
      }
      if (typeof localStorage !== "undefined") { localStorage.setItem("roadgame:" + key, value); return true; }
      memStore[key] = value; return true;
    } catch (e) { return false; }
  },
  async delete(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.delete === "function") {
        try { await window.storage.delete(key); } catch (e) {}
      }
      if (typeof localStorage !== "undefined") localStorage.removeItem("roadgame:" + key);
      delete memStore[key];
      return true;
    } catch (e) { return false; }
  },
};

// haversine moved to ./lib/helpers

// VENUES imported from ./venues

// CITY_GUIDES / DEFAULT_GUIDE / guideFor moved to ./components/ExpandedPanel

// LEAGUES, LEAGUE_POPULARITY, leagueInSeason, SORTED_LEAGUES, TEAMS_BY_LEAGUE
// moved to ./lib/leagues. fmtDate, fmtTime, relInfo, travelTier, modesFor moved
// to ./lib/helpers.
// TRAVEL moved to ./components/ExpandedPanel

async function computeAlerts(following, alertRadius, userLat, userLng) {
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86400000);
  const monthOut = new Date(now.getTime() + 30 * 86400000);

  // Fetch real schedules for all followed teams in parallel
  const schedules = await Promise.all(
    following.map(f => fetchTeamSchedule(f.team, f.league).then(games => ({ team: f.team, league: f.league, games: games || [] })))
  );

  const all = [];
  schedules.forEach(({ team, league, games }) => {
    games.forEach(g => {
      const gameDate = new Date(g.dateISO);
      if (gameDate < now) return;
      const dist = haversine(userLat, userLng, g.lat, g.lng);
      if (dist <= alertRadius && gameDate <= monthOut) {
        all.push({ ...g, dist, team, league, isWeek: gameDate <= weekOut });
      }
    });
  });
  return all.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
}

// ─── LOGO MARK (uses /public/logo.png) ───────────────────────────────────────
// LogoMark moved to ./components/LogoMark

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function RoadGame() {

  // Desktop layout gate — no-op until DESKTOP_ENABLED is flipped on. Exposed as
  // a data attribute so the breakpoint can be verified in devtools meanwhile.
  const isDesktop = useIsDesktop();
  const desktopPreview = useDesktopPreviewFlag();
  const useDesktopLayout = (DESKTOP_ENABLED || desktopPreview) && isDesktop;

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authCity, setAuthCity] = useState("");
  const [authCoords, setAuthCoords] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newCoords, setNewCoords] = useState(null);
  const [guestLoc, setGuestLoc] = useState({ city: '', lat: null, lng: null });
  const [locPickerOpen, setLocPickerOpen] = useState(false);
  const [locInput, setLocInput] = useState('');
  const [locDetecting, setLocDetecting] = useState(false);
  const userLat = user?.lat ?? guestLoc.lat ?? 35.4443;
  const userLng = user?.lng ?? guestLoc.lng ?? -82.5098;
  const userCity = user?.city || guestLoc.city || '';
  const [loading, setLoading] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingProfile, setPendingProfile] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const [view, setView] = useState("following");
  // Remembers which main screen you were on before opening the Account page,
  // so its back button returns you there instead of a blank view.
  const [preProfileView, setPreProfileView] = useState("following");
  const [activeLeague, setActiveLeague] = useState(SORTED_LEAGUES[0].id);
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [maxDist, setMaxDist] = useState(2000);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [travelTab, setTravelTab] = useState("tickets");
  const [toast, setToast] = useState(null);

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertRadius, setAlertRadius] = useState(350);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [installExpanded, setInstallExpanded] = useState(false);
  const [installPlatform, setInstallPlatform] = useState("generic");
  const [showSplash, setShowSplash] = useState(true);
  const [expandedFollowTeam, setExpandedFollowTeam] = useState(null);
  const [browseLeagueGames, setBrowseLeagueGames] = useState({});
  const [browseLeagueLoading, setBrowseLeagueLoading] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  const navHydrated = useRef(false);

  // Restore the last-visited tab / league / open team on refresh so a reload
  // returns you to where you were instead of the default landing page. Read in
  // an effect (not useState init) to avoid an SSR/hydration mismatch; the splash
  // screen covers the brief restore. Auth-only views are reconciled below once
  // we know whether anyone is signed in.
  useEffect(() => {
    try {
      const nav = JSON.parse(localStorage.getItem('roadgame:nav') || '{}');
      if (nav.view) setView(nav.view);
      if (nav.activeLeague) setActiveLeague(nav.activeLeague);
      if (nav.activeTeam) setActiveTeam(nav.activeTeam);
    } catch {}
  }, []);

  useEffect(() => {
    // Skip the first run so we don't overwrite saved nav with the defaults
    // before the restore effect has applied.
    if (!navHydrated.current) { navHydrated.current = true; return; }
    try {
      localStorage.setItem('roadgame:nav', JSON.stringify({ view, activeLeague, activeTeam }));
    } catch {}
  }, [view, activeLeague, activeTeam]);

  // Don't strand a signed-out visitor on an auth-only view after a refresh.
  useEffect(() => {
    if (loading) return;
    if (!user && (view === 'profile' || view === 'alerts')) setView('following');
  }, [loading, user, view]);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) setInstallPlatform('ios');
    else if (/Android/.test(ua)) setInstallPlatform('android');
    else setInstallPlatform('desktop');
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    function handler(e) { if (!e.target.closest('[data-acct-menu]')) setAccountMenuOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountMenuOpen]);

  useEffect(() => {
    const hasMagicToken = typeof window !== 'undefined' && (window.location.hash.includes('access_token') || window.location.search.includes('code='));
    const magicTimeout = hasMagicToken ? setTimeout(() => setLoading(false), 8000) : null;

    try {
      const saved = localStorage.getItem('roadgame:guestLoc');
      if (saved) setGuestLoc(JSON.parse(saved));
    } catch {}

    async function loadAuthedUser() {
      try {
        const supaUser = await getCurrentUser();
        if (supaUser) {
          const profile = await getMyProfile(supaUser.id);
          if (profile && profile.name && profile.city) {
            setUser({ id: supaUser.id, email: supaUser.email, name: profile.name, city: profile.city, lat: profile.lat, lng: profile.lng });
            setFollowing(profile.following || []);
            setAlertsEnabled(profile.alerts_enabled ?? true);
            setAlertRadius(profile.alert_radius ?? 350);
          } else {
            setPendingProfile({ id: supaUser.id, email: supaUser.email });
          }
        }
      } catch (e) {}
      if (!hasMagicToken) setLoading(false);
    }
    loadAuthedUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        clearTimeout(magicTimeout);
        const supaUser = session.user;
        const profile = await getMyProfile(supaUser.id);
        if (profile && profile.name && profile.city) {
          setUser({ id: supaUser.id, email: supaUser.email, name: profile.name, city: profile.city, lat: profile.lat, lng: profile.lng });
          setFollowing(profile.following || []);
          setAlertsEnabled(profile.alerts_enabled ?? true);
          setAlertRadius(profile.alert_radius ?? 350);
          setPendingProfile(null);
        } else {
          setPendingProfile({ id: supaUser.id, email: supaUser.email });
        }
        setLoading(false);
      }
      if (event === 'SIGNED_OUT') {
        clearTimeout(magicTimeout);
        setUser(null);
        setFollowing([]);
        setPendingProfile(null);
        setLoading(false);
      }
    });
    return () => { subscription.unsubscribe(); clearTimeout(magicTimeout); };
  }, []);

  useEffect(() => {
    if (!user) return;
    upsertMyProfile({
      id: user.id,
      email: user.email,
      name: user.name,
      city: user.city,
      lat: user.lat,
      lng: user.lng,
      following,
      alerts_enabled: alertsEnabled,
      alert_radius: alertRadius,
    }).catch(() => {});
  }, [following, alertsEnabled, alertRadius, user]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function handleAuth() {
    setAuthError(null);
    const email = authEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || !email.includes(".")) { setAuthError("Enter a valid email address"); return; }
    try {
      await sendOtpCode(email);
      setOtpSent(true);
      setOtpCode('');
    } catch (e) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('security') || msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('after')) {
        setAuthError("Too many attempts. Please wait a few minutes, then try again.");
      } else {
        setAuthError(msg || "Couldn't send code. Please try again.");
      }
    }
  }

  async function handleVerifyOtp() {
    setAuthError(null);
    const code = otpCode.trim();
    if (code.length < 6 || code.length > 8) { setAuthError("Enter the code from your email"); return; }
    try {
      await verifyEmailOtp(authEmail.trim().toLowerCase(), code);
      setAuthOpen(false);
      setOtpSent(false);
      setOtpCode('');
      setAuthEmail('');
    } catch (e) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('otp')) {
        setAuthError("That code is incorrect or expired. Request a new one.");
      } else if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('rate')) {
        setAuthError("Too many attempts. Please wait a few minutes.");
      } else {
        setAuthError(msg || "Couldn't verify code. Try again.");
      }
    }
  }
async function saveNewLocation() {
    if (!newCity.trim()) { showToast("Enter a city first"); return; }

    let location = null;
    if (newCoords) {
      location = { lat: newCoords.lat, lng: newCoords.lng, city: newCity.trim() };
    } else {
      const geo = await geocodeCity(newCity.trim());
      if (!geo) { showToast(`Couldn't find "${newCity}". Try a major city nearby.`); return; }
      location = { lat: geo.lat, lng: geo.lng, city: geo.name };
    }

    const updatedUser = { ...user, ...location };
    setUser(updatedUser);
    await upsertMyProfile({
      id: user.id,
      email: user.email,
      name: user.name,
      ...location,
      following,
      alerts_enabled: alertsEnabled,
      alert_radius: alertRadius,
    }).catch(() => {});

    setEditingLocation(false);
    setNewCity("");
    setNewCoords(null);
    showToast(`Location updated to ${location.city}`);
  }

  async function detectNewLocation() {
    if (!navigator.geolocation) {
      showToast("Your browser doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        setNewCity(cityName || "My Location");
        setNewCoords({ lat: latitude, lng: longitude });
      },
      () => {
        showToast("Location permission denied. Type your city instead.");
      },
      { timeout: 10000 }
    );
  }

  async function saveLocPicker() {
    const city = locInput.trim();
    if (!city) { showToast("Enter a city first"); return; }
    const geo = await geocodeCity(city);
    if (!geo) { showToast(`Couldn't find "${city}". Try a major city nearby.`); return; }
    if (user) {
      const updatedUser = { ...user, city: geo.name, lat: geo.lat, lng: geo.lng };
      setUser(updatedUser);
      await upsertMyProfile({ id: user.id, email: user.email, name: user.name, city: geo.name, lat: geo.lat, lng: geo.lng, following, alerts_enabled: alertsEnabled, alert_radius: alertRadius }).catch(() => {});
    } else {
      const loc = { city: geo.name, lat: geo.lat, lng: geo.lng };
      setGuestLoc(loc);
      try { localStorage.setItem('roadgame:guestLoc', JSON.stringify(loc)); } catch {}
    }
    setLocPickerOpen(false);
    setLocInput('');
    showToast(`Location set to ${geo.name}`);
  }

  async function detectLocPicker() {
    if (!navigator.geolocation) { showToast("Geolocation not supported by your browser"); return; }
    setLocDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        setLocInput(cityName || '');
        setLocDetecting(false);
        if (!user && cityName) {
          const loc = { city: cityName, lat: latitude, lng: longitude };
          setGuestLoc(loc);
          try { localStorage.setItem('roadgame:guestLoc', JSON.stringify(loc)); } catch {}
          setLocPickerOpen(false);
          setLocInput('');
          showToast(`Location set to ${cityName}`);
        }
      },
      () => { setLocDetecting(false); showToast("Location permission denied. Type your city manually."); },
      { timeout: 10000 }
    );
  }

  async function detectLocation() {
    setAuthError(null);
    if (!navigator.geolocation) {
      setAuthError("Your browser doesn't support location detection. Type your city instead.");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        setAuthCity(cityName || "My Location");
        setAuthCoords({ lat: latitude, lng: longitude });
        setDetectingLocation(false);
      },
      (err) => {
        setDetectingLocation(false);
        setAuthError("Location permission denied. Type your city instead.");
      },
      { timeout: 10000 }
    );
  }

  async function completeProfile() {
    setAuthError(null);
    if (!authName.trim()) { setAuthError("Enter your name"); return; }
    if (!authCity.trim() && !authCoords) { setAuthError("Enter your city or use 'Detect my location'"); return; }

    let location = null;
    if (authCoords) {
      location = { lat: authCoords.lat, lng: authCoords.lng, city: authCity.trim() };
    } else {
      const geo = await geocodeCity(authCity.trim());
      if (!geo) { setAuthError(`Couldn't find "${authCity}". Try a major city nearby.`); return; }
      location = { lat: geo.lat, lng: geo.lng, city: geo.name };
    }

    try {
      await upsertMyProfile({
        id: pendingProfile.id,
        email: pendingProfile.email,
        name: authName.trim(),
        ...location,
        following: [],
        alerts_enabled: true,
        alert_radius: 350,
      });
      setUser({ id: pendingProfile.id, email: pendingProfile.email, name: authName.trim(), ...location });
      setFollowing([]);
      setAlertsEnabled(true);
      setAlertRadius(350);
      setPendingProfile(null);
      setAuthName(""); setAuthCity(""); setAuthCoords(null);
      showToast(`Welcome to RoadGame, ${authName.trim().split(" ")[0]}!`);
    } catch (e) {
      setAuthError(`Error saving profile: ${e.message || "Please try again"}`);
    }
  }

  async function signOut() {
    await signOutSupabase();
    setUser(null); setFollowing([]); setActiveTeam(null); setView("following");
  }

  // Request notification permission, subscribe, and register with the backend.
  // Shared by the mobile profile and the desktop account view.
  async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    setPushGranted(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      showToast("Push notifications enabled!");
    } catch {}
  }

  function toggleFollow(team, league) {
    if (!user) { setAuthOpen(true); return; }
    const exists = following.find(f => f.team === team && f.league === league);
    if (exists) { setFollowing(following.filter(f => !(f.team === team && f.league === league))); showToast(`Unfollowed ${team}`); }
    else { setFollowing([...following, { team, league }]); showToast(`Following ${team}`); }
  }
  function isFollowing(team, league) { return !!following.find(f => f.team === team && f.league === league); }
  function openSchedule(team, league, gameId = null) { setActiveTeam({ team, league }); setExpanded(gameId); setTravelTab("tickets"); }

  const teamsInLeague = useMemo(() => {
    const list = TEAMS_BY_LEAGUE[activeLeague] || [];
    return list.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  }, [activeLeague, search]);

const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState(false); // true = API failed, false = loaded ok

  useEffect(() => {
    let cancelled = false;
    async function loadSchedule() {
      if (!activeTeam) { setSchedule([]); setScheduleError(false); return; }
      setScheduleLoading(true);
      setScheduleError(false);

      const realGames = await fetchTeamSchedule(activeTeam.team, activeTeam.league);

      if (cancelled) return;

      if (realGames === null) {
        // Network/server error — don't claim the season is over
        setSchedule([]);
        setScheduleError(true);
      } else if (realGames.length > 0) {
        // Best-effort ticket prices from SeatGeek, matched by game date.
        const sgPriceRes = await fetch(`/api/sg-team-prices?team=${encodeURIComponent(activeTeam.team)}&league=${activeTeam.league}`).catch(() => null);
        const priceMap = sgPriceRes?.ok ? await sgPriceRes.json().catch(() => ({})) : {};
        if (cancelled) return;
        const enriched = realGames.map(g => ({
          ...g,
          dist: haversine(userLat, userLng, g.lat, g.lng),
          ticketsFrom: g.ticketsFrom ?? priceMap[g.dateISO?.slice(0, 10)] ?? null,
        }));
        setSchedule(enriched);
      } else {
        setSchedule([]);
      }
      setScheduleLoading(false);
    }
    loadSchedule();
    return () => { cancelled = true; };
  }, [activeTeam, userLat, userLng]);

  const visibleSchedule = useMemo(() => nearbyOnly ? schedule.filter(g => g.dist != null && g.dist <= maxDist) : schedule, [schedule, nearbyOnly, maxDist]);
  const reachableCount = schedule.filter(g => g.dist != null && g.dist <= maxDist).length;
  const leagueMeta = LEAGUES.find(l => l.id === (activeTeam?.league || activeLeague));

  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      if (!alertsEnabled || following.length === 0) { setAlerts([]); return; }
      const result = await computeAlerts(following, alertRadius, userLat, userLng);
      if (!cancelled) setAlerts(result);
    }
    loadAlerts();
    return () => { cancelled = true; };
  }, [following, alertRadius, alertsEnabled, userLat, userLng]);
  const weekAlerts = alerts.filter(a => a.isWeek);

  useEffect(() => {
    if (view !== "teams" || !userLat || !userLng) return;
    if (browseLeagueGames[activeLeague]) return;
    let cancelled = false;
    setBrowseLeagueLoading(true);
    const teams = TEAMS_BY_LEAGUE[activeLeague] || [];
    const now = new Date();
    Promise.all(
      teams.map(async team => {
        let games = await fetchTeamSchedule(team, activeLeague);
        if (!games || games.length === 0) return { team, closest: null };
        const nearby = games
          .filter(g => g.lat && g.lng && new Date(g.dateISO) > now)
          .map(g => ({ ...g, dist: Math.round(haversine(userLat, userLng, g.lat, g.lng)) }))
          .sort((a, b) => a.dist - b.dist);
        return { team, closest: nearby[0] ?? null };
      })
    ).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(({ team, closest }) => { map[team] = closest; });
      setBrowseLeagueGames(prev => ({ ...prev, [activeLeague]: map }));
      setBrowseLeagueLoading(false);
    });
    return () => { cancelled = true; };
  }, [view, activeLeague, userLat, userLng]);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  // Push notification subscription — runs when user is signed in and alerts are enabled
  useEffect(() => {
    if (!user || !alertsEnabled) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "denied") return;

    setPushGranted(Notification.permission === "granted");

    async function subscribePush() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) { setPushGranted(true); return; }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        setPushGranted(true);

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });

        const { data: { session } } = await supabase.auth.getSession();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch {}
    }

    subscribePush();
  }, [user?.id, alertsEnabled]);

  // ─────────────── LOADING ────────────────
  if (loading) {
    // Blank background until the splash screen takes over — no flash of text.
    return <div style={{ minHeight: "100vh", background: BRAND.slate }} />;
  }

  // ─────────────── COMPLETE PROFILE ────────────────
  if (pendingProfile) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: BRAND.slate,
        backgroundImage: `radial-gradient(circle at 20% 20%, ${BRAND.greenGlow} 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(124,194,66,0.08) 0%, transparent 40%)`,
        fontFamily: "'Inter', sans-serif",
        color: BRAND.cream,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
        <style>{`
          * { box-sizing: border-box; }
          .ticket-stub { position: relative; }
          .ticket-stub::before, .ticket-stub::after {
            content: ''; position: absolute; width: 16px; height: 16px;
            background: ${BRAND.slate}; border-radius: 50%; top: 50%; transform: translateY(-50%);
          }
          .ticket-stub::before { left: -8px; }
          .ticket-stub::after { right: -8px; }
        `}</style>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <LogoMark size={140} />
            </div>
            <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500 }}>
              One last step
            </div>
          </div>

          <div className="ticket-stub" style={{
            background: BRAND.cream,
            borderRadius: 12,
            padding: "26px 24px",
            color: BRAND.charcoal,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}>
            <div className="oswald" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4, color: BRAND.charcoal }}>
              COMPLETE YOUR PROFILE
            </div>
            <div style={{ fontSize: 12, color: "#5A6770", marginBottom: 20, fontWeight: 500 }}>
              Signed in as <strong>{pendingProfile.email}</strong>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Your Name</label>
              <input type="text" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name"
                style={{
                  width: "100%", padding: "11px 13px", borderRadius: 8,
                  background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                  color: BRAND.charcoal, fontSize: 14, outline: "none", fontWeight: 500,
                  fontFamily: "'Inter', sans-serif",
                }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Your City</label>
              <input type="text" value={authCity}
                onChange={e => { setAuthCity(e.target.value); setAuthCoords(null); }}
                placeholder="Charlotte, NC"
                style={{
                  width: "100%", padding: "11px 13px", borderRadius: 8,
                  background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                  color: BRAND.charcoal, fontSize: 14, outline: "none", fontWeight: 500,
                  fontFamily: "'Inter', sans-serif",
                  marginBottom: 6,
                }} />
              <button type="button" onClick={detectLocation} disabled={detectingLocation}
                className="oswald"
                style={{
                  background: "transparent", color: BRAND.greenDark,
                  border: `1px solid ${BRAND.greenDark}`, borderRadius: 7,
                  padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  cursor: "pointer", width: "100%",
                }}>
                {detectingLocation ? "DETECTING..." : "📍 USE MY CURRENT LOCATION"}
              </button>
            </div>

            {authError && (
              <div style={{
                background: "rgba(232,69,69,0.08)", border: `1.5px solid ${BRAND.red}`,
                color: BRAND.red, borderRadius: 7, padding: "8px 12px", fontSize: 12, marginBottom: 12, fontWeight: 600,
              }}>{authError}</div>
            )}

            <button onClick={completeProfile} style={{
              width: "100%", padding: "13px", borderRadius: 8, border: "none", cursor: "pointer",
              background: BRAND.green, color: BRAND.charcoal,
              fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Oswald', sans-serif",
              boxShadow: `0 4px 0 ${BRAND.greenDark}`,
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "translateY(2px)"; e.currentTarget.style.boxShadow = `0 2px 0 ${BRAND.greenDark}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 0 ${BRAND.greenDark}`; }}
            >LET'S GO →</button>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 1.5, opacity: 0.4 }}>
              {[3,1,2,4,1,3,2,1,4,2,3,1,2,1,3,4,1,2,3,1,4,2,1,3].map((w, i) => (
                <div key={i} style={{ width: w, height: 24, background: BRAND.charcoal }} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: BRAND.muted, textAlign: "center", marginTop: 12, letterSpacing: 1, fontWeight: 600 }}>
              ADMIT ONE · NO PASSWORD REQUIRED
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT (>=1280px, gated) ───
  // All hooks above have already run, so the mobile data pipeline (schedule,
  // browse-games, alerts, persistence) stays live; only presentation swaps.
  if (useDesktopLayout) {
    return (
      <DesktopApp bag={{
        view, setView, activeTeam, setActiveTeam,
        activeLeague, setActiveLeague, search, setSearch,
        maxDist, setMaxDist, nearbyOnly, setNearbyOnly,
        browseLeagueGames, browseLeagueLoading,
        userLat, userLng, userCity, user, following,
        isFollowing, toggleFollow, openSchedule, toast, showToast,
        schedule, visibleSchedule, scheduleLoading, scheduleError,
        reachableCount, leagueMeta, expanded, setExpanded,
        travelTab, setTravelTab,
        alerts, alertRadius, setAuthOpen,
        preProfileView, signOut, enablePush, pushGranted,
        editingLocation, setEditingLocation, newCity, setNewCity, setNewCoords,
        saveNewLocation, detectNewLocation,
        alertsEnabled, setAlertsEnabled, setAlertRadius, weekAlerts,
        authOpen, otpSent, setOtpSent, otpCode, setOtpCode,
        authEmail, setAuthEmail, authError, setAuthError, handleAuth, handleVerifyOtp,
        locPickerOpen, setLocPickerOpen, locInput, setLocInput,
        saveLocPicker, detectLocPicker, locDetecting,
      }} />
    );
  }

  // ─────────────── MAIN APP ────────────────
  return (
    <div data-layout={useDesktopLayout ? "desktop" : "mobile"} data-viewport={isDesktop ? "wide" : "narrow"} style={{
      minHeight: "100vh",
      background: BRAND.slate,
      fontFamily: "'Inter', sans-serif",
      color: BRAND.cream,
      paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
      overflowX: "hidden",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input[type=range] { height: 4px; accent-color: ${BRAND.green}; }
        .oswald { font-family: 'Oswald', sans-serif; }
        .acct-initials { display: none; }
        @media (max-width: 600px) {
          .acct-full { display: none; }
          .acct-initials { display: inline; }
        }
        @keyframes splashAcross {
          0%   { opacity: 0; transform: translateX(-40px); }
          20%  { opacity: 1; transform: translateX(0); }
          80%  { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(40px); }
        }
        /* Tasteful micro-animations — fully disabled under reduced-motion. */
        @keyframes rgRise   { from { opacity: 0; transform: translateY(8px); }  to { opacity: 1; transform: none; } }
        @keyframes rgFade   { from { opacity: 0; }                              to { opacity: 1; } }
        @keyframes rgExpand { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes rgToast  { from { opacity: 0; transform: translate(-50%, -12px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .rg-press { transition: transform 0.12s ease; }
        @media (prefers-reduced-motion: no-preference) {
          .rg-rise   { animation: rgRise 0.34s cubic-bezier(0.22,1,0.36,1) backwards; }
          .rg-fade   { animation: rgFade 0.26s ease both; }
          .rg-expand { animation: rgExpand 0.24s cubic-bezier(0.22,1,0.36,1) backwards; }
          .rg-toast  { animation: rgToast 0.30s cubic-bezier(0.22,1,0.36,1) backwards; }
          .rg-press:active { transform: scale(0.97); }
        }
      `}</style>

      {showSplash && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: BRAND.slateDark,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 18, pointerEvents: "none",
        }}>
          <div style={{ animation: "splashAcross 1.6s ease forwards" }}>
            <LogoMark size={110} />
          </div>
          <div className="oswald" style={{
            fontSize: 18, fontWeight: 700, color: BRAND.cream, letterSpacing: 3,
            textTransform: "uppercase", textAlign: "center",
            animation: "splashAcross 1.6s ease 0.1s both",
          }}>Your Team, Near You</div>
        </div>
      )}

      {toast && (
        <div className="rg-toast" style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: BRAND.cream, color: BRAND.charcoal,
          borderRadius: 8, padding: "9px 18px",
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          zIndex: 100, boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
          borderLeft: `4px solid ${BRAND.green}`,
        }}>{toast}</div>
      )}

      {/* Location Picker Modal */}
      <LocationPicker open={locPickerOpen} setLocPickerOpen={setLocPickerOpen}
        locInput={locInput} setLocInput={setLocInput} saveLocPicker={saveLocPicker}
        detectLocPicker={detectLocPicker} locDetecting={locDetecting} />

      <AuthModal open={authOpen} user={user} setAuthOpen={setAuthOpen}
        otpSent={otpSent} setOtpSent={setOtpSent} otpCode={otpCode} setOtpCode={setOtpCode}
        authEmail={authEmail} setAuthEmail={setAuthEmail} authError={authError} setAuthError={setAuthError}
        handleAuth={handleAuth} handleVerifyOtp={handleVerifyOtp} />

      {/* Header */}
      <div style={{
        background: BRAND.slateDark,
        borderBottom: `2px solid ${BRAND.green}`,
        paddingTop: "calc(11px + env(safe-area-inset-top))",
        paddingBottom: 11,
        paddingLeft: "calc(14px + env(safe-area-inset-left))",
        paddingRight: "calc(14px + env(safe-area-inset-right))",
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <LogoMark size={32} />
          <button onClick={() => { setLocInput(userCity); setLocPickerOpen(true); }} style={{
            background: "transparent", border: "none", cursor: "pointer", padding: 0, minWidth: 0,
          }}>
            {userCity ? (
              <div style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "40vw" }}>
                📍 {userCity}
              </div>
            ) : (
              <div style={{ fontSize: 9, color: BRAND.green, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
                📍 SET LOCATION
              </div>
            )}
          </button>
        </div>
        <div data-acct-menu style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {weekAlerts.length > 0 && (
            <div style={{
              background: BRAND.green, color: BRAND.charcoal,
              borderRadius: 999, width: 22, height: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
              fontFamily: "'Oswald', sans-serif",
            }}>{weekAlerts.length}</div>
          )}
          {user ? (
            <button onClick={() => setAccountMenuOpen(o => !o)} className="oswald" style={{
              height: 32, padding: "0 10px", borderRadius: 8, border: "none", cursor: "pointer",
              background: accountMenuOpen ? BRAND.green : BRAND.slateLight,
              color: accountMenuOpen ? BRAND.charcoal : BRAND.cream,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0, whiteSpace: "nowrap",
            }}>
              <span className="acct-full">Welcome, {(user.name || user.email || "").split(" ")[0]}</span>
              <span className="acct-initials">{(user.name || user.email || "").split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("") || "?"}</span>
            </button>
          ) : (
            <button onClick={() => setAccountMenuOpen(o => !o)} className="oswald" style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              background: accountMenuOpen ? BRAND.slateLight : BRAND.green,
              color: accountMenuOpen ? BRAND.cream : BRAND.charcoal,
              fontSize: 11, fontWeight: 700, letterSpacing: 1, flexShrink: 0,
            }}>SIGN IN</button>
          )}

          {accountMenuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300,
              background: BRAND.slateDark, borderRadius: 12,
              border: `1px solid rgba(124,194,66,0.25)`,
              boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
              minWidth: 230, overflow: "hidden",
            }}>
              {/* MY ACCOUNT */}
              <button onClick={() => { setAccountMenuOpen(false); if (user) { if (view === "following" || view === "teams") setPreProfileView(view); setView("profile"); } else { setAuthOpen(true); } }}
                className="oswald"
                style={{
                  width: "100%", textAlign: "left", padding: "14px 16px",
                  background: "transparent", border: "none", cursor: "pointer",
                  borderBottom: `1px solid rgba(255,255,255,0.07)`,
                  display: "flex", alignItems: "center", gap: 10,
                  color: BRAND.cream, fontSize: 12, fontWeight: 700, letterSpacing: 1,
                }}>
                <span style={{ fontSize: 16 }}>👤</span>
                {user ? "MY ACCOUNT" : "SIGN IN / CREATE ACCOUNT"}
              </button>

              {/* INSTALL THE APP */}
              <div>
                <button onClick={() => setInstallExpanded(x => !x)} className="oswald"
                  style={{
                    width: "100%", textAlign: "left", padding: "14px 16px",
                    background: "transparent", border: "none", cursor: "pointer",
                    borderBottom: installExpanded ? `1px solid rgba(255,255,255,0.07)` : "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: BRAND.cream, fontSize: 12, fontWeight: 700, letterSpacing: 1,
                  }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📲</span> INSTALL THE APP
                  </span>
                  <span style={{ color: BRAND.green, fontSize: 14, transform: installExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                </button>

                {installExpanded && (
                  <div style={{ padding: "12px 16px 14px", background: "rgba(0,0,0,0.2)" }}>
                    {installPlatform === 'ios' && (
                      <>
                        <InstallStep n={1} text={<>Tap the <strong style={{ color: BRAND.cream }}>Share</strong> button <span style={{ fontSize: 15 }}>⎋</span> at the bottom of Safari</>} />
                        <InstallStep n={2} text={<>Scroll down and tap <strong style={{ color: BRAND.cream }}>Add to Home Screen</strong></>} />
                        <InstallStep n={3} text={<>Tap <strong style={{ color: BRAND.cream }}>Add</strong> — RoadGame appears on your home screen</>} />
                      </>
                    )}
                    {installPlatform === 'android' && (
                      <>
                        <InstallStep n={1} text={<>Tap the <strong style={{ color: BRAND.cream }}>⋮ menu</strong> in Chrome (top right)</>} />
                        <InstallStep n={2} text={<>Tap <strong style={{ color: BRAND.cream }}>Add to Home Screen</strong> or <strong style={{ color: BRAND.cream }}>Install App</strong></>} />
                        <InstallStep n={3} text={<>Tap <strong style={{ color: BRAND.cream }}>Install</strong> — RoadGame opens in its own window</>} />
                      </>
                    )}
                    {installPlatform === 'desktop' && (
                      <>
                        <InstallStep n={1} text={<>Look for the <strong style={{ color: BRAND.cream }}>install icon ⊕</strong> on the right side of your address bar</>} />
                        <InstallStep n={2} text={<>Click it and select <strong style={{ color: BRAND.cream }}>Install</strong></>} />
                        <InstallStep n={3} text={<>RoadGame opens as a <strong style={{ color: BRAND.cream }}>standalone app</strong> on your desktop</>} />
                      </>
                    )}
                    {installPlatform === 'generic' && (
                      <InstallStep n={1} text={<>Open in Chrome or Safari and use <strong style={{ color: BRAND.cream }}>"Add to Home Screen"</strong> from the browser menu</>} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      {!activeTeam && view !== "profile" && (
        <div style={{ display: "flex", gap: 4, padding: "10px 14px 0", maxWidth: 600, margin: "0 auto" }}>
          {[
            ["following", "FOLLOWING"],
            ["teams", "BROWSE TEAMS"],
          ].map(([id, lbl]) => (
            <button key={id} onClick={() => setView(id)} className="oswald rg-press" style={{
              flex: 1, padding: "9px 6px", borderRadius: 7, border: "none", cursor: "pointer",
              background: view === id ? BRAND.green : BRAND.slateLight,
              color: view === id ? BRAND.charcoal : BRAND.muted,
              fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
            }}>{lbl}</button>
          ))}
        </div>
      )}

      {/* ── PROFILE ── */}
      {view === "profile" && user && (
        <div style={{ padding: "16px 14px", maxWidth: 500, margin: "0 auto" }}>
          <button onClick={() => setView(preProfileView)} className="oswald" style={{
            background: BRAND.slateLight, border: "none",
            borderRadius: 7, padding: "6px 12px", color: BRAND.cream,
            fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", marginBottom: 18,
          }}>← BACK</button>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 14,
              background: BRAND.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 800, color: BRAND.charcoal,
              fontFamily: "'Oswald', sans-serif",
            }}>{(user.name || user.email || "?")[0].toUpperCase()}</div>
            <div>
              <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>{(user.name || user.email || "User").toUpperCase()}</div>
              <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 500 }}>{user.email}</div>
            </div>
          </div>
<SectionCard title="YOUR LOCATION" icon="📍">
            {!editingLocation ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream }}>{userCity}</div>
                  <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>
                    All distances calculated from here
                  </div>
                </div>
                <button onClick={() => { setEditingLocation(true); setNewCity(""); setNewCoords(null); }}
                  className="oswald" style={{
                    background: "transparent",
                    border: `1.5px solid ${BRAND.green}`,
                    color: BRAND.green,
                    borderRadius: 7, padding: "6px 12px",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                  }}>CHANGE</button>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
                  New City
                </label>
                <input type="text" value={newCity}
                  onChange={e => { setNewCity(e.target.value); setNewCoords(null); }}
                  placeholder="Charlotte, NC"
                  onKeyDown={e => e.key === "Enter" && saveNewLocation()}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    background: BRAND.slateDark,
                    border: `1.5px solid rgba(245,239,226,0.1)`,
                    color: BRAND.cream, fontSize: 14, outline: "none", fontWeight: 500,
                    fontFamily: "'Inter', sans-serif", marginBottom: 8, boxSizing: "border-box",
                  }} />
                <button type="button" onClick={detectNewLocation} className="oswald" style={{
                  background: "transparent", color: BRAND.muted,
                  border: `1px solid ${BRAND.muted}`, borderRadius: 7,
                  padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  cursor: "pointer", width: "100%", marginBottom: 10,
                }}>
                  📍 USE MY CURRENT LOCATION
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditingLocation(false); setNewCity(""); setNewCoords(null); }}
                    className="oswald" style={{
                      flex: 1, background: "transparent",
                      border: `1.5px solid ${BRAND.muted}`,
                      color: BRAND.muted,
                      borderRadius: 7, padding: "8px",
                      fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                    }}>CANCEL</button>
                  <button onClick={saveNewLocation} className="oswald" style={{
                    flex: 1, background: BRAND.green, color: BRAND.charcoal,
                    border: "none", borderRadius: 7, padding: "8px",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                    boxShadow: `0 3px 0 ${BRAND.greenDark}`,
                  }}>SAVE</button>
                </div>
              </div>
            )}
          </SectionCard>
          <SectionCard title="ALERT SETTINGS" icon="●">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.cream }}>Weekly alerts</div>
                <div style={{ fontSize: 11, color: BRAND.muted }}>Notify me when teams play nearby</div>
              </div>
              <button onClick={() => setAlertsEnabled(!alertsEnabled)} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: alertsEnabled ? BRAND.green : BRAND.slateLight, position: "relative",
                transition: "all 0.15s",
              }}>
                <div style={{
                  position: "absolute", top: 2, left: alertsEnabled ? 22 : 2,
                  width: 20, height: 20, borderRadius: "50%", background: BRAND.cream,
                  transition: "left 0.15s",
                }} />
              </button>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: BRAND.muted, fontWeight: 500 }}>Alert radius</span>
                <span className="oswald" style={{ fontSize: 13, fontWeight: 700, color: BRAND.green, letterSpacing: 0.5 }}>{alertRadius} MI</span>
              </div>
              <input type="range" min={50} max={1000} step={25} value={alertRadius}
                onChange={e => setAlertRadius(Number(e.target.value))} disabled={!alertsEnabled}
                style={{ width: "100%", opacity: alertsEnabled ? 1 : 0.3 }} />
              <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 6, fontWeight: 500 }}>
                Alerts trigger when followed teams play within {alertRadius} mi of {userCity} in the next 7 days.
              </div>
            </div>

            {alertsEnabled && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(255,255,255,0.06)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.cream }}>Push notifications</div>
                    <div style={{ fontSize: 11, color: BRAND.muted }}>
                      {pushGranted ? "Active — you'll get a morning reminder on game week" : "Get notified even when the app is closed"}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: pushGranted ? BRAND.green : BRAND.muted }}>
                    {pushGranted ? "ON" : "OFF"}
                  </div>
                </div>
                {!pushGranted && ("Notification" in window) && Notification.permission !== "denied" && (
                  <button onClick={enablePush} className="oswald" style={{
                    marginTop: 10, width: "100%", padding: "9px",
                    background: BRAND.green, color: BRAND.charcoal,
                    border: "none", borderRadius: 7, cursor: "pointer",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1,
                  }}>ENABLE PUSH NOTIFICATIONS</button>
                )}
                {("Notification" in window) && Notification.permission === "denied" && (
                  <div style={{ fontSize: 10, color: BRAND.red, marginTop: 8 }}>
                    Notifications blocked in browser settings — enable them to turn this on.
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="YOUR STATS">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { value: following.length, label: "TEAMS", accent: BRAND.cream, target: "teams" },
                { value: alerts.length, label: "ALERTS", accent: BRAND.green, target: "following" },
                { value: weekAlerts.length, label: "THIS WEEK", accent: weekAlerts.length > 0 ? BRAND.red : BRAND.cream, target: "following" },
              ].map(({ value, label, accent, target }) => (
                <button key={label} onClick={() => setView(target)} style={{
                  background: BRAND.slateDark, borderRadius: 8, padding: "9px 10px",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}>
                  <div className="oswald" style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
                  <div className="oswald" style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
                </button>
              ))}
            </div>
          </SectionCard>

          <button onClick={signOut} className="oswald" style={{
            width: "100%", padding: "12px", borderRadius: 8, border: `1.5px solid ${BRAND.red}`,
            background: "transparent", color: BRAND.red,
            fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
            marginTop: 10,
          }}>SIGN OUT</button>
        </div>
      )}

      {/* ── TEAMS BROWSER ── */}
      {view === "teams" && !activeTeam && (
        <div className="rg-fade" style={{ padding: "14px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>PICK YOUR TEAMS</div>
            {browseLeagueLoading && <div style={{ fontSize: 10, color: BRAND.green, fontWeight: 600 }}>loading games…</div>}
          </div>
          <div style={{ fontSize: 11, color: BRAND.muted, marginBottom: 14, fontWeight: 500 }}>5 leagues · 130+ teams</div>

          <div style={{ display: "flex", gap: 5, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
            {SORTED_LEAGUES.map(l => (
              <button key={l.id} onClick={() => setActiveLeague(l.id)} className="oswald rg-press" style={{
                padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: activeLeague === l.id ? BRAND.green : BRAND.slateLight,
                color: activeLeague === l.id ? BRAND.charcoal : BRAND.muted,
                fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
              }}>{l.emoji} {l.name}</button>
            ))}
          </div>

          <input type="text" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: BRAND.slateLight,
              border: `1.5px solid rgba(245,239,226,0.1)`, borderRadius: 8,
              padding: "10px 13px", fontSize: 13, color: BRAND.cream,
              outline: "none", marginBottom: 12, fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
            }} />

          {teamsInLeague.map((team, ti) => {
            const venue = VENUES[team];
            const dist = venue ? haversine(userLat, userLng, venue.lat, venue.lng) : null;
            const tier = dist !== null ? travelTier(dist) : null;
            const fav = isFollowing(team, activeLeague);
            const browseClosest = (browseLeagueGames[activeLeague] ?? {})[team] ?? null;
            return (
              <div key={team} className="rg-rise rg-press" style={{
                animationDelay: `${Math.min(ti, 12) * 28}ms`,
                background: fav ? "rgba(124,194,66,0.08)" : BRAND.slateLight,
                border: fav ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                borderRadius: 10, padding: "11px 13px", marginBottom: 6,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }} onClick={() => openSchedule(team, activeLeague)}>
                  <TeamLogo team={team} league={activeLeague} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{team}</div>
                    {venue && (
                      <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1, fontWeight: 500 }}>
                        {venue.c}{!browseLeagueGames[activeLeague]
                          ? <span style={{ opacity: 0.35 }}> • …</span>
                          : browseClosest
                            ? ` • Closest Game: ${browseClosest.city.split(",")[0]} - ${browseClosest.dist}m`
                            : dist !== null ? ` • ${dist}m` : ""}
                      </div>
                    )}
                  </div>
                </div>
                {tier && (
                  <div className="oswald" style={{
                    background: tier.bg, color: tier.color,
                    borderRadius: 4, padding: "3px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
                  }}>{tier.label}</div>
                )}
                <button onClick={() => toggleFollow(team, activeLeague)} style={{
                  background: fav ? BRAND.green : "transparent",
                  border: `1.5px solid ${fav ? BRAND.green : BRAND.muted}`,
                  color: fav ? BRAND.charcoal : BRAND.muted,
                  borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5,
                }}>{fav ? "✓" : "+"}</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FOLLOWING VIEW ── */}
      {view === "following" && !activeTeam && (
        <div className="rg-fade" style={{ padding: "14px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>
            {user ? `HEY, ${(user.name || user.email || "").split(" ")[0].toUpperCase() || "THERE"}.` : "FOLLOWING"}
          </div>
          <div style={{ fontSize: 11, color: BRAND.muted, marginBottom: 14, fontWeight: 500 }}>
            {following.length > 0
              ? `${following.length} team${following.length === 1 ? "" : "s"} · tap to see nearby games`
              : "Follow teams to see their games near you"}
          </div>

          {!user ? (
            <div style={{
              background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`,
              borderRadius: 12, padding: "28px 22px", textAlign: "center",
            }}>
              <LogoMark size={56} />
              <div className="oswald" style={{ fontSize: 16, fontWeight: 700, color: BRAND.cream, letterSpacing: 0.5, marginTop: 12 }}>
                SIGN IN TO FOLLOW TEAMS
              </div>
              <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
                Pick your favorites and we'll show you their games near {userCity.split(",")[0] || "you"}.
              </div>
              <button onClick={() => setAuthOpen(true)} className="oswald" style={{
                background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 8,
                padding: "10px 22px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
                boxShadow: `0 3px 0 ${BRAND.greenDark}`,
              }}>SIGN IN →</button>
            </div>
          ) : following.length === 0 ? (
            <div style={{ textAlign: "center", padding: 36, color: BRAND.muted, fontSize: 13 }}>
              No teams yet — tap Browse Teams to add some.
            </div>
          ) : [...following].sort((a, b) => {
            // Teams with game alerts float to the top: this-week games first,
            // then any nearby games, then teams with none. Stable sort keeps
            // the original follow order within each group.
            const rank = f => {
              const ta = alerts.filter(x => x.team === f.team && x.league === f.league);
              if (ta.some(x => x.isWeek)) return 0;
              if (ta.length > 0) return 1;
              return 2;
            };
            return rank(a) - rank(b);
          }).map((f, fi) => {
            const meta = LEAGUES.find(l => l.id === f.league);
            const isOpen = expandedFollowTeam === `${f.team}-${f.league}`;
            const teamAlerts = alerts
              .filter(a => a.team === f.team && a.league === f.league)
              .sort((a, b) => a.dist - b.dist);
            const urgentCount = teamAlerts.filter(a => a.isWeek).length;
            return (
              <div key={`${f.team}-${f.league}`} className="rg-rise" style={{ animationDelay: `${Math.min(fi, 12) * 28}ms`, marginBottom: 8 }}>
                {/* Team header row */}
                <div className="rg-press" onClick={() => setExpandedFollowTeam(isOpen ? null : `${f.team}-${f.league}`)}
                  style={{
                    background: isOpen ? "rgba(124,194,66,0.08)" : BRAND.slateLight,
                    borderTop: isOpen ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.08)`,
                    borderRight: isOpen ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.08)`,
                    borderBottom: isOpen ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.08)`,
                    borderLeft: `4px solid ${urgentCount > 0 ? BRAND.red : BRAND.green}`,
                    borderBottomLeftRadius: isOpen ? 0 : 10, borderBottomRightRadius: isOpen ? 0 : 10,
                    borderTopLeftRadius: 10, borderTopRightRadius: 10,
                    padding: "13px 14px", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                  }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <TeamLogo team={f.team} league={f.league} size={34} />
                    <div style={{ minWidth: 0 }}>
                    <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>{meta.emoji} {meta.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream }}>{f.team}</div>
                      {urgentCount > 0 && (
                        <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, background: BRAND.red, color: "#fff", borderRadius: 4, padding: "2px 6px" }}>
                          ● {urgentCount} THIS WEEK
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>
                      {teamAlerts.length > 0
                        ? `${teamAlerts.length} game${teamAlerts.length === 1 ? "" : "s"} within ${alertRadius} mi`
                        : `No games within ${alertRadius} mi in 30 days`}
                    </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: BRAND.muted, transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "none" }}>›</div>
                </div>

                {/* Expanded nearby games */}
                {isOpen && (
                  <div className="rg-expand" style={{
                    background: BRAND.slateDark,
                    border: `1.5px solid ${BRAND.green}`, borderTop: "none",
                    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                    padding: "10px 12px 12px",
                  }}>
                    {teamAlerts.length === 0 ? (
                      <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 500, padding: "8px 0", textAlign: "center" }}>
                        No games within {alertRadius} mi in the next 30 days.
                        <br /><span style={{ fontSize: 10 }}>Adjust your radius in account settings.</span>
                      </div>
                    ) : (
                      teamAlerts.map((a, j) => {
                        const rel = relInfo(a.dateISO);
                        const tier = travelTier(a.dist);
                        return (
                          <div key={j} onClick={() => openSchedule(a.team, a.league, a.id)}
                            style={{
                              background: a.isWeek ? "rgba(232,69,69,0.08)" : "rgba(242,165,56,0.06)",
                              borderLeft: `3px solid ${a.isWeek ? BRAND.red : BRAND.amber}`,
                              borderRadius: 8, padding: "9px 11px", marginBottom: 6,
                              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                            }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 10, color: a.isWeek ? BRAND.red : BRAND.amber, fontWeight: 700 }}>
                                  {a.isWeek ? "●" : "◈"}
                                </span>
                                <span className="oswald" style={{ fontSize: 10, color: a.isWeek ? BRAND.red : BRAND.amber, fontWeight: 700, letterSpacing: 1 }}>
                                  {a.isWeek ? "THIS WEEK · " : ""}{fmtDate(a.dateISO).toUpperCase()}
                                </span>
                                {rel && !a.isWeek && (
                                  <span style={{ fontSize: 9, color: BRAND.muted, fontWeight: 600 }}>{rel.text.toUpperCase()}</span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>
                                {a.isHome ? `vs ${a.away}` : `@ ${a.home}`}
                              </div>
                              <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1, fontWeight: 500 }}>{a.city} · {a.dist} mi</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div className="oswald" style={{ background: tier.bg, color: tier.color, borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{tier.label}</div>
                              <div style={{ fontSize: 14, color: BRAND.muted, marginTop: 4 }}>›</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <button onClick={() => openSchedule(f.team, f.league)} className="oswald" style={{
                      width: "100%", marginTop: 4, padding: "9px",
                      background: "transparent", border: `1.5px solid ${BRAND.green}`,
                      color: BRAND.green, borderRadius: 8,
                      fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
                    }}>VIEW FULL SCHEDULE →</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── SCHEDULE VIEW ── */}
      {activeTeam && (
        <div className="rg-fade" style={{ padding: "14px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button onClick={() => setActiveTeam(null)} className="oswald" style={{
              background: BRAND.slateLight, border: "none",
              borderRadius: 7, padding: "6px 11px", color: BRAND.cream,
              fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            }}>← BACK</button>
            <TeamLogo team={activeTeam.team} league={activeTeam.league} size={38} />
            <div style={{ flex: 1 }}>
              <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>
                {leagueMeta.emoji} {leagueMeta.name} · {leagueMeta.season}
              </div>
              <div className="oswald" style={{ fontSize: 18, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3, lineHeight: 1.1, marginTop: 2 }}>
                {activeTeam.team.toUpperCase()}
              </div>
            </div>
            <button onClick={() => toggleFollow(activeTeam.team, activeTeam.league)} className="oswald" style={{
              background: isFollowing(activeTeam.team, activeTeam.league) ? BRAND.green : "transparent",
              border: `1.5px solid ${BRAND.green}`,
              color: isFollowing(activeTeam.team, activeTeam.league) ? BRAND.charcoal : BRAND.green,
              borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            }}>{isFollowing(activeTeam.team, activeTeam.league) ? "✓ FOLLOWING" : "+ FOLLOW"}</button>
          </div>

          <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
            <Stat value={schedule.length} label="GAMES" />
            <Stat value={reachableCount} label={`WITHIN ${maxDist}MI`} accent={BRAND.green} />
            <Stat value={(() => { const d = schedule.filter(g => g.dist != null); return d.length ? `${Math.min(...d.map(g => g.dist))}MI` : "—"; })()} label="NEAREST" accent={BRAND.amber} />
          </div>

          <div style={{
            background: BRAND.slateLight, borderRadius: 10,
            padding: "11px 13px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="oswald" style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, letterSpacing: 1 }}>REACH DISTANCE</span>
              <label style={{ fontSize: 10, color: BRAND.muted, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 500 }}>
                <input type="checkbox" checked={nearbyOnly} onChange={e => setNearbyOnly(e.target.checked)} style={{ accentColor: BRAND.green }} />
                Reachable only
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: BRAND.muted, fontWeight: 500 }}>Max</span>
              <span className="oswald" style={{ fontSize: 13, color: BRAND.green, fontWeight: 700, letterSpacing: 0.5 }}>
                {maxDist >= 2500 ? "ANYWHERE" : `≤ ${maxDist} MI`}
              </span>
            </div>
            <input type="range" min={50} max={2500} step={50} value={maxDist} onChange={e => setMaxDist(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
{scheduleLoading && (
            <div style={{
              background: BRAND.slateLight,
              border: `1.5px solid rgba(124,194,66,0.2)`,
              borderRadius: 12,
              padding: "30px 20px",
              textAlign: "center",
            }}>
              <div className="oswald" style={{
                fontSize: 12, color: BRAND.muted, letterSpacing: 2, fontWeight: 700,
              }}>LOADING SCHEDULE</div>
            </div>
          )}

          {!scheduleLoading && schedule.length === 0 && scheduleError && (
            <div style={{
              background: BRAND.slateLight,
              border: `1.5px solid rgba(245,239,226,0.1)`,
              borderRadius: 12,
              padding: "32px 20px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📡</div>
              <div className="oswald" style={{
                fontSize: 16, color: BRAND.cream, letterSpacing: 0.5,
                fontWeight: 700, marginBottom: 6,
              }}>SCHEDULE UNAVAILABLE</div>
              <div style={{
                fontSize: 13, color: BRAND.muted, fontWeight: 500, lineHeight: 1.5,
                maxWidth: 280, margin: "0 auto",
              }}>
                Couldn't load the schedule right now. Check back in a moment.
              </div>
            </div>
          )}

          {!scheduleLoading && schedule.length === 0 && !scheduleError && (
            <div style={{
              background: BRAND.slateLight,
              border: `2px dashed ${BRAND.green}`,
              borderRadius: 12,
              padding: "32px 20px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏟️</div>
              <div className="oswald" style={{
                fontSize: 18, color: BRAND.cream, letterSpacing: 0.5,
                fontWeight: 700, marginBottom: 6,
              }}>COME BACK NEXT SEASON!</div>
              <div style={{
                fontSize: 13, color: BRAND.muted, fontWeight: 500, lineHeight: 1.5,
                maxWidth: 280, margin: "0 auto",
              }}>
                {activeTeam.team} doesn't have any upcoming games posted yet.
                Check back when their next season schedule drops.
              </div>
              <div className="oswald" style={{
                marginTop: 14, fontSize: 10, color: BRAND.green,
                letterSpacing: 1.5, fontWeight: 700,
              }}>
                {leagueMeta.emoji} {leagueMeta.name} · {leagueMeta.season}
              </div>
            </div>
          )}
          {visibleSchedule.map((game, gi) => {
            const tier = travelTier(game.dist);
            const isExpanded = expanded === game.id;
            const reachable = game.dist != null && game.dist <= maxDist;
            const rel = relInfo(game.dateISO);
            return (
              <div key={game.id} style={{ marginBottom: isExpanded ? 0 : 7, opacity: reachable ? 1 : 0.4 }}>
                <div className="rg-rise rg-press" onClick={() => { setExpanded(isExpanded ? null : game.id); setTravelTab("tickets"); }} style={{
                  animationDelay: `${Math.min(gi, 12) * 28}ms`,
                  background: isExpanded ? "rgba(124,194,66,0.06)" : BRAND.slateLight,
                  borderTop: isExpanded ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                  borderRight: isExpanded ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                  borderBottom: isExpanded ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                  borderLeft: `4px solid ${game.isHome ? BRAND.green : BRAND.amber}`,
                  borderRadius: 10, padding: "11px 13px", cursor: "pointer",
                  borderBottomLeftRadius: isExpanded ? 0 : 10, borderBottomRightRadius: isExpanded ? 0 : 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="oswald" style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>
                          {fmtDate(game.dateISO).toUpperCase()} · {fmtTime(game.dateISO)}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1,
                          background: game.isHome ? BRAND.green : "rgba(242,165,56,0.2)",
                          color: game.isHome ? BRAND.charcoal : BRAND.amber,
                          padding: "1px 6px", borderRadius: 3,
                        }}>{game.isHome ? "HOME" : "AWAY"}</span>
                        {rel && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                            color: rel.soon ? BRAND.amber : BRAND.muted,
                          }}>{rel.text.toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream }}>
                        {game.isHome ? `vs ${game.away}` : `@ ${game.home}`}
                      </div>
                      <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>{game.venue} · {game.city}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div className="oswald" style={{ background: tier.bg, color: tier.color, borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{tier.label}</div>
                      <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>{game.dist != null ? `${game.dist} mi` : "—"}</div>
                      {game.ticketsFrom != null && <div className="oswald" style={{ fontSize: 14, fontWeight: 700, color: BRAND.green, letterSpacing: 0.3 }}>${game.ticketsFrom}+</div>}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="rg-expand">
                    <ExpandedPanel game={game} activeTeam={activeTeam} travelTab={travelTab} setTravelTab={setTravelTab} userCity={userCity} showToast={showToast} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
function InstallStep({ n, text }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", background: BRAND.green, color: BRAND.charcoal,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: "'Oswald', sans-serif",
      }}>{n}</div>
      <div style={{ fontSize: 12, color: BRAND.muted, lineHeight: 1.5, paddingTop: 2, fontFamily: "'Inter', sans-serif" }}>{text}</div>
    </div>
  );
}

// SectionHeader moved to ./components/ExpandedPanel

function SectionCard({ title, icon, children }) {
  return (
    <div style={{
      background: BRAND.slateLight, borderRadius: 11,
      padding: "14px 15px", marginBottom: 12,
    }}>
      <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
        {icon && `${icon} `}{title}
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label, accent = BRAND.cream }) {
  return (
    <div style={{ flex: 1, background: BRAND.slateDark, borderRadius: 8, padding: "9px 10px" }}>
      <div className="oswald" style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
      <div className="oswald" style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// Real vendor logo loaded from a favicon/logo service in the user's browser.
// Falls back through services, then to the original brand-color letter tile if
// none resolve — so it degrades gracefully and never shows a broken image.
// VendorLogo moved to ./components/VendorLogo

function AlertCard({ alert: a, onTap, urgent }) {
  const tier = travelTier(a.dist);
  const rel = relInfo(a.dateISO);
  return (
    <div onClick={onTap} style={{
      background: urgent ? "rgba(232,69,69,0.08)" : BRAND.slateLight,
      borderTop: urgent ? `1.5px solid ${BRAND.red}` : `1px solid rgba(245,239,226,0.06)`,
      borderRight: urgent ? `1.5px solid ${BRAND.red}` : `1px solid rgba(245,239,226,0.06)`,
      borderBottom: urgent ? `1.5px solid ${BRAND.red}` : `1px solid rgba(245,239,226,0.06)`,
      borderLeft: `4px solid ${urgent ? BRAND.red : BRAND.green}`,
      borderRadius: 10, padding: "11px 13px", marginBottom: 7,
      cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="oswald" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: urgent ? BRAND.red : BRAND.green, fontWeight: 700, letterSpacing: 1.2 }}>
            {urgent ? "● URGENT · " : ""}{fmtDate(a.dateISO).toUpperCase()} · {fmtTime(a.dateISO)}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1,
            background: a.isHome ? BRAND.green : "rgba(242,165,56,0.2)",
            color: a.isHome ? BRAND.charcoal : BRAND.amber,
            padding: "1px 6px", borderRadius: 3,
          }}>{a.isHome ? "HOME" : "AWAY"}</span>
          {rel && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: BRAND.muted }}>{rel.text.toUpperCase()}</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>
          {a.team} {a.isHome ? `vs ${a.away}` : `@ ${a.home}`}
        </div>
        <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>{a.city} · {a.dist} mi</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="oswald" style={{ background: tier.bg, color: tier.color, borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{tier.label}</div>
        <div style={{ fontSize: 14, color: BRAND.muted, marginTop: 4 }}>›</div>
      </div>
    </div>
  );
}

// ExpandedPanel + its city-guide/travel helpers moved to ./components/ExpandedPanel
