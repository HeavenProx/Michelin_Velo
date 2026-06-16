import { useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { STORES } from "@/data/demo";
import { StoreMap, physicalStores } from "@/components/StoreMap";

const onlineStores = STORES.filter((s) => s.type === "online");

export function StoreSection() {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(name: string) {
    setSelected((prev) => (prev === name ? null : name));
  }

  return (
    <>
      <StoreMap selectedStore={selected} />

      {/* Magasins physiques — scrollable, clic → zoom carte */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400">
          Points de vente ({physicalStores.length})
        </p>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-[10px] text-[#27509B] font-semibold hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
        {physicalStores.map((s) => {
          const isSelected = selected === s.name;
          return (
            <button
              key={s.name}
              onClick={() => handleSelect(s.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                isSelected
                  ? "bg-[#00205B]/5 border-l-2 border-[#00205B]"
                  : "hover:bg-gray-50 border-l-2 border-transparent"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected ? "bg-[#00205B]/15" : "bg-[#27509B]/10"
              }`}>
                <MapPin size={15} className={isSelected ? "text-[#00205B]" : "text-[#27509B]"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${isSelected ? "text-[#00205B]" : "text-gray-900"}`}>
                  {s.name}
                </p>
                <p className="text-xs text-gray-400 truncate">{s.address}</p>
              </div>
              <span className={`font-bold text-sm flex-shrink-0 ${isSelected ? "text-[#00205B]" : "text-[#27509B]"}`}>
                {s.distance}
              </span>
            </button>
          );
        })}
      </div>

      {/* Magasins en ligne — toujours visibles */}
      <div className="border-t border-gray-100">
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-400">En ligne</p>
        </div>
        <div className="divide-y divide-gray-100">
          {onlineStores.map((s) => (
            <a key={s.name} href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#00205B]/8">
                <ExternalLink size={15} className="text-[#00205B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.address}</p>
              </div>
              <span className="font-bold text-sm flex-shrink-0 text-gray-500">{s.distance}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
