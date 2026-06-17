export interface Athlete {
  id: number;
  firstname: string;
  lastname: string;
  city?: string;
  country?: string;
  profile?: string | null;
}

export interface LiveProfile {
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

export interface LiveReco {
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

export interface LiveData {
  athlete: Athlete;
  profile: LiveProfile;
  reco: LiveReco;
  isDemo?: boolean;
}

export interface WearAlert {
  id: string;
  tire: string;
  wear: number;
  date: string;
  dismissed: boolean;
}

export interface Review {
  id: number;
  name: string;
  location: string;
  tire: string;
  km: number;
  totalKm: number;
  rating: number;
  text: string;
  date: string;
  criteria: { grip: number; durabilite: number; confort: number; anticrv: number };
}

export interface GarageTyre {
  id: number;
  position: "FRONT" | "REAR";
  model: { name: string; lifetime_km: number; price_range: string };
  mounted_date: string;
  km_used: number;
  km_max_adjusted: number;
  km_left: number;
  wear_percent: number;
  status_label: string;
  explanation: string;
}

export interface GarageBike {
  id: number;
  name: string;
  type: "ROAD" | "GRAVEL" | "MTB" | "E-BIKE";
  strava_distance_km: number;
  tyres: GarageTyre[];
}

export interface GarageData {
  success: true;
  bikes: GarageBike[];
}
