const fs = require('fs');

let content = fs.readFileSync('src/components/AnalyticsScreen.tsx', 'utf8');
content = content.replace("import html2canvas from 'html2canvas';", "import { toPng } from 'html-to-image';");

const oldCode = `  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#f8fafc' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.setFontSize(16);
      pdf.text('Relatório Financeiro', 15, 15);
      pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
      pdf.save('relatorio-financeiro.pdf');
    } catch (err) {
      console.error('Failed to export PDF', err);
    }
  };`;

const newCode = `  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { backgroundColor: '#f8fafc', cacheBust: true });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      pdf.setFontSize(16);
      pdf.text('Relatório Financeiro', 15, 15);
      pdf.addImage(dataUrl, 'PNG', 0, 25, pdfWidth, pdfHeight);
      pdf.save('relatorio-financeiro.pdf');
    } catch (err) {
      console.error('Failed to export PDF', err);
    }
  };`;

content = content.replace(oldCode, newCode);
fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
