"use client";

import { useEffect, useRef } from "react";
import type * as L from "leaflet";
import { money } from "@/lib/parse";

export type MapPin = {
  id: number;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  price?: number;
  href?: string;
  status?: string;
};

const STATUS_COLOR: Record<string, string> = {
  watching: "#0ea5e9",
  touring: "#8b5cf6",
  offer: "#10b981",
  dead: "#71717a",
};

/** Escape anything going into popup HTML — nicknames and notes are user input. */
function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function PropertyMap({
  pins,
  height = "24rem",
  zoom = 14,
}: {
  pins: MapPin[];
  height?: string;
  zoom?: number;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!nodeRef.current || pins.length === 0) return;
    let cancelled = false;

    // Leaflet touches window on import, so it can only load client-side.
    import("leaflet").then((leaflet) => {
      if (cancelled || !nodeRef.current || mapRef.current) return;

      const map = leaflet.map(nodeRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // Required by the OSM tile usage policy.
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      const markers = pins.map((p) => {
        const color = STATUS_COLOR[p.status ?? "watching"] ?? STATUS_COLOR.watching;
        // divIcon rather than the default marker: no image assets to break
        // under the bundler, and it can carry the status colour.
        const icon = leaflet.divIcon({
          className: "",
          html: `<span style="display:block;width:1.25rem;height:1.25rem;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -12],
        });

        const marker = leaflet.marker([p.lat, p.lng], { icon, title: p.label }).addTo(map);

        const lines = [
          `<strong>${esc(p.label)}</strong>`,
          p.sublabel ? esc(p.sublabel) : null,
          p.price ? money(p.price) : null,
          p.href ? `<a href="${esc(p.href)}">Open</a>` : null,
        ].filter(Boolean);
        marker.bindPopup(lines.join("<br>"));
        return marker;
      });

      if (pins.length === 1) {
        map.setView([pins[0].lat, pins[0].lng], zoom);
      } else {
        map.fitBounds(leaflet.featureGroup(markers).getBounds().pad(0.2));
      }

      // The container is often laid out after the map initialises (inside a
      // tab panel, for instance), which leaves Leaflet with a stale size.
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pins, zoom]);

  if (pins.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing to map yet — a property needs a geocoded address to get a pin.
      </p>
    );
  }

  return (
    <div
      ref={nodeRef}
      style={{ height }}
      // Tiles are a light basemap; invert them in dark mode rather than pulling
      // in a second tile provider just for a dark style.
      className="border-border z-0 w-full rounded-md border [&_.leaflet-tile-pane]:dark:brightness-90 [&_.leaflet-tile-pane]:dark:contrast-90 [&_.leaflet-tile-pane]:dark:hue-rotate-180 [&_.leaflet-tile-pane]:dark:invert"
      role="application"
      aria-label={`Map of ${pins.length} propert${pins.length === 1 ? "y" : "ies"}`}
    />
  );
}
