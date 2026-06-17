import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Share, 
  Download, 
  X, 
  Maximize2, 
  MoreHorizontal,
  FileText,
  FileType,
  File,
  CloudUpload,
  Check,
  Copy
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

interface ResultViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  recipient?: string;
  sender?: string;
  date?: string;
  content: string;
}

function parseMarkdownContent(content: string) {
  const lines = content.split('\n');
  const sections: { type: 'heading' | 'paragraph' | 'list'; level?: number; text: string }[] = [];
  
  lines.forEach(line => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      sections.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2]
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      sections.push({
        type: 'list',
        text: line.substring(2)
      });
    } else if (line.trim()) {
      sections.push({
        type: 'paragraph',
        text: line
      });
    }
  });
  
  return sections;
}

function RenderContent({ content }: { content: string }) {
  const sections = parseMarkdownContent(content);
  
  const renderHeading = (level: number, text: string, key: number) => {
    const baseClass = "text-[#1f334d]";
    switch (level) {
      case 1: return <h1 key={key} data-testid={`heading-h1-${key}`} className={`${baseClass} text-2xl font-bold mb-4 mt-6`}>{text}</h1>;
      case 2: return <h2 key={key} data-testid={`heading-h2-${key}`} className={`${baseClass} text-xl font-semibold mb-3 mt-5`}>{text}</h2>;
      case 3: return <h3 key={key} data-testid={`heading-h3-${key}`} className={`${baseClass} text-lg font-semibold mb-2 mt-4`}>{text}</h3>;
      case 4: return <h4 key={key} data-testid={`heading-h4-${key}`} className={`${baseClass} text-base font-medium mb-2 mt-3`}>{text}</h4>;
      default: return <h5 key={key} data-testid={`heading-h5-${key}`} className={`${baseClass} text-sm font-medium mb-1 mt-2`}>{text}</h5>;
    }
  };
  
  const elements: React.ReactNode[] = [];
  let currentListItems: { text: string; idx: number }[] = [];
  
  const flushList = () => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`list-${currentListItems[0].idx}`} className="list-disc ml-6 mb-3" data-testid={`list-${currentListItems[0].idx}`}>
          {currentListItems.map(item => (
            <li key={item.idx} data-testid={`list-item-${item.idx}`} className="mb-1 text-[#1f334d] leading-relaxed">
              {item.text}
            </li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };
  
  sections.forEach((section, idx) => {
    if (section.type === 'list') {
      currentListItems.push({ text: section.text, idx });
    } else {
      flushList();
      if (section.type === 'heading') {
        elements.push(renderHeading(section.level || 1, section.text, idx));
      } else {
        elements.push(
          <p key={idx} data-testid={`paragraph-${idx}`} className="mb-3 text-[#1f334d] leading-relaxed">
            {section.text}
          </p>
        );
      }
    }
  });
  flushList();
  
  return (
    <div className="prose prose-sm max-w-none text-[#1f334d]" data-testid="render-content">
      {elements}
    </div>
  );
}

export function ResultViewer({ 
  isOpen, 
  onClose, 
  title, 
  recipient, 
  sender, 
  date,
  content 
}: ResultViewerProps) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentDate = date || new Date().toLocaleDateString('pt-BR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const exportToMarkdown = () => {
    let md = `# ${title}\n\n`;
    if (recipient) md += `**Para:** ${recipient}\n\n`;
    if (sender) md += `**De:** ${sender}\n\n`;
    md += `**Data:** ${currentDate}\n\n---\n\n`;
    md += content;
    
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `${title.replace(/\s+/g, '-').toLowerCase()}.md`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let currentY = 20;

    doc.setFontSize(18);
    doc.setTextColor(31, 51, 77);
    const titleLines = doc.splitTextToSize(title, maxWidth);
    doc.text(titleLines, margin, currentY);
    currentY += titleLines.length * 8 + 10;

    doc.setFontSize(10);
    doc.setTextColor(90, 108, 125);
    if (recipient) {
      doc.text(`Para: ${recipient}`, margin, currentY);
      currentY += 6;
    }
    if (sender) {
      doc.text(`De: ${sender}`, margin, currentY);
      currentY += 6;
    }
    doc.text(`Data: ${currentDate}`, margin, currentY);
    currentY += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    doc.setFontSize(11);
    doc.setTextColor(31, 51, 77);
    const cleanContent = content.replace(/^#{1,6}\s+/gm, '');
    const contentLines = doc.splitTextToSize(cleanContent, maxWidth);
    
    contentLines.forEach((line: string) => {
      if (currentY > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        currentY = margin;
      }
      doc.text(line, margin, currentY);
      currentY += 6;
    });

    doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const exportToDocx = async () => {
    const paragraphs = [];

    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36 })],
        heading: HeadingLevel.HEADING_1,
      })
    );

    paragraphs.push(new Paragraph({ children: [] }));

    if (recipient) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Para: ", bold: true }),
            new TextRun({ text: recipient })
          ]
        })
      );
    }
    if (sender) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "De: ", bold: true }),
            new TextRun({ text: sender })
          ]
        })
      );
    }
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Data: ", bold: true }),
          new TextRun({ text: currentDate })
        ]
      })
    );

    paragraphs.push(new Paragraph({ children: [] }));

    const sections = parseMarkdownContent(content);
    sections.forEach(section => {
      if (section.type === 'heading') {
        const level = section.level || 3;
        const getHeadingLevel = (l: number) => {
          if (l === 1) return HeadingLevel.HEADING_1;
          if (l === 2) return HeadingLevel.HEADING_2;
          return HeadingLevel.HEADING_3;
        };
        
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: section.text, bold: true })],
            heading: getHeadingLevel(level),
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: section.text })]
          })
        );
      }
    });

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title.replace(/\s+/g, '-').toLowerCase()}.docx`);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 bg-white">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-medium text-[#1f334d]" data-testid="result-viewer-title">
                {title}
              </DialogTitle>
              <p className="text-xs text-gray-500">Última modificação: Há pouco</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={copyToClipboard}
              className="h-8 w-8"
              title="Copiar"
              data-testid="button-copy-content"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-export-menu">
                  <Download className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={exportToMarkdown} data-testid="export-markdown">
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF} data-testid="export-pdf">
                  <File className="w-4 h-4 mr-2 text-red-600" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToDocx} data-testid="export-docx">
                  <FileType className="w-4 h-4 mr-2 text-blue-700" />
                  Docx
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400" data-testid="export-google-drive">
                  <CloudUpload className="w-4 h-4 mr-2" />
                  Salvar no Google Drive
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400" data-testid="export-onedrive-personal">
                  <CloudUpload className="w-4 h-4 mr-2" />
                  Salvar no OneDrive (pessoal)
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="text-gray-400" data-testid="export-onedrive-work">
                  <CloudUpload className="w-4 h-4 mr-2" />
                  Salvar no OneDrive (trabalho/escola)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Maximizar" data-testid="button-maximize">
              <Maximize2 className="w-4 h-4" />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-close-viewer">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-80px)]">
          <div ref={contentRef} className="px-12 py-8 bg-white min-h-[500px]">
            {(recipient || sender) && (
              <div className="mb-6 text-sm text-gray-600 space-y-1" data-testid="document-metadata">
                {recipient && <p data-testid="text-recipient"><strong>Para:</strong> {recipient}</p>}
                {sender && <p data-testid="text-sender"><strong>De:</strong> {sender}</p>}
                <p data-testid="text-date"><strong>Data:</strong> {currentDate}</p>
              </div>
            )}
            
            <div className="border-b border-gray-200 mb-6" />

            <RenderContent content={content} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default ResultViewer;
