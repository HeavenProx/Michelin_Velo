import { useState, useEffect } from "react";
import {
  Bike, MapPin, Star, AlertTriangle, CheckCircle, TrendingUp,
  Award, Activity, ArrowRight,
  Droplets, ChevronRight, Shield, Zap, Target,
  Loader2, User, Package, Bell, Mountain, Sun, LogOut, Calendar, ExternalLink, Filter, type LucideIcon,
} from "lucide-react";

type Screen = "landing" | "dashboard" | "garage" | "alerte" | "avis";

// ── API TYPES ──────────────────────────────────────────────────────────────

interface Athlete {
  id: number;
  firstname: string;
  lastname: string;
  city?: string;
  country?: string;
  profile?: string | null;
}

interface LiveProfile {
  ride_count: number;
  total_distance_km: number;
  monthly_distance: number;
  avg_speed_kmh: number;
  avg_elevation_m: number;
  terrain_label: string;
  style_label: string;
  weather_exposure: { rain_percentage: number; rainy_rides?: number };
  region: string;
}

interface LiveReco {
  explanation: string;
  recommended: {
    name: string;
    match_score: number;
    description: string;
    lifetime_km: number;
    price_range: string;
    scores: {
      wet_grip: number;
      rolling_resistance: number;
      durability: number;
      terrain_versatility: number;
    };
  };
  alternatives: Array<{ name: string; match_score: number; description?: string }>;
}

interface LiveData {
  athlete: Athlete;
  profile: LiveProfile;
  reco: LiveReco;
  isDemo?: boolean;
}

// ── DEMO DATA ──────────────────────────────────────────────────────────────

const RIDER = {
  name: "Alex Dubois",
  location: "Lyon, Isère",
  monthlyKm: 312,
  monthlyElevation: 8400,
  totalKm: 8420,
  rides: 127,
  avgSpeed: 28.4,
  style: "Endurant",
  terrain: [
    { name: "Montagne", value: 52, color: "#27509B" },
    { name: "Plat", value: 28, color: "#6182BB" },
    { name: "Mixte", value: 20, color: "#C1D6EF" },
  ],
  weather: { dry: 62, wet: 31, cold: 7 },
  region: "Auvergne-Rhône-Alpes",
};


const RECO = {
  model: "Power All Season TLR",
  shortDescription: "Grip exceptionnel par temps humide, technologie Protek 360°. Votre allié 4 saisons en montagne.",
  features: ["Protek 360° anti-crevaison", "Compound X-Ice (humide)", "Sans chambre TLR"],
};

const STORES = [
  { name: "Le Cyclo — Grenoble", address: "15 Rue Sébastien Faure, Grenoble", distance: "3 km", type: "physical" as const, pin: { x: 24, y: 61 }, label: "Le Cyclo" },
  { name: "Probikeshop Grenoble", address: "40 Av. du Vercors, Grenoble", distance: "5 km", type: "physical" as const, pin: { x: 43, y: 71 }, label: "Probikeshop" },
  { name: "Decathlon Pont-de-Claix", address: "ZAC Champbertier, Pont-de-Claix", distance: "8 km", type: "physical" as const, pin: { x: 66, y: 42 }, label: "Decathlon" },
  { name: "Alltricks.fr", address: "Livraison 24-48h", distance: "En ligne", type: "online" as const },
  { name: "Amazon.fr", address: "Prime disponible", distance: "En ligne", type: "online" as const },
];

const TIRE_MODELS = [
  { name: "Power All Season TLR", category: "Route", km_max: 3500 },
  { name: "Power Road",            category: "Route", km_max: 4500 },
  { name: "Power Endurance",       category: "Route", km_max: 7000 },
  { name: "Power Competition TLR", category: "Route Compétition", km_max: 2800 },
  { name: "Power Gravel",          category: "Gravel", km_max: 3000 },
  { name: "Wild Enduro",           category: "VTT",   km_max: 2500 },
];

const REVIEWS = [
  { id: 1, name: "Élodie M.",      location: "Annecy, Haute-Savoie",   tire: "Power All Season TLR", km: 2840, totalKm:  8420, rating: 5, text: "Grip incroyable même sous la pluie en descente du Galibier. Je ne m'attendais pas à autant de confiance sur le mouillé.", date: "12 avril 2026",    criteria: { grip: 5, durabilite: 4, confort: 5, anticrv: 5 } },
  { id: 2, name: "Marc-Antoine D.", location: "Lyon, Rhône",            tire: "Power All Season TLR", km: 4100, totalKm: 12300, rating: 4, text: "4 000 km et la bande de roulement est encore très correcte. Un peu cher mais ça vaut le coup sur la durée.",              date: "28 mars 2026",    criteria: { grip: 4, durabilite: 5, confort: 4, anticrv: 4 } },
  { id: 3, name: "Lucie B.",       location: "Chambéry, Savoie",        tire: "Power All Season TLR", km: 1920, totalKm:  5760, rating: 5, text: "Je roulais avec une autre marque avant. La différence se sent immédiatement dans les virages mouillés.",                  date: "2 mai 2026",      criteria: { grip: 5, durabilite: 4, confort: 5, anticrv: 5 } },
  { id: 4, name: "Thomas G.",      location: "Lyon, Rhône",             tire: "Power All Season TLR", km: 3800, totalKm:  9500, rating: 5, text: "Mon pneu de référence depuis 2 saisons. Polyvalence remarquable, rien à redire.",                                          date: "5 mai 2026",      criteria: { grip: 5, durabilite: 5, confort: 5, anticrv: 5 } },
  { id: 5, name: "Kevin T.",       location: "Nice, Alpes-Maritimes",   tire: "Power Road",           km: 3200, totalKm:  7680, rating: 5, text: "La résistance au roulement est vraiment faible, on gagne facilement 1–2 km/h sur le plat. Excellent en conditions sèches.", date: "18 avril 2026",   criteria: { grip: 5, durabilite: 4, confort: 4, anticrv: 4 } },
  { id: 6, name: "Sébastien R.",   location: "Bordeaux, Gironde",       tire: "Power Road",           km: 2600, totalKm:  6200, rating: 4, text: "Pneu très performant en conditions sèches. Un peu moins à l'aise sous la pluie mais reste très utilisable.",                date: "14 février 2026", criteria: { grip: 4, durabilite: 4, confort: 4, anticrv: 3 } },
  { id: 7, name: "Aurélie F.",     location: "Grenoble, Isère",         tire: "Pro4 Endurance",       km: 5200, totalKm: 11800, rating: 5, text: "Impressionnant en termes de durabilité. Encore utilisable après 5 000 km, c'est incroyable.",                               date: "3 mars 2026",     criteria: { grip: 4, durabilite: 5, confort: 5, anticrv: 5 } },
];

