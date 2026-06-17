import BpmnDiagram from '../components/BpmnDiagram';
import { BrowserFrame } from "@/components/Browser/BrowserFrame";

export default function BpmnPage() {
  return (
    <BrowserFrame>
      <div className="h-[calc(100vh-120px)]">
        <BpmnDiagram processName="Diagrama BPMN" />
      </div>
    </BrowserFrame>
  );
}
