// Mock for lucide-react-native — returns empty React elements to avoid
// ESM transform issues in Jest.
import React from 'react';
import { View } from 'react-native';

const handler = {
  get(_target: unknown, prop: string) {
    if (prop === '__esModule') return true;
    return (props: Record<string, unknown>) =>
      React.createElement(View, { ...props, testID: `lucide-${prop}` });
  },
};

module.exports = new Proxy({}, handler);
