// src/components/impression/ExportManager.jsx

import React from 'react'
import { Button, Space, message } from 'antd'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
// Ajout pour PDF et Word
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx'

// 1) Composant pour gérer l'exportation des données
function ExportManager({ data, fileName }) {
  // 2) Fonction pour exporter les données au format Excel
  const exportToExcel = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const file = new Blob([excelBuffer], { type: 'application/octet-stream' })
      saveAs(file, `${fileName}.xlsx`)
    } catch (e) {
      message.error("Erreur export Excel")
    }
  }

  // CSV
  const exportToCSV = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data)
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      const file = new Blob([csv], { type: 'text/csv' })
      saveAs(file, `${fileName}.csv`)
    } catch (e) {
      message.error("Erreur export CSV")
    }
  }

  // JSON
  const exportToJSON = () => {
    try {
      const json = JSON.stringify(data, null, 2)
      const file = new Blob([json], { type: 'application/json' })
      saveAs(file, `${fileName}.json`)
    } catch (e) {
      message.error("Erreur export JSON")
    }
  }

  // PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF()
      if (data.length > 0) {
        const columns = Object.keys(data[0])
        const rows = data.map(row => columns.map(col => row[col]))
        doc.autoTable({ head: [columns], body: rows })
      }
      doc.save(`${fileName}.pdf`)
    } catch (e) {
      message.error("Erreur export PDF")
    }
  }

  // Word (.docx)
  const exportToWord = async () => {
    try {
      if (!data.length) return
      const columns = Object.keys(data[0])
      const tableRows = [
        new TableRow({
          children: columns.map(col => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: col, bold: true })] })] }))
        }),
        ...data.map(row =>
          new TableRow({
            children: columns.map(col =>
              new TableCell({ children: [new Paragraph(String(row[col] ?? ""))] })
            )
          })
        )
      ]
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({ text: fileName, heading: "Heading1" }),
              new Table({ rows: tableRows })
            ]
          }
        ]
      })
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `${fileName}.docx`)
    } catch (e) {
      message.error("Erreur export Word")
    }
  }

  return (
    <Space>
      <Button onClick={exportToExcel} type='primary'>Excel (.xlsx)</Button>
      <Button onClick={exportToCSV}>CSV (.csv)</Button>
      <Button onClick={exportToJSON}>JSON (.json)</Button>
      <Button onClick={exportToPDF}>PDF (.pdf)</Button>
      <Button onClick={exportToWord}>Word (.docx)</Button>
    </Space>
  )
}

export default ExportManager