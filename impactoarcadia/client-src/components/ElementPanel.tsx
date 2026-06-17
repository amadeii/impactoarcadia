import React from 'react';

const ElementPanel: React.FC = () => {
  return (
    <div data-testid="element-panel" className="border p-4 flex flex-col">
      <h2 className="font-bold text-lg">Elementos BPMN</h2>
      <p className="text-sm text-muted-foreground">Use o diagramador integrado no Process Compass.</p>
    </div>
  );
};

export default ElementPanel;
