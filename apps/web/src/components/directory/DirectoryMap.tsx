import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/hooks/useAuth";
import { type DirectoryEntry, fullName } from "@/hooks/useDirectory";
import { MapPin } from "lucide-react";

// ---------------------------------------------------------------------------
// Custom SVG pin icon (avoids Vite asset-path issues with default Leaflet icon)
// ---------------------------------------------------------------------------

function makePinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z" fill="${color}"/>
      <circle cx="12" cy="12" r="4.5" fill="white"/>
    </svg>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34],
  });
}

const pinDefault = makePinIcon("#64748b");

// ---------------------------------------------------------------------------
// Compute default center from entries, fallback to Switzerland
// ---------------------------------------------------------------------------

function defaultCenter(
  entries: DirectoryEntry[]
): [number, number] {
  const mapped = entries.filter(
    (e) => e.showOnMap && e.latitude != null && e.longitude != null
  );
  if (mapped.length === 0) return [46.8, 8.2];
  const lat = mapped.reduce((s, e) => s + e.latitude!, 0) / mapped.length;
  const lng = mapped.reduce((s, e) => s + e.longitude!, 0) / mapped.length;
  return [lat, lng];
}

// ---------------------------------------------------------------------------
// Mini popup card shown when clicking a pin
// ---------------------------------------------------------------------------

function PinPopup({
  entry,
  detailPath,
}: {
  entry: DirectoryEntry;
  detailPath: string;
}) {
  return (
    <div className="min-w-[160px] space-y-1">
      <p className="font-semibold text-sm leading-tight">{fullName(entry)}</p>
      {entry.practiceName && (
        <p className="text-xs text-gray-500 truncate">{entry.practiceName}</p>
      )}
      {(entry.city || entry.country) && (
        <p className="text-xs text-gray-500">
          {[entry.city, entry.country].filter(Boolean).join(", ")}
        </p>
      )}
      <a
        href={`${detailPath}/${entry.userId}`}
        className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline"
      >
        Voir le profil →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectoryMap
// ---------------------------------------------------------------------------

interface DirectoryMapProps {
  entries: DirectoryEntry[];
  /** Container height class, e.g. "h-[500px]" */
  heightClass?: string;
}

export function DirectoryMap({
  entries,
  heightClass = "h-[500px]",
}: DirectoryMapProps) {
  const { isAuthenticated } = useAuth();
  const detailPath = isAuthenticated ? "/user/annuaire" : "/annuaire";

  const mappable = useMemo(
    () =>
      entries.filter(
        (e) => e.showOnMap && e.latitude != null && e.longitude != null
      ),
    [entries]
  );

  const center = useMemo(() => defaultCenter(entries), [entries]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border ${heightClass}`}>
      {mappable.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/60 backdrop-blur-sm">
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun praticien géolocalisé pour ces filtres.
          </p>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {mappable.map((entry) => (
          <Marker
            key={entry.userId}
            position={[entry.latitude!, entry.longitude!]}
            icon={pinDefault}
          >
            <Popup>
              <PinPopup entry={entry} detailPath={detailPath} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
