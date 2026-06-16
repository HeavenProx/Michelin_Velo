import { useState, useEffect } from "react";
import {
  Bike, MapPin, Star, AlertTriangle, CheckCircle, Users, TrendingUp,
  Award, ShoppingCart, Navigation, Activity, ArrowRight, Menu,
  MessageSquare, Home, Droplets, Wind, ChevronRight, Shield, Zap, Target,
  Loader2, type LucideIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";

type Screen = "landing" | "dashboard" | "reco" | "garage" | "alerte" | "avis" | "pairs";

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
  location: "Lyon, France",
  monthlyKm: 387,
  totalKm: 8420,
  rides: 47,
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

const MONTHLY_KM = [
  { month: "Jan", km: 312 },
  { month: "Fév", km: 280 },
  { month: "Mar", km: 395 },
  { month: "Avr", km: 420 },
  { month: "Mai", km: 445 },
  { month: "Jun", km: 387 },
];

const CURRENT_TIRES = [
  {
    id: "front",
    label: "Avant",
    model: "Power Road TLR",
    size: "700×25C",
    posedDate: "15 janv. 2026",
    km: 2840,
    score: 64,
    status: "surveiller",
  },
  {
    id: "rear",
    label: "Arrière",
    model: "Power Road TLR",
    size: "700×25C",
    posedDate: "15 janv. 2026",
    km: 3240,
    score: 24,
    status: "remplacer",
  },
];

const RECO = {
  model: "Power All Season Pro",
  size: "700×25C",
  ean: "3528706063376",
  rationale: "Sur tes 47 sorties des 6 derniers mois, tu roules 52 % en montagne par météo variable — 31 % de sorties humides. La Power All Season Pro est faite pour ton profil exact.",
  highlights: [
    { icon: "shield", text: "Grip renforcé en conditions humides — technologie Cross Contact brevetée Michelin" },
    { icon: "zap", text: "Protection anti-crevaison niveau 5, idéale en descente alpine" },
    { icon: "trending", text: "+18 % d'adhérence sur pavé mouillé vs. Power Road standard" },
    { icon: "activity", text: "Durée de vie estimée : 5 000 – 6 000 km sur terrain mixte" },
  ],
  retailers: [
    { name: "Amazon", price: "54,90 €", delivery: "Livraison demain" },
    { name: "Decathlon", price: "57,99 €", delivery: "Retrait en magasin" },
    { name: "Alltricks", price: "53,50 €", delivery: "3 – 5 jours ouvrés" },
  ],
  peerCount: 312,
  peerAvg: 4.6,
};

const REVIEWS = [
  { id: 1, name: "Marc T.", location: "Grenoble", tire: "Power All Season Pro", km: 4200, rating: 5, text: "Impeccable sous la pluie, j'ai descendu le Galibier mouillé sans la moindre frayeur. Durabilité au rendez-vous après 4 200 km.", terrain: "Route", date: "Mars 2026" },
  { id: 2, name: "Sophie R.", location: "Nice", tire: "Power Road TLR", km: 3100, rating: 4, text: "Très léger, roulant. Un peu sensible aux petits cailloux sur les routes de montagne. Pour la route pure, parfait.", terrain: "Route", date: "Avr. 2026" },
  { id: 3, name: "Julien D.", location: "Bordeaux", tire: "Power Gravel", km: 2800, rating: 5, text: "Le meilleur compromis route/chemin que j'aie trouvé. Tient la route par temps sec comme mouillé.", terrain: "Gravel", date: "Mai 2026" },
  { id: 4, name: "Emma L.", location: "Strasbourg", tire: "Power All Season Pro", km: 5600, rating: 5, text: "5 600 km et le pneu est encore en état acceptable. ROI excellent pour un pneu premium.", terrain: "VTT", date: "Fév. 2026" },
];

const PEERS = [
  { name: "Thomas M.", location: "Chambéry", similarity: 94, tire: "Power All Season Pro", rating: 4.7, rides: 52, terrain: "Montagne 58%" },
  { name: "Clara V.", location: "Annecy", similarity: 89, tire: "Power All Season Pro", rating: 4.8, rides: 44, terrain: "Montagne 49%" },
  { name: "Romain B.", location: "Grenoble", similarity: 82, tire: "Power Road TLR", rating: 4.5, rides: 61, terrain: "Montagne 45%" },
];

// ── SHARED COMPONENTS ──────────────────────────────────────────────────────

function MichelinWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          dark ? "bg-white text-[#27509B]" : "bg-[#27509B] text-white"
        }`}
      >
        M
      </div>
      <div>
        <div
          className={`font-bold text-sm tracking-[0.18em] uppercase leading-none ${
            dark ? "text-white" : "text-[#27509B]"
          }`}
        >
          Michelin
        </div>
        <div
          className={`text-[9px] tracking-[0.2em] uppercase leading-none mt-0.5 ${
            dark ? "text-white/50" : "text-[#27509B]/50"
          }`}
        >
          Road Intelligence
        </div>
      </div>
    </div>
  );
}

function TyreGauge({ score }: { score: number }) {
  const r = 66;
  const cx = 100;
  const cy = 92;
  const circumference = Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = score > 60 ? "#2E7D32" : score > 30 ? "#F9A825" : "#B71C1C";
  const bgColor = score > 60 ? "#E8F5E9" : score > 30 ? "#FFF8E1" : "#FFEBEE";
  const label = score > 60 ? "Bon état" : score > 30 ? "À surveiller" : "À remplacer";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 105" className="w-40">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#E5E5E5"
          strokeWidth="13"
          strokeLinecap="round"
        />
        {score > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill={color}
          fontFamily="'JetBrains Mono', monospace"
        >
          {score}
        </text>
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize="10"
          fill="#999"
          fontFamily="'Noto Sans', sans-serif"
        >
          /100
        </text>
      </svg>
      <span
        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
        style={{ color, backgroundColor: bgColor }}
      >
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    remplacer: { label: "À remplacer", cls: "bg-red-50 text-red-700 border border-red-200" },
    surveiller: { label: "À surveiller", cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
    ok: { label: "Bon état", cls: "bg-green-50 text-green-700 border border-green-200" },
  };
  const { label, cls } = cfg[status] ?? cfg.ok;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

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
        <div className="absolute rounded-full w-[220px] h-[220px] md:w-[600px] md:h-[600px] -left-[110px] md:-left-[300px]"
             style={{ top: '38%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute rounded-full w-[320px] h-[320px] md:w-[820px] md:h-[820px] -left-[160px] md:-left-[410px]"
             style={{ top: '38%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
        {/* Groupe droit — 62% hauteur */}
        <div className="absolute rounded-full w-[220px] h-[220px] md:w-[600px] md:h-[600px] -right-[110px] md:-right-[300px]"
             style={{ top: '62%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute rounded-full w-[320px] h-[320px] md:w-[820px] md:h-[820px] -right-[160px] md:-right-[410px]"
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

function DashboardScreen({
  onNavigate,
  liveData,
}: {
  onNavigate: (s: Screen) => void;
  liveData?: LiveData;
}) {
  const name = liveData
    ? `${liveData.athlete.firstname} ${liveData.athlete.lastname}`
    : RIDER.name;
  const location = liveData?.athlete.city
    ? `${liveData.athlete.city}, France`
    : RIDER.location;
  const region = liveData?.profile.region ?? RIDER.region;
  const monthlyKm = liveData?.profile.monthly_distance ?? RIDER.monthlyKm;
  const totalRides = liveData?.profile.ride_count ?? RIDER.rides;
  const avgSpeed = liveData?.profile.avg_speed_kmh ?? RIDER.avgSpeed;
  const recoModel = liveData?.reco.recommended.name ?? RECO.model;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-muted-foreground text-sm">Bienvenue,</p>
        <h1 className="text-2xl font-bold text-foreground">{name}</h1>
        <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
          <MapPin size={11} />
          {location} · {region}
        </p>
      </div>

      {/* Alert banner */}
      <button
        onClick={() => onNavigate("alerte")}
        className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between hover:bg-red-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-700 text-sm">Pneu arrière à remplacer</p>
            <p className="text-red-400 text-xs">Score 24/100 · 3 240 km parcourus</p>
          </div>
        </div>
        <ChevronRight size={15} className="text-red-300 flex-shrink-0" />
      </button>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Ce mois", value: String(monthlyKm), unit: "km", Icon: Activity },
          { label: "Sorties totales", value: String(totalRides), unit: "rides", Icon: Bike },
          { label: "Vitesse moy.", value: String(avgSpeed), unit: "km/h", Icon: TrendingUp },
        ].map(({ label, value, unit, Icon }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-3.5">
            <Icon size={14} className="text-muted-foreground mb-2" />
            <div className="font-bold text-xl text-foreground font-mono leading-none">{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{unit}</div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="font-semibold text-sm text-foreground mb-4">Répartition terrain</p>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie
                    data={RIDER.terrain}
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={52}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {RIDER.terrain.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 flex-1">
              {RIDER.terrain.map((t) => (
                <div key={t.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-xs text-muted-foreground flex-1">{t.name}</span>
                  <span className="text-xs font-bold text-foreground font-mono">{t.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="font-semibold text-sm text-foreground mb-4">Km mensuels</p>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={MONTHLY_KM} barSize={16} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#999" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  border: "1px solid rgba(39,80,155,0.15)",
                  borderRadius: 10,
                  padding: "4px 10px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                formatter={(v: number) => [`${v} km`, ""]}
                cursor={{ fill: "rgba(39,80,155,0.06)" }}
              />
              <Bar dataKey="km" fill="#27509B" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weather & style */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm text-foreground mb-3">Conditions de ride</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { Icon: Zap, label: `Sec — ${RIDER.weather.dry}%` },
            { Icon: Droplets, label: `Humide — ${RIDER.weather.wet}%` },
            { Icon: Wind, label: `Froid — ${RIDER.weather.cold}%` },
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5">
              <Icon size={11} className="text-primary" />
              <span className="text-xs font-medium text-secondary-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-[#FCE500]/20 border border-[#FCE500]/40 rounded-xl px-3 py-1.5">
            <Award size={13} className="text-[#27509B]" />
            <span className="text-sm font-bold text-[#27509B]">
              Style : {liveData?.profile.style_label ?? RIDER.style}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Efforts longs, cadence régulière</p>
        </div>
      </div>

      {/* Reco teaser */}
      <button
        onClick={() => onNavigate("reco")}
        className="w-full bg-[#27509B] hover:bg-[#1e3f7a] active:bg-[#27509B] rounded-2xl p-5 text-left transition-colors duration-200"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold mb-1">
              Recommandation sur-mesure
            </p>
            <h3 className="text-white font-bold text-xl">{recoModel}</h3>
            <p className="text-white/60 text-sm mt-0.5">
              {totalRides} sorties · {liveData?.profile.terrain_label ?? "52% montagne"} · {liveData?.profile.weather_exposure.rain_percentage ?? 31}% humide
            </p>
          </div>
          <div className="bg-[#FCE500] rounded-full p-2 mt-0.5 flex-shrink-0">
            <ArrowRight size={15} className="text-black" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            <Star size={12} className="fill-[#FCE500] text-[#FCE500]" />
            <span className="text-white font-bold text-sm">{RECO.peerAvg}</span>
          </div>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/55 text-xs">
            {RECO.peerCount} riders au profil proche roulent en {recoModel}
          </span>
        </div>
      </button>
    </div>
  );
}

// ── RECOMMANDATION ─────────────────────────────────────────────────────────

function RecoScreen({
  onNavigate,
  liveData,
}: {
  onNavigate: (s: Screen) => void;
  liveData?: LiveData;
}) {
  const recoModel = liveData?.reco.recommended.name ?? RECO.model;
  const rationale = liveData?.reco.explanation ?? RECO.rationale;
  const matchScore = liveData?.reco.recommended.match_score;
  const lifeKm = liveData?.reco.recommended.lifetime_km ?? 5500;
  const priceRange = liveData?.reco.recommended.price_range ?? "53 – 58 €";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Recommandation</h1>

      {/* Hero */}
      <div className="bg-[#00205B] rounded-2xl overflow-hidden">
        <div className="relative h-44 bg-gradient-to-br from-[#27509B] to-[#00205B]">
          <img
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=700&h=300&fit=crop&auto=format"
            alt="Michelin tyre close-up"
            className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity"
          />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <p className="text-[#FCE500] text-[10px] uppercase tracking-[0.2em] font-semibold mb-1">
              Michelin · Route &amp; Endurance
              {matchScore && (
                <span className="ml-2 bg-[#FCE500]/20 rounded-full px-2 py-0.5">{matchScore}% match</span>
              )}
            </p>
            <h2 className="text-white text-2xl font-bold leading-tight">{recoModel}</h2>
            <p className="text-white/50 text-sm mt-0.5">700×25C · À partir de {priceRange}</p>
          </div>
        </div>

        <div className="p-5 border-t border-white/8">
          <p className="text-[#FCE500] text-[10px] uppercase tracking-wider font-semibold mb-2">
            Pourquoi ce pneu pour toi
          </p>
          <p className="text-white/70 text-sm leading-relaxed italic">
            &ldquo;{rationale}&rdquo;
          </p>
        </div>
      </div>

      {/* Tech highlights */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-4">Points forts techniques</p>
        <div className="space-y-4">
          {RECO.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                {h.icon === "shield" && <Shield size={13} className="text-primary" />}
                {h.icon === "zap" && <Zap size={13} className="text-primary" />}
                {h.icon === "trending" && <TrendingUp size={13} className="text-primary" />}
                {h.icon === "activity" && <Activity size={13} className="text-primary" />}
              </div>
              <p className="text-sm text-foreground leading-snug">{h.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alternatives */}
      {liveData?.reco.alternatives && liveData.reco.alternatives.length > 0 && (
        <div className="bg-secondary rounded-2xl p-5">
          <p className="font-semibold text-sm mb-3">Alternatives</p>
          <div className="space-y-2">
            {liveData.reco.alternatives.map((alt) => (
              <div key={alt.name} className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
                <span className="text-sm font-medium">{alt.name}</span>
                <span className="text-sm font-bold text-primary">{alt.match_score}% match</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social proof */}
      <div className="bg-secondary rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1.5">
          <Users size={13} className="text-primary" />
          <p className="text-sm font-semibold">
            {RECO.peerCount} riders au profil proche roulent en {recoModel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StarRating rating={RECO.peerAvg} />
          <span className="text-sm font-bold">{RECO.peerAvg}/5</span>
          <span className="text-xs text-muted-foreground">· avis vérifiés au kilomètre</span>
        </div>
        <button
          onClick={() => onNavigate("pairs")}
          className="mt-3 text-xs text-primary underline underline-offset-4 hover:text-primary/70 transition-colors"
        >
          Voir les riders qui me ressemblent →
        </button>
      </div>

      {/* Retailers */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-0.5">Acheter maintenant</p>
        <p className="text-xs text-muted-foreground mb-4">EAN {RECO.ean}</p>
        <div className="space-y-2">
          {RECO.retailers.map((r) => (
            <a
              key={r.name}
              href="#"
              className="flex items-center justify-between p-3 border border-border rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {r.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.delivery}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{r.price}</span>
                <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </a>
          ))}
        </div>
        <button className="w-full mt-3 border border-primary text-primary font-semibold py-2.5 rounded-xl text-sm hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2">
          <Navigation size={13} />
          Trouver un revendeur proche
        </button>
      </div>
    </div>
  );
}

// ── GARAGE ─────────────────────────────────────────────────────────────────

function GarageScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mon Garage</h1>
        <button className="text-xs text-primary underline underline-offset-4 font-medium">
          + Ajouter
        </button>
      </div>
      <p className="text-muted-foreground text-sm -mt-3">
        Tyre Score · synchronisé Strava
      </p>

      {CURRENT_TIRES.map((tire) => (
        <div
          key={tire.id}
          className={`bg-card border rounded-2xl p-5 ${
            tire.status === "remplacer" ? "border-red-200" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{tire.label}</p>
              <h3 className="font-bold text-foreground mt-0.5 text-lg">{tire.model}</h3>
              <p className="text-xs text-muted-foreground">{tire.size}</p>
            </div>
            <StatusBadge status={tire.status} />
          </div>

          <div className="flex items-center gap-6">
            <TyreGauge score={tire.score} />
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Posé le</p>
                <p className="font-semibold text-sm font-mono">{tire.posedDate}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Km parcourus</p>
                <p className="font-bold text-2xl font-mono text-foreground leading-none">
                  {tire.km.toLocaleString("fr-FR")}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Échéance est.</p>
                <p className="font-semibold text-sm font-mono text-muted-foreground">
                  ~{Math.round(tire.km / Math.max(1 - tire.score / 100, 0.01)).toLocaleString("fr-FR")} km total
                </p>
              </div>
            </div>
          </div>

          {tire.status === "remplacer" && (
            <button
              onClick={() => onNavigate("alerte")}
              className="mt-4 w-full bg-[#FCE500] hover:bg-[#FDED44] text-black font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart size={13} />
              Remplacer maintenant
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ALERTE ─────────────────────────────────────────────────────────────────

function AlerteScreen({ liveData }: { liveData?: LiveData }) {
  const recoModel = liveData?.reco.recommended.name ?? RECO.model;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Alerte remplacement</h1>

      <div className="bg-red-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={18} className="text-white flex-shrink-0" />
          <h2 className="font-bold text-lg">Pneu Arrière — Score 24/100</h2>
        </div>
        <p className="text-white/75 text-sm leading-relaxed">
          Votre pneu arrière Power Road TLR atteint un niveau d&apos;usure critique après 3 240 km.
          Le remplacement est recommandé pour votre sécurité en descente.
        </p>
      </div>

      <div className="bg-card border border-red-200 rounded-2xl p-5 flex flex-col items-center">
        <TyreGauge score={24} />
        <div className="mt-5 grid grid-cols-3 gap-4 w-full text-center border-t border-border pt-4">
          {[
            { val: "3 240", unit: "km parcourus" },
            { val: "~760", unit: "km restants" },
            { val: "15 janv.", unit: "date de pose" },
          ].map(({ val, unit }) => (
            <div key={unit}>
              <p className="font-bold font-mono text-lg text-foreground">{val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{unit}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#27509B] rounded-2xl p-5">
        <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Remplacement conseillé</p>
        <h3 className="text-white font-bold text-lg">{recoModel}</h3>
        <p className="text-white/60 text-sm mb-4">Adapté à votre profil montagne / humide</p>

        <div className="space-y-2">
          {RECO.retailers.map((r) => (
            <a
              key={r.name}
              href="#"
              className="flex items-center justify-between bg-white/8 hover:bg-white/15 rounded-xl p-3 transition-colors"
            >
              <div>
                <p className="font-semibold text-white text-sm">{r.name}</p>
                <p className="text-white/45 text-xs">{r.delivery}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#FCE500] text-sm">{r.price}</span>
                <ChevronRight size={13} className="text-white/30" />
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Navigation size={13} className="text-primary" />
          Points de revente proches
        </h3>
        <div className="bg-muted rounded-xl h-36 flex items-center justify-center mb-3">
          <div className="text-center">
            <Navigation size={20} className="text-muted-foreground mx-auto mb-1.5" />
            <p className="text-muted-foreground text-xs">Carte Leaflet · OpenStreetMap</p>
            <p className="text-muted-foreground text-xs mt-0.5">3 revendeurs dans un rayon de 5 km</p>
          </div>
        </div>
        {["Décathlon Villeurbanne · 2.1 km", "Vélo Store Lyon 6e · 3.4 km", "Cyclosport Bron · 4.8 km"].map(
          (store) => (
            <div
              key={store}
              className="flex items-center justify-between text-sm p-2.5 hover:bg-muted rounded-xl cursor-pointer transition-colors"
            >
              <span>{store}</span>
              <ChevronRight size={13} className="text-muted-foreground" />
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── AVIS ───────────────────────────────────────────────────────────────────

function AvisScreen() {
  const [filter, setFilter] = useState("Tous");
  const filters = ["Tous", "Route", "VTT", "Gravel"];
  const filtered = filter === "Tous" ? REVIEWS : REVIEWS.filter((r) => r.terrain === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Avis vérifiés</h1>
        <div className="flex items-center gap-1.5">
          <CheckCircle size={12} className="text-green-600" />
          <span className="text-xs text-green-600 font-semibold">Vérifiés au km</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f
                ? "bg-primary text-white shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-primary/10"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-[#27509B] rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-3xl font-mono leading-none">
            4.7
            <span className="text-sm font-normal text-white/50 ml-1">/5</span>
          </p>
          <StarRating rating={4.7} />
          <p className="text-white/50 text-xs mt-1.5">
            Note moyenne · {REVIEWS.length} avis vérifiés
          </p>
        </div>
        <div className="text-right">
          <p className="text-[#FCE500] font-bold text-2xl font-mono">1 vs 100</p>
          <p className="text-white/50 text-xs mt-0.5">L&apos;avantage Michelin</p>
          <p className="text-white/35 text-xs">vs. Continental</p>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                  {r.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.location} · {r.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 flex-shrink-0">
                <CheckCircle size={10} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">
                  {r.km.toLocaleString("fr-FR")} km
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <StarRating rating={r.rating} />
              <span className="text-xs text-muted-foreground">· {r.tire}</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>

      <div className="bg-muted rounded-2xl p-5 text-center">
        <p className="text-sm text-muted-foreground mb-0.5">
          Vous avez parcouru 2 840 km sur vos Power Road TLR.
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Seuil requis pour laisser un avis : 500 km ✓
        </p>
        <button className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-primary/90 transition-colors">
          Laisser un avis vérifié
        </button>
      </div>
    </div>
  );
}

// ── PAIRS ──────────────────────────────────────────────────────────────────

function PairsScreen({ liveData }: { liveData?: LiveData }) {
  const recoModel = liveData?.reco.recommended.name ?? RECO.model;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Riders comme toi</h1>
      <p className="text-muted-foreground text-sm -mt-3">
        Cyclistes au profil proche · algorithme terrain + météo
      </p>

      <div className="bg-secondary rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} className="text-primary" />
          <p className="font-semibold text-sm">{RECO.peerCount} riders au profil similaire roulent en…</p>
        </div>
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold text-foreground">{recoModel}</h3>
          <div className="flex items-center gap-1">
            <Star size={14} className="fill-[#FCE500] text-[#FCE500]" />
            <span className="font-bold text-sm">{RECO.peerAvg}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">n={RECO.peerCount} · note moyenne {RECO.peerAvg}/5</p>
      </div>

      <div className="space-y-3">
        {PEERS.map((p, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                {p.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <div className="flex items-center gap-1 bg-primary/10 rounded-full px-2 py-0.5 flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{p.similarity}%</span>
                    <span className="text-[10px] text-primary/60">sim.</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.location} · {p.terrain} · {p.rides} sorties
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-semibold">{p.tire}</span>
                  <div className="flex items-center gap-0.5">
                    <Star size={10} className="fill-[#FCE500] text-[#FCE500]" />
                    <span className="text-xs text-muted-foreground">{p.rating}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Award size={13} className="text-primary" />
          Communauté Michelin Vélo
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { val: "1.2M", label: "km roulés sur Michelin" },
            { val: "5 002", label: "riders actifs" },
            { val: "4.6", label: "note moyenne" },
          ].map(({ val, label }) => (
            <div key={label}>
              <p className="font-bold text-xl font-mono text-foreground">{val}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NAV CONFIG ─────────────────────────────────────────────────────────────

const NAV: { id: Screen; label: string; Icon: LucideIcon; badge?: number }[] = [
  { id: "dashboard", label: "Profil", Icon: Home },
  { id: "reco", label: "Recommandation", Icon: Target },
  { id: "garage", label: "Mon Garage", Icon: Bike },
  { id: "alerte", label: "Alertes", Icon: AlertTriangle, badge: 1 },
  { id: "avis", label: "Avis", Icon: MessageSquare },
  { id: "pairs", label: "Riders", Icon: Users },
];

// ── APP SHELL ──────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | undefined>(undefined);
  const [loading, setLoading] = useState(false);

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

  const athleteName = liveData
    ? `${liveData.athlete.firstname} ${liveData.athlete.lastname}`
    : RIDER.name;
  const authSubline = liveData?.isDemo ? "Mode démo" : "Connecté via Strava";

  return (
    <div className="min-h-screen bg-background flex font-sans">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-card border-r border-border z-30 flex flex-col transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-border">
          <MichelinWordmark />
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, Icon, badge }) => {
            const active = screen === id;
            return (
              <button
                key={id}
                onClick={() => { setScreen(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon size={15} />
                <span className="flex-1 text-left">{label}</span>
                {badge && !active && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {athleteName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{athleteName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{authSubline}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 -ml-1 text-foreground"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <MichelinWordmark />
          {screen === "alerte" && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">
              !
            </span>
          )}
        </header>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8 max-w-2xl mx-auto w-full">
          {liveData?.isDemo && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
              <span className="font-semibold">Mode démo</span>
              <span className="text-amber-500">·</span>
              <span>Données fictives — </span>
              <button
                onClick={handleConnectStrava}
                className="underline underline-offset-2 hover:text-amber-900"
              >
                connectez Strava pour votre profil réel
              </button>
            </div>
          )}
          {screen === "dashboard" && <DashboardScreen onNavigate={setScreen} liveData={liveData} />}
          {screen === "reco" && <RecoScreen onNavigate={setScreen} liveData={liveData} />}
          {screen === "garage" && <GarageScreen onNavigate={setScreen} />}
          {screen === "alerte" && <AlerteScreen liveData={liveData} />}
          {screen === "avis" && <AvisScreen />}
          {screen === "pairs" && <PairsScreen liveData={liveData} />}
        </main>
      </div>
    </div>
  );
}
