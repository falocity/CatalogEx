import typebox from 'typebox';
import { PRODUCT_NAME_MAX_LENGTH } from '../../../common/constants.js';

const productIdSchema = typebox.String({
  format: 'uuid',
});

const productNameSchema = typebox.String({
  minLength: 1,
  maxLength: PRODUCT_NAME_MAX_LENGTH,
});

const productDescriptionSchema = typebox.String({
  minLength: 1,
});

const longitudeSchema = typebox.Number({
  minimum: -180,
  maximum: 180,
});

const latitudeSchema = typebox.Number({
  minimum: -90,
  maximum: 90,
});

const altitudeSchema = typebox.Number();

const positionSchema = typebox.Union([
  typebox.Tuple([longitudeSchema, latitudeSchema]),
  typebox.Tuple([longitudeSchema, latitudeSchema, altitudeSchema]),
]);

const linearRingSchema = typebox.Array(positionSchema, {
  minItems: 4,
});

const polygonCoordinatesSchema = typebox.Array(linearRingSchema, {
  minItems: 1,
});

const polygonSchema = typebox.Object(
  {
    type: typebox.Literal('Polygon'),
    coordinates: polygonCoordinatesSchema,
  },
  { additionalProperties: false }
);

const multiPolygonSchema = typebox.Object(
  {
    type: typebox.Literal('MultiPolygon'),
    coordinates: typebox.Array(polygonCoordinatesSchema, {
      minItems: 1,
    }),
  },
  { additionalProperties: false }
);

const boundingPolygonSchema = typebox.Union([polygonSchema, multiPolygonSchema], {
  description: 'GeoJSON Polygon or MultiPolygon using WGS84 longitude and latitude, with optional ellipsoidal height in metres.',
});

type BoundingPolygon = typebox.Static<typeof boundingPolygonSchema>;

const consumptionLinkSchema = typebox.String({
  format: 'uri',
});

const productTypeSchema = typebox.Union([
  typebox.Literal('raster'),
  typebox.Literal('rasterized vector'),
  typebox.Literal('3d tiles'),
  typebox.Literal('QMesh'),
]);

type ProductType = typebox.Static<typeof productTypeSchema>;

const consumptionProtocolSchema = typebox.Union([
  typebox.Literal('WMS'),
  typebox.Literal('WMTS'),
  typebox.Literal('XYZ'),
  typebox.Literal('3D Tiles'),
]);

type ConsumptionProtocol = typebox.Static<typeof consumptionProtocolSchema>;

const resolutionBestSchema = typebox.Number({
  minimum: 0,
});

const minZoom = typebox.Integer({
  minimum: 0,
});

const maxZoom = typebox.Integer({
  exclusiveMinimum: 0,
});

export {
  productIdSchema,
  productNameSchema,
  productDescriptionSchema,
  boundingPolygonSchema,
  consumptionLinkSchema,
  productTypeSchema,
  consumptionProtocolSchema,
  resolutionBestSchema,
  minZoom,
  maxZoom,
};
export type { BoundingPolygon, ProductType, ConsumptionProtocol };
