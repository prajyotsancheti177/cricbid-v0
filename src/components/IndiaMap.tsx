import { memo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { scaleSqrt, scaleLinear } from "d3-scale";

interface CityData {
    city: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    count: number;
}

interface IndiaMapProps {
    cityData: CityData[];
    maxCount: number;
}

// India center coordinates and zoom level
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_ZOOM = 5;

// Fit bounds to India
const IndiaBounds = () => {
    const map = useMap();
    useEffect(() => {
        // India bounding box: SW [6.5, 68], NE [37, 97]
        map.fitBounds([[6.5, 68], [37, 97]], { padding: [20, 20] });
    }, [map]);
    return null;
};

const IndiaMap = memo(({ cityData, maxCount }: IndiaMapProps) => {
    // Scale for marker size - using sqrt scale for better visual representation
    const radiusScale = scaleSqrt()
        .domain([1, Math.max(maxCount, 1)])
        .range([8, 35]);

    // Opacity scale
    const opacityScale = scaleLinear()
        .domain([1, Math.max(maxCount, 1)])
        .range([0.6, 1]);

    // Color based on traffic level
    const getMarkerColor = (count: number) => {
        const ratio = count / maxCount;
        if (ratio >= 0.7) return { fill: "#ef4444", stroke: "#fca5a5" }; // Red
        if (ratio >= 0.3) return { fill: "#f59e0b", stroke: "#fde047" }; // Amber
        return { fill: "#06b6d4", stroke: "#67e8f9" }; // Cyan
    };

    return (
        <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            {/* Decorative corner elements */}
            <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-cyan-500/60 rounded-tl-xl z-[1000] pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-cyan-500/60 rounded-tr-xl z-[1000] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-cyan-500/60 rounded-bl-xl z-[1000] pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-cyan-500/60 rounded-br-xl z-[1000] pointer-events-none"></div>

            <MapContainer
                center={INDIA_CENTER}
                zoom={INDIA_ZOOM}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                zoomControl={true}
                className="z-0"
            >
                <IndiaBounds />

                {/* Dark theme map tiles from CartoDB */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* City markers with pulsing effect for high traffic */}
                {cityData.map((city, index) => {
                    const colors = getMarkerColor(city.count);
                    const radius = radiusScale(city.count);
                    const isHighTraffic = city.count >= maxCount * 0.5;

                    return (
                        <CircleMarker
                            key={`${city.city}-${index}`}
                            center={[city.lat, city.lon]}
                            radius={radius}
                            pathOptions={{
                                fillColor: colors.fill,
                                fillOpacity: opacityScale(city.count),
                                color: colors.stroke,
                                weight: 2,
                                opacity: 1
                            }}
                        >
                            <Tooltip
                                direction="top"
                                offset={[0, -radius]}
                                opacity={0.95}
                                className="custom-tooltip"
                            >
                                <div className="text-center">
                                    <div className="font-bold text-gray-900">{city.city}</div>
                                    <div className="text-gray-600 text-sm">{city.region}</div>
                                    <div className="font-bold text-cyan-600 mt-1">{city.count} visitors</div>
                                </div>
                            </Tooltip>
                        </CircleMarker>
                    );
                })}
            </MapContainer>

            {/* Modern Legend Overlay */}
            <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-md rounded-xl px-4 py-3 border border-cyan-500/30 shadow-xl z-[1000]">
                <div className="text-xs font-semibold text-cyan-400 mb-3 uppercase tracking-wider">Visitor Density</div>
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)]"></div>
                        <span className="text-gray-300 text-xs">Low Traffic</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"></div>
                        <span className="text-gray-300 text-xs">Medium Traffic</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]"></div>
                        <span className="text-gray-300 text-xs">High Traffic</span>
                    </div>
                </div>
            </div>

            {/* Title overlay */}
            <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur-md rounded-lg px-3 py-2 border border-blue-500/30 z-[1000]">
                <div className="text-cyan-400 font-bold text-sm flex items-center gap-2">
                    <span>🇮🇳</span>
                    <span>INDIA</span>
                </div>
                <div className="text-gray-400 text-xs">{cityData.length} cities mapped</div>
            </div>
        </div>
    );
});

IndiaMap.displayName = "IndiaMap";

export default IndiaMap;