const PEERS = [
  { name: "Élodie M.",      location: "Annecy, Haute-Savoie", km: 2840, totalKm:  8420, rating: 5, review: "Grip incroyable même sous la pluie en descente du Galibier. Je ne m'attendais pas à autant de confiance sur le mouillé.", similarity: 94, tire: "Power All Season TLR", rides: 52, terrain: "Montagne 58%", date: "12 avril 2026" },
  { name: "Marc-Antoine D.", location: "Lyon, Rhône",          km: 4100, totalKm: 12300, rating: 4, review: "4 000 km et la bande de roulement est encore très correcte. Un peu cher mais ça vaut le coup sur la durée.",              similarity: 89, tire: "Power All Season TLR", rides: 44, terrain: "Montagne 49%", date: "28 mars 2026" },
  { name: "Lucie B.",        location: "Chambéry, Savoie",     km: 1920, totalKm:  5760, rating: 5, review: "Je roulais avec une autre marque avant. La différence se sent immédiatement dans les virages mouillés.",                  similarity: 82, tire: "Power All Season TLR", rides: 61, terrain: "Montagne 45%", date: "2 mai 2026" },
];

// ── SHARED COMPONENTS ──────────────────────────────────────────────────────




function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={
            i <= Math.round(rating)
              ? "fill-[#FCE500] text-[#FCE500]"
              : "fill-gray-200 text-gray-200"
          }
        />
      ))}
    </div>
  );
}

// ── LANDING ────────────────────────────────────────────────────────────────

