// Mock for react-native-svg
const React = require('react');
const { View } = require('react-native');

const createMock = (name: string) => (props: Record<string, unknown>) =>
  React.createElement(View, { ...props, testID: `svg-${name}` });

module.exports = {
  __esModule: true,
  default: createMock('Svg'),
  Svg: createMock('Svg'),
  Circle: createMock('Circle'),
  Ellipse: createMock('Ellipse'),
  G: createMock('G'),
  Line: createMock('Line'),
  LinearGradient: createMock('LinearGradient'),
  Path: createMock('Path'),
  Polygon: createMock('Polygon'),
  Polyline: createMock('Polyline'),
  RadialGradient: createMock('RadialGradient'),
  Rect: createMock('Rect'),
  Stop: createMock('Stop'),
  Text: createMock('Text'),
  TSpan: createMock('TSpan'),
  Defs: createMock('Defs'),
  Use: createMock('Use'),
  Symbol: createMock('Symbol'),
  ClipPath: createMock('ClipPath'),
  Mask: createMock('Mask'),
  Image: createMock('Image'),
};
