import { useState } from 'react';
import '../styles/JsonViewer.css';

export function JsonViewer({ data, title = 'JSON Output' }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpanded = (path) => {
    setExpanded(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const renderValue = (value, path = '') => {
    if (value === null) {
      return <span className="json-null">null</span>;
    }

    if (value === undefined) {
      return <span className="json-undefined">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="json-boolean">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="json-number">{value}</span>;
    }

    if (typeof value === 'string') {
      return <span className="json-string">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="json-bracket">[]</span>;
      }

      const isExpanded = expanded[path];
      const isSimpleArray = value.every(v => typeof v !== 'object' || v === null);

      if (isSimpleArray && value.length <= 3) {
        return (
          <span className="json-array-inline">
            [
            {value.map((item, i) => (
              <span key={i}>
                {renderValue(item, `${path}[${i}]`)}
                {i < value.length - 1 ? ', ' : ''}
              </span>
            ))}
            ]
          </span>
        );
      }

      return (
        <div className="json-array">
          <span
            className="json-bracket json-expandable"
            onClick={() => toggleExpanded(path)}
          >
            {isExpanded ? '▼' : '▶'} [{value.length}]
          </span>
          {isExpanded && (
            <div className="json-array-content">
              {value.map((item, i) => (
                <div key={i} className="json-array-item">
                  <span className="json-index">[{i}]:</span>
                  {renderValue(item, `${path}[${i}]`)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className="json-bracket">{'{}'}</span>;
      }

      const isExpanded = expanded[path];

      return (
        <div className="json-object">
          <span
            className="json-bracket json-expandable"
            onClick={() => toggleExpanded(path)}
          >
            {isExpanded ? '▼' : '▶'} {'{'}...{'}'}
          </span>
          {isExpanded && (
            <div className="json-object-content">
              {keys.map((key, i) => (
                <div key={i} className="json-object-property">
                  <span className="json-key">"{key}"</span>
                  <span className="json-colon">:</span>
                  {renderValue(value[key], `${path}.${key}`)}
                  {i < keys.length - 1 && <span className="json-comma">,</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="json-viewer">
      <div className="json-viewer-header">
        <h3>{title}</h3>
        <button 
          className="json-copy-btn"
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
          }}
          title="Copy JSON to clipboard"
        >
          📋 Copy
        </button>
      </div>
      <div className="json-content">
        {renderValue(data)}
      </div>
    </div>
  );
}