function LandingScreen({
  onConnectStrava,
  onLoadDemo,
}: {
  onConnectStrava: () => void;
  onLoadDemo: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#00205B] flex flex-col items-center justify-center font-sans overflow-hidden relative px-6 py-10 sm:py-12">
      {/* Cercles décoratifs — réduits sur mobile pour éviter tout croisement */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Groupe gauche — 38% hauteur */}
        <div className="absolute rounded-full w-[220px] h-[220px] md:w-[600px] md:h-[600px] -left-[110px] md:-left-[300px] blur-md"
             style={{ top: '38%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute rounded-full w-[320px] h-[320px] md:w-[820px] md:h-[820px] -left-[160px] md:-left-[410px] blur-md"
             style={{ top: '38%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
        {/* Groupe droit — 62% hauteur */}
        <div className="absolute rounded-full w-[220px] h-[220px] md:w-[600px] md:h-[600px] -right-[110px] md:-right-[300px] blur-md"
             style={{ top: '62%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute rounded-full w-[320px] h-[320px] md:w-[820px] md:h-[820px] -right-[160px] md:-right-[410px] blur-md"
             style={{ top: '62%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Logo Michelin + titre appli */}
      <div className="relative z-10 mb-7 sm:mb-8 flex flex-col items-center gap-2.5 sm:gap-3">
        <img
          src="/michelin-logo-white.png"
          alt="Michelin"
          className="w-48 sm:w-56"
        />
        <span className="text-white/55 text-[10px] sm:text-[11px] tracking-[0.28em] uppercase font-semibold">
          Road Intelligence
        </span>
      </div>

      {/* Hero text */}
      <div className="relative z-10 text-center mb-7 sm:mb-8">
        <h1 className="text-white font-extrabold text-[2.05rem] sm:text-[2.20rem] leading-[1.18] mb-4 sm:mb-5">
          Vos pneus.<br />
          Vos données.<br />
          Votre performance.
        </h1>
        <p className="text-white/65 text-[14px] sm:text-[15px] leading-relaxed mx-auto max-w-[22rem]">
          Connectez votre compte Strava pour obtenir une recommandation personnalisée et suivre l&apos;usure de vos pneus Michelin.
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-10 w-full max-w-sm mb-5 sm:mb-5">
        <button
          onClick={onConnectStrava}
          className="w-full bg-[#FC4C02] hover:bg-[#e04302] active:scale-[0.98] text-white font-bold py-[14px] sm:py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-[15px] transition-all shadow-[0_8px_28px_rgba(252,76,2,0.55)]"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white flex-shrink-0" aria-hidden="true">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Se connecter avec Strava
        </button>
      </div>

      {/* Legal */}
      <p className="relative z-10 text-white/35 text-[11px] text-center px-6 leading-relaxed">
        Données Strava utilisées uniquement pour personnaliser votre expérience. Application non commerciale.
      </p>

      {/* Accès démo discret pour le jury */}
      <button
        onClick={onLoadDemo}
        className="relative z-10 text-white/20 hover:text-white/40 text-[11px] mt-3 sm:mt-6 transition-colors"
      >
        Mode démo
      </button>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────

function DashboardScreen({ liveData }: { liveData?: LiveData }) {
  const [showStores, setShowStores] = useState(false);

  const name = liveData
    ? `${liveData.athlete.firstname} ${liveData.athlete.lastname}`
    : RIDER.name;
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const location = liveData?.athlete.city ? `${liveData.athlete.city}, France` : RIDER.location;
  const monthlyKm = liveData?.profile.monthly_distance ?? RIDER.monthlyKm;
  const totalRides = liveData?.profile.ride_count ?? RIDER.rides;
  const recoModel = liveData?.reco.recommended.name ?? RECO.model;
  const recoDesc = liveData?.reco.explanation ?? RECO.shortDescription;

  const profileTags = [
    { Icon: Mountain, label: liveData?.profile.terrain_label ?? "Montagne" },
    { Icon: Zap, label: liveData?.profile.style_label ?? RIDER.style },
    { Icon: Droplets, label: `${liveData?.profile.weather_exposure.rain_percentage ?? RIDER.weather.wet}% humide` },
    { Icon: Sun, label: `${RIDER.weather.dry}% sèche` },
  ];

  return (
    <div className="min-h-full">
      {/* Hero dark */}
      <div className="bg-[#00205B] px-4 pt-5 pb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#FCE500] flex items-center justify-center font-bold text-[#00205B] text-lg flex-shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{name}</h2>
              <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
                <MapPin size={10} />{location}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#FC4C02]" aria-hidden="true">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            <span className="text-[#FC4C02] font-semibold text-sm">Strava</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
             { Icon: Calendar, value: String(totalRides), unit: "sorties au total" },
            { Icon: Bike, value: String(monthlyKm), unit: "km ce mois" },
            { Icon: TrendingUp, value: `${(RIDER.monthlyElevation / 1000).toFixed(1)}km`, unit: "Dénivelé positif ce mois" },
          ].map(({ Icon, value, unit }) => (
            <div key={unit} className="bg-white/10 rounded-2xl p-3">
              <Icon size={14} className="text-white/50 mb-2" />
              <div className="text-white font-bold text-2xl leading-none font-mono">{value}</div>
              <div className="text-white/50 text-[11px] mt-1">{unit}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Profil tags */}
        <div>
          <p className="text-gray-400 text-[10px] font-bold tracking-[0.18em] uppercase mb-3">Votre profil</p>
          <div className="flex flex-wrap gap-2">
            {profileTags.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 border border-gray-200 rounded-full px-3 py-1.5 bg-white">
                <Icon size={12} className="text-[#27509B]" />
                <span className="text-[#27509B] text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Carte recommandation */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
          <div className="bg-[#00205B] px-4 py-3 flex items-center gap-2">
            <Award size={14} className="text-[#FCE500]" />
            <span className="text-white text-[11px] font-bold tracking-[0.14em] uppercase">
              Recommandé pour votre profil
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 bg-[#27509B] rounded-xl flex items-center justify-center flex-shrink-0">
                <Target size={26} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#FC4C02] uppercase tracking-wider">Gamme Premium</p>
                <h3 className="font-bold text-lg leading-tight text-gray-900">{recoModel}</h3>
                <p className="text-[#27509B] text-sm leading-snug mt-0.5">{recoDesc}</p>
              </div>
            </div>
            <div className="space-y-2.5 mb-5">
              {RECO.features.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#27509B] flex-shrink-0" />
                  <span className="text-sm text-gray-700">{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowStores(v => !v)}
              className="w-full bg-[#FCE500] hover:bg-[#FDED44] text-black font-bold py-3.5 rounded-full text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {showStores ? "Masquer les points de vente" : "Trouver ce pneu près de chez moi"}
              <ArrowRight size={15} className={`transition-transform ${showStores ? "rotate-90" : ""}`} />
            </button>
          </div>
        </div>

        {/* Section magasins (toggle) */}
        {showStores && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Carte SVG */}
            <svg viewBox="0 0 100 55" className="w-full block" aria-hidden="true">
              <rect width="100" height="55" fill="#DAEAF5" />
              {[10,20,30,40,50,60,70,80,90].map(x => (
                <line key={`v${x}`} x1={x} y1={0} x2={x} y2={55} stroke="#C2D9EE" strokeWidth="0.35" />
              ))}
              {[10,20,30,40,50].map(y => (
                <line key={`h${y}`} x1={0} y1={y} x2={100} y2={y} stroke="#C2D9EE" strokeWidth="0.35" />
              ))}
              <text x="96" y="53" fontSize="3" fill="#9BB5CA" fontFamily="sans-serif" textAnchor="end">Grenoble, Isère</text>
              <defs>
                <filter id="pshadow" x="-20%" y="-30%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="0.4" stdDeviation="0.6" floodColor="#00205B" floodOpacity="0.18" />
                </filter>
              </defs>
              {STORES.filter(s => s.type === "physical").map((s, i) => (
                <g key={i}>
                  <circle cx={s.pin!.x} cy={s.pin!.y + 0.6} r="3.2" fill="#00205B" fillOpacity="0.12" />
                  <circle cx={s.pin!.x} cy={s.pin!.y} r="3" fill="#27509B" />
                  <circle cx={s.pin!.x} cy={s.pin!.y} r="1.2" fill="white" />
                  <rect x={s.pin!.x + 4.5} y={s.pin!.y - 3.5} width={s.label!.length * 1.85 + 3} height={7} rx="1.8" fill="white" filter="url(#pshadow)" />
                  <text x={s.pin!.x + 6} y={s.pin!.y + 0.8} fontSize="3.2" fill="#1a2744" fontFamily="sans-serif" fontWeight="700">{s.label}</text>
                </g>
              ))}
            </svg>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-3">Où racheter ce pneu</p>
            </div>
            <div className="divide-y divide-gray-100">
              {STORES.map((s) => (
                <a key={s.name} href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.type === "physical" ? "bg-[#27509B]/10" : "bg-[#00205B]/8"}`}>
                    {s.type === "physical" ? <MapPin size={15} className="text-[#27509B]" /> : <ExternalLink size={15} className="text-[#00205B]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.address}</p>
                  </div>
                  <span className={`font-bold text-sm flex-shrink-0 ${s.type === "physical" ? "text-[#27509B]" : "text-gray-500"}`}>
                    {s.distance}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Cyclistes similaires */}
        <div>
          <p className="text-gray-400 text-[10px] font-bold tracking-[0.18em] uppercase mb-3">Cyclistes au profil similaire</p>
          <div className="space-y-3">
            {PEERS.map((p, i) => {
              const initials = p.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-gray-900 text-base leading-tight">{p.name}</p>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <StarRating rating={p.rating} />
                          <p className="text-[10px] text-gray-400 mt-0.5">{p.date}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />{p.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 bg-[#00205B] text-white text-xs font-semibold px-3 py-1 rounded-full">
                      <TrendingUp size={10} />
                      Avis après {p.km.toLocaleString("fr-FR")} km 
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1 rounded-full">
                      <Bike size={10} />
                      {p.totalKm.toLocaleString("fr-FR")} km au total
                    </span>
                  </div>
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#27509B] mb-2">{p.tire}</p>
                  <p className="text-sm text-gray-700 italic leading-relaxed">
                    &ldquo;{p.review}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GARAGE ─────────────────────────────────────────────────────────────────

function GaugeWear({ percent }: { percent: number }) {
  const r = 70; const cx = 100; const cy = 92;
  const circumference = Math.PI * r;
  const filled = (Math.min(100, percent) / 100) * circumference;
  const color = percent >= 80 ? "#B71C1C" : percent >= 55 ? "#E65100" : "#2E7D32";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 100" className="w-56">
        <defs>
          <linearGradient id="wearGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#4CAF50" />
            <stop offset="50%"  stopColor="#FFC107" />
            <stop offset="100%" stopColor="#D32F2F" />
          </linearGradient>
        </defs>
        {/* Piste de fond */}
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#E0E0E0" strokeWidth="14" strokeLinecap="round" />
        {/* Arc rempli avec gradient */}
        {percent > 0 && (
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="url(#wearGrad)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`} />
        )}
        {/* Valeur */}
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize="34" fontWeight="800" fill={color} fontFamily="sans-serif">{Math.round(percent)}%</text>
        <text x={cx} y={cy - 1}  textAnchor="middle" fontSize="9"  fill="#999" fontFamily="sans-serif" letterSpacing="3">USURE</text>
      </svg>
    </div>
  );
}

function GarageScreen({ onNavigate: _onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [selectedIdx, setSelectedIdx]       = useState(0);
  const [dateInput, setDateInput]           = useState("2025-08-15");
  const [open, setOpen]                     = useState(false);
  const [query, setQuery]                   = useState("");
  const [showStores, setShowStores]         = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const model      = TIRE_MODELS[selectedIdx];
  const kmUsed     = 3177;
  const kmMax      = model.km_max;
  const kmLeft     = Math.max(0, kmMax - kmUsed);
  const wear       = Math.min(100, Math.round((kmUsed / kmMax) * 100));
  const critical   = wear >= 80;
  const cardBg     = critical ? "bg-red-50" : wear >= 55 ? "bg-amber-50" : "bg-green-50";
  const statusText = critical ? "À remplacer" : wear >= 55 ? "À surveiller" : "Bon état";
  const statusColor= critical ? "text-red-600" : wear >= 55 ? "text-amber-600" : "text-green-700";

  const filtered = TIRE_MODELS.filter(m =>
    (m.name + m.category).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon pneu</h1>
        <p className="text-sm text-gray-400 mt-0.5">Suivez l'usure en temps réel</p>
      </div>

      {/* Sélecteur modèle */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-2">Modèle</p>
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className={`w-full bg-white border rounded-2xl px-4 py-3.5 flex items-center justify-between text-left transition-colors ${open ? "border-[#27509B]" : "border-gray-200"}`}
          >
            <div>
              <p className="font-bold text-gray-900 text-sm">{model.name}</p>
              <p className="text-xs text-gray-400">{model.category}</p>
            </div>
            <ChevronRight size={18} className={`text-gray-400 transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-2xl mt-1 shadow-xl overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                    placeholder="Rechercher un modèle..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                {filtered.map((m) => {
                  const idx = TIRE_MODELS.indexOf(m);
                  return (
                    <button
                      key={m.name}
                      onClick={() => { setSelectedIdx(idx); setOpen(false); setQuery(""); }}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.category}</p>
                      </div>
                      {idx === selectedIdx && <CheckCircle size={18} className="text-[#27509B] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date de pose */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-2">Date de pose</p>
        <input
          type="date"
          value={dateInput}
          onChange={e => setDateInput(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-900 text-sm outline-none focus:border-[#27509B] transition-colors"
        />
      </div>

      {/* Tyre Score */}
      <div className={`${cardBg} rounded-2xl p-5`}>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 text-center mb-3">Tyre Score</p>
        <GaugeWear percent={wear} />
        <p className={`text-center font-bold text-sm mt-1 ${statusColor}`}>{statusText}</p>
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-black/8 text-center">
          {[
            { val: kmUsed.toLocaleString("fr-FR"), label: "km utilisés" },
            { val: kmLeft.toLocaleString("fr-FR"), label: "km restants", accent: critical },
            { val: kmMax.toLocaleString("fr-FR"), label: "km max*" },
          ].map(({ val, label, accent }) => (
            <div key={label}>
              <p className={`font-bold font-mono text-xl ${accent ? "text-red-600" : "text-gray-900"}`}>{val}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2">* Ajusté selon votre terrain de prédilection</p>
      </div>

      {/* Alerte */}
      {critical && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800 text-sm mb-1">Remplacement recommandé</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Votre pneu est à {wear}% d'usure. Pensez à le remplacer pour maintenir vos performances et votre sécurité.
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => setShowStores(v => !v)}
        className="w-full bg-[#FCE500] hover:bg-[#FDED44] text-black font-bold py-4 rounded-full text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {showStores ? "Masquer les points de vente" : "Trouver un remplacement"}
        <ArrowRight size={16} className={`transition-transform ${showStores ? "rotate-90" : ""}`} />
      </button>

      {/* Section magasins */}
      {showStores && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <svg viewBox="0 0 100 55" className="w-full block" aria-hidden="true">
            <rect width="100" height="55" fill="#DAEAF5" />
            {[10,20,30,40,50,60,70,80,90].map(x => (
              <line key={`v${x}`} x1={x} y1={0} x2={x} y2={55} stroke="#C2D9EE" strokeWidth="0.35" />
            ))}
            {[10,20,30,40,50].map(y => (
              <line key={`h${y}`} x1={0} y1={y} x2={100} y2={y} stroke="#C2D9EE" strokeWidth="0.35" />
            ))}
            <text x="96" y="53" fontSize="3" fill="#9BB5CA" fontFamily="sans-serif" textAnchor="end">Grenoble, Isère</text>
            <defs>
              <filter id="gshadow" x="-20%" y="-30%" width="140%" height="160%">
                <feDropShadow dx="0" dy="0.4" stdDeviation="0.6" floodColor="#00205B" floodOpacity="0.18" />
              </filter>
            </defs>
            {STORES.filter(s => s.type === "physical").map((s, i) => (
              <g key={i}>
                <circle cx={s.pin!.x} cy={s.pin!.y + 0.6} r="3.2" fill="#00205B" fillOpacity="0.12" />
                <circle cx={s.pin!.x} cy={s.pin!.y} r="3" fill="#27509B" />
                <circle cx={s.pin!.x} cy={s.pin!.y} r="1.2" fill="white" />
                <rect x={s.pin!.x + 4.5} y={s.pin!.y - 3.5} width={s.label!.length * 1.85 + 3} height={7} rx="1.8" fill="white" filter="url(#gshadow)" />
                <text x={s.pin!.x + 6} y={s.pin!.y + 0.8} fontSize="3.2" fill="#1a2744" fontFamily="sans-serif" fontWeight="700">{s.label}</text>
              </g>
            ))}
          </svg>
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-3">Où racheter ce pneu</p>
          </div>
          <div className="divide-y divide-gray-100">
            {STORES.map((s) => (
              <a key={s.name} href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.type === "physical" ? "bg-[#27509B]/10" : "bg-[#00205B]/8"}`}>
                  {s.type === "physical" ? <MapPin size={15} className="text-[#27509B]" /> : <ExternalLink size={15} className="text-[#00205B]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.address}</p>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 ${s.type === "physical" ? "text-[#27509B]" : "text-gray-500"}`}>
                  {s.distance}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Partage */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Star size={15} className="text-[#27509B]" />
          <p className="font-bold text-sm text-[#00205B]">Partagez votre expérience</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">
          {kmUsed.toLocaleString("fr-FR")} km parcourus avec ce pneu — votre avis aide la communauté.
        </p>
        <button onClick={() => setShowReviewModal(true)} className="text-[#27509B] font-semibold text-sm flex items-center gap-1">
          Laisser un avis <ChevronRight size={14} />
        </button>
      </div>

      <ReviewModal open={showReviewModal} onClose={() => setShowReviewModal(false)} tireName={model.name} />
    </div>
  );
}

// ── ALERTE ─────────────────────────────────────────────────────────────────

const ALERTS = [
  { tire: "Power All Season TLR", wear: 89, date: "15 juin 2026" },
  { tire: "Pro4 Endurance",       wear: 85, date: "10 mars 2026" },
  { tire: "Lithion 3",            wear: 92, date: "22 octobre 2025" },
];

const REVIEW_REMINDERS = [
  { tire: "Power All Season TLR", threshold: 2000, date: "10 juin 2026",    done: false },
  { tire: "Power All Season TLR", threshold: 1000, date: "3 février 2026",  done: true  },
  { tire: "Power All Season TLR", threshold: 500,  date: "12 novembre 2025", done: true  },
];

function AlerteScreen({ liveData: _liveData }: { liveData?: LiveData }) {
  const [expandedIdx, setExpandedIdx]       = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTire, setReviewTire]          = useState("");

  function openReview(tire: string) {
    setReviewTire(tire);
    setShowReviewModal(true);
  }

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alertes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Usure &amp; rappels avis</p>
      </div>

      {/* ── Section usure ── */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-400 mb-3">Alertes d'usure</p>
        <div className="space-y-3">
        {ALERTS.map((alert, i) => {
          const expanded = expandedIdx === i;
          return (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* En-tête cliquable */}
              <button
                onClick={() => setExpandedIdx(expanded ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{alert.tire}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Usure <span className="text-red-500 font-semibold">{alert.wear}%</span>
                    {" · "}{alert.date}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </button>

              {/* Section map + magasins (dépliable) */}
              {expanded && (
                <div className="border-t border-gray-100">
                  <svg viewBox="0 0 100 55" className="w-full block" aria-hidden="true">
                    <rect width="100" height="55" fill="#DAEAF5" />
                    {[10,20,30,40,50,60,70,80,90].map(x => (
                      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={55} stroke="#C2D9EE" strokeWidth="0.35" />
                    ))}
                    {[10,20,30,40,50].map(y => (
                      <line key={`h${y}`} x1={0} y1={y} x2={100} y2={y} stroke="#C2D9EE" strokeWidth="0.35" />
                    ))}
                    <text x="96" y="53" fontSize="3" fill="#9BB5CA" fontFamily="sans-serif" textAnchor="end">Grenoble, Isère</text>
                    <defs>
                      <filter id={`ashadow${i}`} x="-20%" y="-30%" width="140%" height="160%">
                        <feDropShadow dx="0" dy="0.4" stdDeviation="0.6" floodColor="#00205B" floodOpacity="0.18" />
                      </filter>
                    </defs>
                    {STORES.filter(s => s.type === "physical").map((s, j) => (
                      <g key={j}>
                        <circle cx={s.pin!.x} cy={s.pin!.y + 0.6} r="3.2" fill="#00205B" fillOpacity="0.12" />
                        <circle cx={s.pin!.x} cy={s.pin!.y} r="3" fill="#27509B" />
                        <circle cx={s.pin!.x} cy={s.pin!.y} r="1.2" fill="white" />
                        <rect x={s.pin!.x + 4.5} y={s.pin!.y - 3.5} width={s.label!.length * 1.85 + 3} height={7} rx="1.8" fill="white" filter={`url(#ashadow${i})`} />
                        <text x={s.pin!.x + 6} y={s.pin!.y + 0.8} fontSize="3.2" fill="#1a2744" fontFamily="sans-serif" fontWeight="700">{s.label}</text>
                      </g>
                    ))}
                  </svg>
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400 mb-3">Où racheter ce pneu</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {STORES.map((s) => (
                      <a key={s.name} href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.type === "physical" ? "bg-[#27509B]/10" : "bg-[#00205B]/8"}`}>
                          {s.type === "physical" ? <MapPin size={15} className="text-[#27509B]" /> : <ExternalLink size={15} className="text-[#00205B]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-400 truncate">{s.address}</p>
                        </div>
                        <span className={`font-bold text-sm flex-shrink-0 ${s.type === "physical" ? "text-[#27509B]" : "text-gray-500"}`}>
                          {s.distance}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>{/* /space-y-3 */}
      </div>{/* /Section usure */}

      {/* ── Section rappels avis ── */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-gray-400 mb-3">Rappels avis</p>
        <div className="space-y-3">
          {REVIEW_REMINDERS.map((r, i) => (
            <div key={i} className={`rounded-2xl p-4 flex items-start gap-3 border ${r.done ? "bg-white border-gray-200" : "bg-[#FCE500]/10 border-[#FCE500]/60"}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.done ? "bg-green-50" : "bg-amber-50"}`}>
                {r.done
                  ? <CheckCircle size={16} className="text-green-500" />
                  : <Star size={16} className="text-amber-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${r.done ? "text-gray-700" : "text-gray-900"}`}>
                  {r.threshold.toLocaleString("fr-FR")} km atteints
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{r.tire} · {r.date}</p>
                {r.done ? (
                  <p className="text-xs text-green-600 font-semibold mt-2">Avis déposé ✓</p>
                ) : (
                  <button
                    onClick={() => openReview(r.tire)}
                    className="mt-2 text-[#27509B] font-semibold text-xs flex items-center gap-1 hover:underline"
                  >
                    Laisser un avis <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ReviewModal open={showReviewModal} onClose={() => setShowReviewModal(false)} tireName={reviewTire} />
    </div>
  );
}

// ── AVIS ───────────────────────────────────────────────────────────────────

function CritBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#27509B] rounded-full" style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-3 text-right">{score}</span>
    </div>
  );
}

function ReviewModal({ open, onClose, tireName }: { open: boolean; onClose: () => void; tireName: string }) {
  const [rating, setRating]       = useState(0);
  const [hover, setHover]         = useState(0);
  const [criteria, setCriteria]   = useState({ grip: 0, durabilite: 0, confort: 0, anticrv: 0 });
  const [comment, setComment]     = useState("");
  const [done, setDone]           = useState(false);

  if (!open) return null;

  function submit() {
    if (!rating) return;
    setDone(true);
    setTimeout(() => {
      onClose();
      setDone(false);
      setRating(0);
      setCriteria({ grip: 0, durabilite: 0, confort: 0, anticrv: 0 });
      setComment("");
    }, 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-6 mb-16 max-h-[calc(85vh-4rem)] overflow-y-scroll">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        {done ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle size={48} className="text-green-500" />
            <p className="font-bold text-lg text-gray-900">Merci pour votre avis !</p>
            <p className="text-sm text-gray-400 text-center">Votre retour aide la communauté Michelin.</p>
          </div>
        ) : (
          <>
            <h2 className="font-bold text-xl text-gray-900 mb-0.5">Votre avis</h2>
            <p className="text-sm text-gray-400 mb-5">{tireName}</p>
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Note globale</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} className="p-1">
                    <Star size={32} className={i <= (hover || rating) ? "fill-[#FCE500] text-[#FCE500]" : "fill-gray-200 text-gray-200"} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Critères détaillés</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {([
                  { key: "grip",       label: "Grip" },
                  { key: "durabilite", label: "Durabilité" },
                  { key: "confort",    label: "Confort" },
                  { key: "anticrv",   label: "Anti-crevaison" },
                ] as { key: keyof typeof criteria; label: string }[]).map(({ key, label }) => (
                  <div key={key}>
                    <p className="text-sm text-gray-700 mb-1.5">{label}</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <button key={i} onClick={() => setCriteria(c => ({ ...c, [key]: i }))} className="p-0.5">
                          <Star size={22} className={i <= criteria[key] ? "fill-[#27509B] text-[#27509B]" : "fill-gray-200 text-gray-200"} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Commentaire</p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Partagez votre expérience avec ce pneu..."
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 resize-none outline-none focus:border-[#27509B] transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={submit} disabled={rating === 0} className="flex-1 bg-[#00205B] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#27509B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Publier
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AvisScreen() {
  const MY_TIRE = RECO.model;
  const [filter, setFilter]         = useState(MY_TIRE);
  const [showFilter, setShowFilter] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [showModal, setShowModal]   = useState(false);

  const tireStats = Array.from(new Set(REVIEWS.map(r => r.tire))).map(tire => {
    const subset = REVIEWS.filter(r => r.tire === tire);
    const avg = subset.reduce((s, r) => s + r.rating, 0) / subset.length;
    return { tire, count: subset.length, avg: Math.round(avg * 10) / 10 };
  });

  const filtered = filter === "Tous" ? REVIEWS : REVIEWS.filter(r => r.tire === filter);

  return (
    <div className="px-4 py-5 space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avis vérifiés</h1>
          <p className="text-sm text-gray-400 mt-0.5">{REVIEWS.length} avis vérifiés</p>
        </div>
        <button
          onClick={() => setShowFilter(v => !v)}
          className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            showFilter ? "bg-[#00205B] text-white border-[#00205B]" : "bg-white text-gray-700 border-gray-200"
          }`}
        >
          <Filter size={12} />
          Filtrer
        </button>
      </div>

      {/* Note explicative */}
      <p className="text-xs text-gray-400 leading-relaxed -mt-2">
        Les avis affichés par défaut portent sur votre pneu actuel. N'hésitez pas à appliquer un filtre si vous souhaitez consulter les avis sur d'autres pneus.
      </p>

      {/* Panneau filtre */}
      {showFilter && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                placeholder="Rechercher un modèle..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
              />
            </div>
          </div>
          {[{ tire: "Tous", count: REVIEWS.length, avg: null }, ...tireStats]
            .filter(({ tire }) => tire === "Tous" || tire.toLowerCase().includes(filterQuery.toLowerCase()))
            .map(({ tire, count, avg }) => (
            <button
              key={tire}
              onClick={() => { setFilter(tire); setShowFilter(false); setFilterQuery(""); }}
              className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                filter === tire ? "bg-[#27509B]/5" : ""
              }`}
            >
              <div className="text-left">
                <p className={`font-semibold text-sm ${filter === tire ? "text-[#00205B]" : "text-gray-900"}`}>{tire}</p>
                <p className="text-xs text-gray-400">{count} avis</p>
              </div>
              {avg !== null && (
                <div className="flex items-center gap-1">
                  <Star size={13} className="fill-[#FCE500] text-[#FCE500]" />
                  <span className="text-sm font-bold text-gray-700">{avg.toFixed(1)}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Cartes avis */}
      <div className="space-y-4">
        {filtered.map((r) => {
          const initials = r.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              {/* Ligne 1 : avatar + nom + étoiles + date */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-gray-900 text-base leading-tight">{r.name}</p>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <StarRating rating={r.rating} />
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.date}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />{r.location}
                  </p>
                </div>
              </div>

              {/* Badge km */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-[#00205B] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <TrendingUp size={10} />
                  Avis après {r.km.toLocaleString("fr-FR")} km 
                </span>
                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs font-medium px-3 py-1 rounded-full">
                  <Bike size={10} />
                  {r.totalKm.toLocaleString("fr-FR")} km au total
                </span>
              </div>

              {/* Nom du pneu */}
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#27509B] mb-2">{r.tire}</p>

              {/* Verbatim */}
              <p className="text-sm text-gray-700 italic leading-relaxed mb-3">
                &ldquo;{r.text}&rdquo;
              </p>

              {/* Critères 2×2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                <CritBar label="Grip"      score={r.criteria.grip} />
                <CritBar label="Durabilité" score={r.criteria.durabilite} />
                <CritBar label="Confort"   score={r.criteria.confort} />
                <CritBar label="Anti-crevaison" score={r.criteria.anticrv} />
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA laisser un avis */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
        <p className="text-sm text-gray-600 mb-0.5">Vous avez parcouru 2 840 km sur vos {MY_TIRE}.</p>
        <p className="text-xs text-gray-400 mb-4">Seuil requis pour laisser un avis : 500 km ✓</p>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#00205B] text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-[#27509B] transition-colors"
        >
          Laisser un avis vérifié
        </button>
      </div>

      <ReviewModal open={showModal} onClose={() => setShowModal(false)} tireName={MY_TIRE} />
    </div>
  );
}



// ── NAV CONFIG ─────────────────────────────────────────────────────────────

const BOTTOM_NAV: { id: Screen; label: string; Icon: LucideIcon; badge?: number }[] = [
  { id: "dashboard", label: "Profil", Icon: User },
  { id: "garage", label: "Mon pneu", Icon: Package },
  { id: "alerte", label: "Alertes", Icon: Bell, badge: 1 },
  { id: "avis", label: "Avis", Icon: Star },
];



// ── APP SHELL ──────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [liveData, setLiveData] = useState<LiveData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    if (authParam === "success") {
      history.replaceState({}, "", "/");
      loadFromApi("/api/recommend", false).then(() => setScreen("dashboard"));
    } else if (authParam === "denied" || authParam === "error") {
      history.replaceState({}, "", "/");
    }
  }, []);

  async function loadFromApi(path: string, isDemo: boolean) {
    setLoading(true);
    try {
      const r = await fetch(path, { credentials: "include" });
      const data = await r.json();
      if (data.success) {
        setLiveData({
          athlete: data.athlete,
          profile: data.profile,
          reco: {
            explanation: data.explanation,
            recommended: data.recommended,
            alternatives: data.alternatives,
          },
          isDemo,
        });
      }
    } catch {
      // silently fall back to demo data
    } finally {
      setLoading(false);
    }
  }

  function handleConnectStrava() {
    window.location.href = "/auth/strava";
  }

  async function handleLoadDemo() {
    await loadFromApi("/api/demo", true);
    setScreen("dashboard");
  }

  async function handleLogout() {
    try {
      await fetch("/auth/logout", { credentials: "include" });
    } catch {}
    setLiveData(undefined);
    setScreen("landing");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#00205B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-[#FCE500] animate-spin" />
          <p className="text-white/60 text-sm">Analyse de tes activités Strava…</p>
        </div>
      </div>
    );
  }

  if (screen === "landing") {
    return (
      <LandingScreen
        onConnectStrava={handleConnectStrava}
        onLoadDemo={handleLoadDemo}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative overflow-hidden">
      {/* Décorations de fond — visibles uniquement hors de la colonne centrale */}
      <div className="pointer-events-none select-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Cercle bleu haut-droit */}
        <div className="absolute -top-32 -right-32 w-[460px] h-[460px] rounded-full border-[80px] border-[#00205B]/10 blur-lg" />
        {/* Cercle jaune bas-gauche */}
        <div className="absolute -bottom-28 -left-28 w-[470px] h-[470px] rounded-full border-[90px] border-[#FCE500]/30 blur-lg" />
      </div>
      {/* Header fixe */}
      <header className="fixed top-0 inset-x-0 z-20 bg-[#00205B]">
        <div className="max-w-[45rem] mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo + Road Intelligence */}
          <div className="flex items-center gap-2.5 select-none">
            <img src="/michelin-logo-white.png" alt="Michelin" className="h-8 w-auto object-contain" />
            <div>
              <div className="font-bold text-sm tracking-[0.18em] uppercase leading-none text-white">
                Michelin
              </div>
              <div className="text-[9px] tracking-[0.2em] uppercase leading-none mt-0.5 text-white/50">
                Road Intelligence
              </div>
            </div>
          </div>
          {/* Bouton déconnexion */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium transition-colors border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5"
          >
            <LogOut size={13} />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="relative z-10 flex-1 pt-16 pb-16">
        <div className="max-w-[45rem] mx-auto">
          {liveData?.isDemo && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
              <span className="font-semibold">Mode démo</span>
              <span className="text-amber-400">·</span>
              <button onClick={handleConnectStrava} className="underline underline-offset-2 hover:text-amber-900">
                Connectez Strava pour votre profil réel
              </button>
            </div>
          )}
          {screen === "dashboard" && <DashboardScreen liveData={liveData} />}
          {screen === "garage" && <GarageScreen onNavigate={setScreen} />}
          {screen === "alerte" && <AlerteScreen liveData={liveData} />}
          {screen === "avis" && <AvisScreen />}
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200">
        <div className="max-w-[45rem] mx-auto grid grid-cols-4">
          {BOTTOM_NAV.map(({ id, label, Icon, badge }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => setScreen(id)}
                className="relative flex flex-col items-center justify-center pt-2 pb-2 gap-0.5"
              >
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-[#27509B] rounded-full" />
                )}
                <div className="relative">
                  <Icon size={22} className={active ? "text-[#27509B]" : "text-gray-400"} />
                  {badge && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                      {badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${active ? "text-[#27509B]" : "text-gray-400"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modal confirmation déconnexion */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogoutModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <LogOut size={22} className="text-red-500" />
              </div>
              <h2 className="font-bold text-lg text-gray-900">Se déconnecter ?</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Vous serez redirigé vers la page d'accueil. Vos données Strava devront être rechargées à la prochaine connexion.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => { setShowLogoutModal(false); handleLogout(); }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
