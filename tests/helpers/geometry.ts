import type { BoundingPolygon } from "../../src/modules/products/schemas/fields.schema.js";

export function rectangle(
  left: number,
  bottom: number,
  right: number,
  top: number,
): Extract<BoundingPolygon, { type: "Polygon" }> {
  return {
    type: "Polygon",
    coordinates: [
      [
        [left, bottom],
        [right, bottom],
        [right, top],
        [left, top],
        [left, bottom],
      ],
    ],
  };
}

const polygonXY = rectangle(34, 32, 35, 33);

const polygonXYZ = {
  type: "Polygon",
  coordinates: polygonXY.coordinates.map((ring) =>
    ring.map(([longitude, latitude]): [number, number, number] => [
      longitude,
      latitude,
      25,
    ]),
  ),
} satisfies BoundingPolygon;

export const validFootprints: { name: string; geometry: BoundingPolygon }[] = [
  { name: "Polygon XY", geometry: polygonXY },
  { name: "Polygon XYZ", geometry: polygonXYZ },
  {
    name: "MultiPolygon XY",
    geometry: { type: "MultiPolygon", coordinates: [polygonXY.coordinates] },
  },
  {
    name: "MultiPolygon XYZ",
    geometry: { type: "MultiPolygon", coordinates: [polygonXYZ.coordinates] },
  },
];
