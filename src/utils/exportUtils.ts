import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPDF = (title: string, headers: string[], data: any[][], fileName: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generato il: ${new Date().toLocaleString()}`, 14, 30);

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 35,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] }, // emerald-600
    styles: { fontSize: 9 },
  });

  doc.save(`${fileName}.pdf`);
};
