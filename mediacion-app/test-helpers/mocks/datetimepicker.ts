const React = require('react');
const { View } = require('react-native');

const DateTimePicker = (props: Record<string, unknown>) =>
  React.createElement(View, { ...props, testID: 'datetimepicker-mock' });

module.exports = {
  __esModule: true,
  default: DateTimePicker,
};
