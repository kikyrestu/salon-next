"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileDown,
  FileUp,
  Package,
  Users,
  Tag,
  Truck,
  DollarSign,
  Gift,
  FileText,
  UserCircle,
  Scissors,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Entity config                                                      */
/* ------------------------------------------------------------------ */

interface EntityConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  importable: boolean;
  exportable: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
}

const ENTITIES: EntityConfig[] = [
  { key: "services", label: "Services", icon: Scissors, importable: true, exportable: true, color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  { key: "products", label: "Products", icon: Package, importable: true, exportable: true, color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
  { key: "customers", label: "Customers", icon: Users, importable: true, exportable: true, color: "text-violet-700", bgColor: "bg-violet-50", borderColor: "border-violet-200" },
  { key: "staff", label: "Staff", icon: UserCircle, importable: true, exportable: true, color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  { key: "suppliers", label: "Suppliers", icon: Truck, importable: true, exportable: true, color: "text-cyan-700", bgColor: "bg-cyan-50", borderColor: "border-cyan-200" },
  { key: "service-categories", label: "Service Categories", icon: Tag, importable: true, exportable: true, color: "text-pink-700", bgColor: "bg-pink-50", borderColor: "border-pink-200" },
  { key: "expenses", label: "Expenses", icon: DollarSign, importable: true, exportable: true, color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
  { key: "vouchers", label: "Vouchers", icon: Gift, importable: true, exportable: true, color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  { key: "invoices", label: "Invoices / Sales", icon: FileText, importable: false, exportable: true, color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-200" },
];

/* ------------------------------------------------------------------ */
/*  Import result type                                                 */
/* ------------------------------------------------------------------ */

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  totalRows: number;
  errors: { row: number; errors: string[] }[];
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ImportExportPage() {
  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ────── Template download ────── */
  const downloadTemplate = useCallback(async (entity: string) => {
    try {
      const res = await fetch(`/api/import/template/${entity}`);
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_${entity}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download template");
    }
  }, []);

  /* ────── Export download ────── */
  const handleExport = useCallback(async (entity: string) => {
    setExporting(entity);
    try {
      const res = await fetch(`/api/export/${entity}`);
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${entity}_${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to export data");
    } finally {
      setExporting(null);
    }
  }, []);

  /* ────── File import ────── */
  const handleImport = useCallback(async (file: File, entity: string) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/import/${entity}`, {
        method: "POST",
        body: formData,
      });
      const data: ImportResult = await res.json();
      setImportResult(data);
    } catch (err: any) {
      setImportResult({
        success: false,
        imported: 0,
        failed: 0,
        totalRows: 0,
        errors: [],
        error: err.message || "Upload failed",
      });
    } finally {
      setImporting(false);
    }
  }, []);

  /* ────── Drag & Drop ────── */
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!selectedEntity) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleImport(file, selectedEntity);
    },
    [selectedEntity, handleImport]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedEntity) return;
      const file = e.target.files?.[0];
      if (file) handleImport(file, selectedEntity);
      e.target.value = "";
    },
    [selectedEntity, handleImport]
  );

  const importEntities = ENTITIES.filter((e) => e.importable);
  const exportEntities = ENTITIES;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ────── Header ────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            Import / Export Data
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 ml-[52px]">
            Bulk import data from Excel or export your data to Excel files
          </p>
        </div>

        {/* ────── Tabs ────── */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => {
              setActiveTab("import");
              setImportResult(null);
              setSelectedEntity(null);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "import"
                ? "bg-white text-blue-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => {
              setActiveTab("export");
              setImportResult(null);
              setSelectedEntity(null);
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "export"
                ? "bg-white text-blue-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* ────── IMPORT TAB ────── */}
        {activeTab === "import" && (
          <div className="space-y-6">
            {/* Step 1: Select Entity */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Select Data Type
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {importEntities.map((entity) => {
                    const Icon = entity.icon;
                    const isSelected = selectedEntity === entity.key;
                    return (
                      <button
                        key={entity.key}
                        onClick={() => {
                          setSelectedEntity(entity.key);
                          setImportResult(null);
                        }}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                          isSelected
                            ? `${entity.borderColor} ${entity.bgColor} shadow-md ring-2 ring-offset-1 ring-blue-400`
                            : "border-gray-100 hover:border-gray-200 bg-white"
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-lg ${
                            isSelected
                              ? entity.bgColor
                              : "bg-gray-50"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 ${
                              isSelected ? entity.color : "text-gray-400"
                            }`}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold text-center leading-tight ${
                            isSelected ? entity.color : "text-gray-600"
                          }`}
                        >
                          {entity.label}
                        </span>
                        {isSelected && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 2 & 3: Template + Upload (only shown when entity selected) */}
            {selectedEntity && (
              <>
                {/* Step 2: Download Template */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold">
                        2
                      </span>
                      Download Template
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">
                          Download the Excel template, fill in your data, then upload it in step 3.
                          The template includes an{" "}
                          <span className="font-semibold text-gray-800">
                            Instructions sheet
                          </span>{" "}
                          explaining each column.
                        </p>
                      </div>
                      <button
                        onClick={() => downloadTemplate(selectedEntity)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm font-semibold text-sm shrink-0"
                      >
                        <FileDown className="w-4 h-4" />
                        Download Template
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3: Upload File */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold">
                        3
                      </span>
                      Upload Excel File
                    </h2>
                  </div>
                  <div className="p-6">
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                        dragOver
                          ? "border-blue-400 bg-blue-50"
                          : importing
                          ? "border-gray-200 bg-gray-50 cursor-wait"
                          : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      onClick={() =>
                        !importing && fileInputRef.current?.click()
                      }
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={onFileChange}
                      />
                      {importing ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                          <p className="text-sm font-semibold text-blue-700">
                            Processing your file...
                          </p>
                          <p className="text-xs text-gray-500">
                            Validating and importing data
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-3 bg-blue-50 rounded-xl">
                            <FileUp className="w-8 h-8 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">
                              {dragOver
                                ? "Drop your file here!"
                                : "Drag & drop your Excel file here"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              or click to browse • Accepts .xlsx and .xls
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Import Result */}
                {importResult && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div
                      className={`px-6 py-4 border-b ${
                        importResult.error
                          ? "bg-red-50 border-red-100"
                          : importResult.failed > 0
                          ? "bg-amber-50 border-amber-100"
                          : "bg-green-50 border-green-100"
                      }`}
                    >
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        {importResult.error ? (
                          <>
                            <XCircle className="w-5 h-5 text-red-500" />
                            <span className="text-red-800">Import Failed</span>
                          </>
                        ) : importResult.failed > 0 ? (
                          <>
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <span className="text-amber-800">
                              Partially Imported
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-green-800">
                              Import Successful!
                            </span>
                          </>
                        )}
                      </h2>
                    </div>
                    <div className="p-6">
                      {importResult.error ? (
                        <p className="text-sm text-red-600">
                          {importResult.error}
                        </p>
                      ) : (
                        <>
                          {/* Summary Stats */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {importResult.totalRows}
                              </p>
                              <p className="text-xs text-gray-500 font-medium">
                                Total Rows
                              </p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-green-700">
                                {importResult.imported}
                              </p>
                              <p className="text-xs text-green-600 font-medium">
                                Imported
                              </p>
                            </div>
                            <div
                              className={`rounded-lg p-3 text-center ${
                                importResult.failed > 0
                                  ? "bg-red-50"
                                  : "bg-gray-50"
                              }`}
                            >
                              <p
                                className={`text-2xl font-bold ${
                                  importResult.failed > 0
                                    ? "text-red-700"
                                    : "text-gray-400"
                                }`}
                              >
                                {importResult.failed}
                              </p>
                              <p
                                className={`text-xs font-medium ${
                                  importResult.failed > 0
                                    ? "text-red-600"
                                    : "text-gray-400"
                                }`}
                              >
                                Failed
                              </p>
                            </div>
                          </div>

                          {/* Error Details */}
                          {importResult.errors.length > 0 && (
                            <div className="mt-4">
                              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                Error Details
                              </h3>
                              <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-lg border border-gray-100">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200 bg-gray-100">
                                      <th className="px-4 py-2 text-left font-semibold text-gray-600 w-20">
                                        Row
                                      </th>
                                      <th className="px-4 py-2 text-left font-semibold text-gray-600">
                                        Error
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {importResult.errors.map((err, idx) => (
                                      <tr
                                        key={idx}
                                        className="hover:bg-white transition-colors"
                                      >
                                        <td className="px-4 py-2 font-mono font-bold text-red-600">
                                          #{err.row}
                                        </td>
                                        <td className="px-4 py-2 text-gray-700">
                                          {err.errors.join("; ")}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ────── EXPORT TAB ────── */}
        {activeTab === "export" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900">
                Select data to export
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Click the export button to download data as Excel file
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {exportEntities.map((entity) => {
                const Icon = entity.icon;
                const isExporting = exporting === entity.key;
                return (
                  <div
                    key={entity.key}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${entity.bgColor}`}>
                        <Icon className={`w-4 h-4 ${entity.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {entity.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {entity.importable
                            ? "Import & Export"
                            : "Export only"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entity.importable && (
                        <button
                          onClick={() => downloadTemplate(entity.key)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          title="Download import template"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Template
                        </button>
                      )}
                      <button
                        onClick={() => handleExport(entity.key)}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-wait shadow-sm"
                      >
                        {isExporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Export
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
