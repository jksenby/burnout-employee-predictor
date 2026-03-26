import React from 'react';

const MetricRow = ({ name, value }) => (
  <div className="metric-row">
    <span className="metric-name">{name}</span>
    <span className="metric-value">{value}</span>
  </div>
);

export default MetricRow;
