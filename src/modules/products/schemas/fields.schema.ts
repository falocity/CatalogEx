import Type from "typebox";

export const ProductIdSchema = Type.String({
  format: "uuid",
});

export const ProductNameSchema = Type.String({
  minLength: 1,
  maxLength: 48,
});

export const ProductDescriptionSchema = Type.String({
  minLength: 1,
});

const LongitudeSchema = Type.Number({
  minimum: -180,
  maximum: 180,
});

const LatitudeSchema = Type.Number({
  minimum: -90,
  maximum: 90,
});

const AltitudeSchema = Type.Number();

const PositionSchema = Type.Union([
  Type.Tuple([LongitudeSchema, LatitudeSchema]),
  Type.Tuple([LongitudeSchema, LatitudeSchema, AltitudeSchema]),
]);

const LinearRingSchema = Type.Array(PositionSchema, {
  minItems: 4,
});

const PolygonCoordinatesSchema = Type.Array(LinearRingSchema, {
  minItems: 1,
});

const PolygonSchema = Type.Object({
  type: Type.Literal("Polygon"),
  coordinates: PolygonCoordinatesSchema,
});

const MultiPolygonSchema = Type.Object({
  type: Type.Literal("MultiPolygon"),
  coordinates: Type.Array(PolygonCoordinatesSchema, {
    minItems: 1,
  }),
});

export const BoundingPolygonSchema = Type.Union(
  [PolygonSchema, MultiPolygonSchema],
  {
    description:
      "GeoJSON Polygon or MultiPolygon using WGS84 longitude and latitude, with optional ellipsoidal height in metres.",
  },
);

export type BoundingPolygon = Type.Static<typeof BoundingPolygonSchema>;

export const ConsumptionLinkSchema = Type.String({
  format: "uri",
});

export const ProductTypeSchema = Type.Union([
  Type.Literal("raster"),
  Type.Literal("rasterized vector"),
  Type.Literal("3d tiles"),
  Type.Literal("QMesh"),
]);

export type ProductType = Type.Static<typeof ProductTypeSchema>;

export const ConsumptionProtocolSchema = Type.Union([
  Type.Literal("WMS"),
  Type.Literal("WMTS"),
  Type.Literal("XYZ"),
  Type.Literal("3D Tiles"),
]);

export type ConsumptionProtocol = Type.Static<typeof ConsumptionProtocolSchema>;

export const ResolutionBestSchema = Type.Number({
  minimum: 0,
});

export const MinZoom = Type.Integer({
  minimum: 0,
});

export const MaxZoom = Type.Integer({
  exclusiveMinimum: 0,
});
