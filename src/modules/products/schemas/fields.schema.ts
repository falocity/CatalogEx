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

// export const BoundingPolygonSchema = Type.geojson;

export const ConsumtionLinkSchema = Type.String({
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
  Minimum: 0,
});

export const MinZoom = Type.Integer({
  exclusiveMinimum: 0,
});

export const MaxZoom = Type.Integer({
  exclusiveMinimum: 0,
});
