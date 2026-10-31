# Halloween Router

A buildless website with live place search, an interactive map, reviewed location matches, driving-time optimization, manual ordering, and mobile-safe Google Maps direction links.

## Run

Requires Python 3 and a browser. Run `npm start` (or `python3 -m http.server 4173 --directory dist`) in this folder, then open http://127.0.0.1:4173. Requires an internet connection; no API keys or package installation required.

## Use

1. Enter country, region, nearby city, optional starting address, and up to 20 places (one per line).
2. Select **Find my places**. Review each candidate’s actual name and city. View its marker, select an alternate, or refine its full search query.
3. Confirm each match or deliberately accept a clearly labeled alternative. Remove missing stops if needed. A nickname such as Coco House may be absent from map data.
4. Map the current order or optimize it. The first location is fixed; an optional starting address becomes that first location. Without one, the first stop is the start. The final stop is free and there is no return trip.
5. Use arrow buttons to reorder, then map the new order. Open Google Maps parts in sequence.

The sample separates Presidio Terrace and Presidio Heights, so both can be visited. It uses Tait Avenue as the street within Almond Grove. Roads and neighborhoods are representative points, never verified entrances. Refine to a street number or intersection for a precise destination. Name differences are prominently flagged; nothing is automatically accepted.

## Providers and limitations

- [Photon](https://photon.komoot.io/) provides OpenStreetMap search, with nearby-city position bias. Country/state/city text guides search, but does not guarantee a geographic match; every result requires review. Explicit city qualifiers are preserved. Selected Bay Area city suffixes and `City: Place` sample patterns are normalized.
- Searches are sequential, at most one per 1.1 seconds, and cached locally for seven days. No background/autocomplete queries. Only search results are persisted; itineraries reset on reload. Do not enter confidential addresses on shared computers. Clear website data to remove search cache.
- [OSRM](https://project-osrm.org/) provides driving-time matrices and road geometry. Through 15 total locations, a directed Held–Karp solver finds the minimum-time open path with a fixed start. Larger plans use nearest neighbor plus directed-cost 2-opt and are labeled as heuristic. Unreachable matrix entries stop optimization rather than being treated as zero.
- Services are public demo endpoints with no availability guarantee, traffic, current closures, parking, or time spent at stops. For sustained/multiuser usage, replace demo endpoints with dedicated providers in `dist/config.js`.
- Leaflet and fonts load from external CDNs; tiles from OpenStreetMap. Search text goes to Photon, route coordinates to OSRM, tiles to OpenStreetMap. Google receives coordinates when a directions link is opened.
- Google links have at most three intermediate waypoints per part, with shared endpoints and all legs retained, per [Google’s Maps URL documentation](https://developers.google.com/maps/documentation/urls/get-started). Google may choose a different road route.
- If routing fails, reviewed locations remain available for retry. Edits invalidate old geometry, statistics, and directions links.

## Tests

Run `npm test` with Node 20+. Tests compare the exact optimizer to brute-force solutions on directed matrices, verify unreachable pairs, exercise larger heuristic plans, check freeform parsing and approximate point classification, and verify all Google Maps legs across split sizes.

## Deploy to Vercel

Import `dakshaladia/plan-router` into Vercel and deploy from the repository root. The included `vercel.json` selects the Other framework preset, skips installation/building, and serves `dist/`. No environment variables are required for the current demo providers.

Source is in `dist/`; the folder contains the actual site assets and is intentionally tracked. Mouse-wheel and trackpad zoom are enabled over the map.
