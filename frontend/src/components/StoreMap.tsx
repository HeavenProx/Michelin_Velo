import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { STORES } from "@/data/demo";

// ── Icônes ────────────────────────────────────────────────────────────────

const storeIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:26px;height:34px;position:relative;
    background:#00205B;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:2.5px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
  "><div style="
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%) rotate(45deg);
    width:9px;height:9px;
    background:#FCE500;border-radius:50%;
  "></div></div>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -36],
});

const storeIconSelected = L.divIcon({
  className: "",
  html: `<div style="
    width:30px;height:40px;position:relative;
    background:#FC4C02;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    border:2.5px solid white;
    box-shadow:0 3px 12px rgba(252,76,2,0.55);
  "><div style="
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%) rotate(45deg);
    width:10px;height:10px;
    background:#FCE500;border-radius:50%;
  "></div></div>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -42],
});

const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:18px;height:18px;
    background:#2563EB;border-radius:50%;
    border:3px solid white;
    box-shadow:0 0 0 5px rgba(37,99,235,0.2),0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ── Constantes ────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [45.5, 5.2];
const DEFAULT_ZOOM = 8;

export const physicalStores = STORES.filter((s) => s.type === "physical") as Array<
  Extract<(typeof STORES)[number], { type: "physical" }>
>;

// ── MapController — flyTo géolocalisation + magasin sélectionné ───────────

function MapController({
  selectedStore,
  markerRefs,
  onLocated,
}: {
  selectedStore: string | null;
  markerRefs: React.MutableRefObject<Record<string, L.Marker | null>>;
  onLocated: (pos: [number, number]) => void;
}) {
  const map = useMap();

  // Géolocalisation au montage
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        onLocated(pos);
        map.flyTo(pos, 13, { duration: 1.5 });
      },
      () => {},
      { timeout: 8000, maximumAge: 60_000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly vers le magasin sélectionné + ouverture du popup
  useEffect(() => {
    if (!selectedStore) return;
    const store = physicalStores.find((s) => s.name === selectedStore);
    if (!store) return;
    map.flyTo([store.coords.lat, store.coords.lng], 15, { duration: 1 });
    const timer = setTimeout(() => {
      markerRefs.current[selectedStore]?.openPopup();
    }, 1100);
    return () => clearTimeout(timer);
  }, [selectedStore, map, markerRefs]);

  return null;
}

// ── Composant principal ───────────────────────────────────────────────────

interface StoreMapProps {
  selectedStore: string | null;
}

export function StoreMap({ selectedStore }: StoreMapProps) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(true);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  function handleLocated(pos: [number, number]) {
    setUserPos(pos);
    setLocating(false);
  }

  // Masquer l'overlay si la géoloc prend trop de temps
  useEffect(() => {
    const t = setTimeout(() => setLocating(false), 9000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {locating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 pointer-events-none">
          <span className="text-xs text-gray-500 animate-pulse">Localisation en cours…</span>
        </div>
      )}

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "240px", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          selectedStore={selectedStore}
          markerRefs={markerRefs}
          onLocated={handleLocated}
        />

        {physicalStores.map((s) => (
          <Marker
            key={s.name}
            position={[s.coords.lat, s.coords.lng]}
            icon={selectedStore === s.name ? storeIconSelected : storeIcon}
            ref={(ref) => { markerRefs.current[s.name] = ref; }}
          >
            <Popup>
              <p className="font-semibold text-sm text-gray-900 mb-0.5">{s.name}</p>
              <p className="text-xs text-gray-500">{s.address}</p>
              <p className="text-xs font-bold text-[#00205B] mt-1">{s.distance}</p>
            </Popup>
          </Marker>
        ))}

        {userPos && (
          <Marker position={userPos} icon={userIcon}>
            <Popup>
              <p className="font-semibold text-sm text-gray-900">Vous êtes ici</p>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
