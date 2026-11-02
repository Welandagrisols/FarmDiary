import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from "react-native-svg";
import COLORS from "@/constants/colors";
import { niceScaleMeters, projectToView, sides, type LngLat } from "@/lib/geo";

export interface MapPolygon {
  id: string;
  ring: LngLat[];
  label?: string;
  highlight?: boolean;
}

const letter = (index: number) => String.fromCharCode(65 + (index % 26));

export default function BoundaryMap({
  polygons,
  width,
  height = 240,
  showCorners = true,
  showSides = false,
  path,
  position,
}: {
  polygons: MapPolygon[];
  width: number;
  height?: number;
  showCorners?: boolean;
  showSides?: boolean;
  path?: LngLat[];
  position?: LngLat | null;
}) {
  const drawn = [
    ...polygons.map((polygon) => ({ id: polygon.id, ring: polygon.ring })),
    ...(path?.length ? [{ id: "__path", ring: path }] : []),
    ...(position ? [{ id: "__position", ring: [position] }] : []),
  ];
  if (drawn.length === 0 || width < 40) return <View style={{ width, height }} />;

  const { polygons: projected, metersPerPixel } = projectToView(drawn, width, height, 30);
  const byId = Object.fromEntries(projected.map((polygon) => [polygon.id, polygon.points]));
  const scaleM = niceScaleMeters(Math.max(1, (width / 3) * metersPerPixel));
  const scalePx = Math.min(width - 44, scaleM / metersPerPixel);
  const pathPoints = byId.__path;
  const positionPoint = byId.__position?.[0];

  return (
    <View style={{ width, height, backgroundColor: COLORS.primarySurface, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border }}>
      <Svg width={width} height={height}>
        {polygons.map((polygon) => {
          const points = byId[polygon.id];
          if (!points) return null;
          const coordinateString = points.map((point) => `${point.x},${point.y}`).join(" ");
          const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
          const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
          const sideLabels = showSides && polygon.ring.length >= 3 && points.length <= 12 ? sides(polygon.ring) : [];
          return (
            <G key={polygon.id}>
              <Polygon
                points={coordinateString}
                fill={COLORS.primary}
                fillOpacity={polygon.highlight ? 0.3 : 0.16}
                stroke={COLORS.primary}
                strokeWidth={polygon.highlight ? 3 : 2}
                strokeLinejoin="round"
              />
              {sideLabels.map((side) => {
                const a = points[side.from];
                const b = points[side.to];
                return (
                  <SvgText key={`${polygon.id}-side-${side.from}`} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 5} fontSize={12} fill={COLORS.textSecondary} textAnchor="middle">
                    {side.meters >= 1000 ? `${(side.meters / 1000).toFixed(2)} km` : `${side.meters.toFixed(0)} m`}
                  </SvgText>
                );
              })}
              {showCorners && points.length <= 26 ? points.map((point, index) => (
                <G key={`${polygon.id}-corner-${index}`}>
                  <Circle cx={point.x} cy={point.y} r={10} fill={COLORS.white} stroke={COLORS.primary} strokeWidth={2} />
                  <SvgText x={point.x} y={point.y + 4} fontSize={12} fontWeight="bold" fill={COLORS.primary} textAnchor="middle">
                    {letter(index)}
                  </SvgText>
                </G>
              )) : null}
              {polygon.label ? <SvgText x={centerX} y={centerY + 5} fontSize={14} fontWeight="bold" fill={COLORS.text} textAnchor="middle">{polygon.label}</SvgText> : null}
            </G>
          );
        })}
        {pathPoints ? (
          <G>
            {pathPoints.map((point, index) => index > 0 ? (
              <Line key={`path-line-${index}`} x1={pathPoints[index - 1].x} y1={pathPoints[index - 1].y} x2={point.x} y2={point.y} stroke={COLORS.primary} strokeWidth={3} />
            ) : null)}
            {pathPoints.length >= 3 ? (
              <Line x1={pathPoints[pathPoints.length - 1].x} y1={pathPoints[pathPoints.length - 1].y} x2={pathPoints[0].x} y2={pathPoints[0].y} stroke={COLORS.primary} strokeWidth={2} strokeDasharray="6,6" />
            ) : null}
            {pathPoints.length <= 26 ? pathPoints.map((point, index) => (
              <G key={`path-corner-${index}`}>
                <Circle cx={point.x} cy={point.y} r={10} fill={COLORS.white} stroke={COLORS.primary} strokeWidth={2} />
                <SvgText x={point.x} y={point.y + 4} fontSize={12} fontWeight="bold" fill={COLORS.primary} textAnchor="middle">{letter(index)}</SvgText>
              </G>
            )) : null}
          </G>
        ) : null}
        {positionPoint ? (
          <G>
            <Circle cx={positionPoint.x} cy={positionPoint.y} r={12} fill={COLORS.blue} opacity={0.25} />
            <Circle cx={positionPoint.x} cy={positionPoint.y} r={6} fill={COLORS.blue} stroke={COLORS.white} strokeWidth={2} />
          </G>
        ) : null}
        <G>
          <Polygon points={`${width - 23},10 ${width - 16},26 ${width - 30},26`} fill={COLORS.text} />
          <SvgText x={width - 23} y={41} fontSize={12} fontWeight="bold" fill={COLORS.text} textAnchor="middle">N</SvgText>
        </G>
        <G>
          <Line x1={14} y1={height - 16} x2={14 + scalePx} y2={height - 16} stroke={COLORS.text} strokeWidth={2} />
          <Line x1={14} y1={height - 21} x2={14} y2={height - 11} stroke={COLORS.text} strokeWidth={2} />
          <Line x1={14 + scalePx} y1={height - 21} x2={14 + scalePx} y2={height - 11} stroke={COLORS.text} strokeWidth={2} />
          <SvgText x={Math.min(14 + scalePx + 7, width - 42)} y={height - 11} fontSize={12} fill={COLORS.text}>
            {scaleM >= 1000 ? `${scaleM / 1000} km` : `${scaleM} m`}
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}
