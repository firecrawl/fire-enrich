'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { CSVRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { FIRE_ENRICH_CONFIG, ERROR_MESSAGES } from './config';

interface CSVUploaderProps {
  onUpload: (rows: CSVRow[], columns: string[]) => void;
}

export function CSVUploader({ onUpload }: CSVUploaderProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processCSV = useCallback((file: File) => {
    setIsProcessing(true);
    setError(null);

    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          setIsProcessing(false);
          return;
        }

        if (!results.data || results.data.length === 0) {
          setError('CSV file is empty');
          setIsProcessing(false);
          return;
        }

        // Get headers from first row
        const headers = Object.keys(results.data[0] as object);
        const rows = results.data as CSVRow[];

        // Check column limit
        if (headers.length > FIRE_ENRICH_CONFIG.CSV_LIMITS.MAX_COLUMNS) {
          setError(
            `${ERROR_MESSAGES.TOO_MANY_COLUMNS}\n${ERROR_MESSAGES.UPGRADE_PROMPT}`
          );
          setIsProcessing(false);
          return;
        }

        // Filter out empty rows
        const validRows = rows.filter(row =>
          Object.values(row).some(value => value && String(value).trim() !== '')
        );

        if (validRows.length === 0) {
          setError('No valid data rows found in CSV');
          setIsProcessing(false);
          return;
        }

        // Check row limit
        if (validRows.length > FIRE_ENRICH_CONFIG.CSV_LIMITS.MAX_ROWS) {
          setError(
            `${ERROR_MESSAGES.TOO_MANY_ROWS}\n${ERROR_MESSAGES.UPGRADE_PROMPT}`
          );
          setIsProcessing(false);
          return;
        }

        setIsProcessing(false);
        onUpload(validRows, headers);
      },
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    });
  }, [onUpload]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processCSV(acceptedFiles[0]);
    }
  }, [processCSV]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-1">Upload Your CSV File</h2>
        <p className="text-sm text-muted-foreground">
          Start by uploading a CSV file containing email addresses
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-300 ease-out
          ${isDragActive
            ? 'border-orange-500 bg-orange-50 scale-[1.02] shadow-xl dark:border-orange-400'
            : 'border-zinc-300 hover:border-orange-400 bg-white hover:shadow-lg hover:scale-[1.01]'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} disabled={isProcessing} />

        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, #f97316 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative">
          <div className={`
            w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center
            transition-all duration-300
            ${isDragActive ? 'bg-orange-500' : 'bg-orange-600'}
          `}>
            <FileSpreadsheet className="w-8 h-8 text-white" />
          </div>

          {isDragActive ? (
            <div className="animate-fade-in">
              <p className="text-xl font-semibold text-orange-600 mb-1">Drop it here!</p>
              <p className="text-sm text-muted-foreground">We&apos;ll start processing immediately</p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium text-graphite mb-1">
                Drag & drop your CSV file here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse from your computer
              </p>
              <Button
                variant="orange"
                size="sm"
                disabled={isProcessing}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select CSV File
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl animate-fade-in dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400">
          <p className="font-semibold mb-1">Error:</p>
          <p className="text-sm whitespace-pre-line">{error}</p>
        </div>
      )}

      {isProcessing && (
        <div className="mt-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-orange-100 rounded-full">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <p className="text-sm font-medium text-orange-700">Processing CSV file...</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <a
          href="/sample-data.csv"
          download="sample-data.csv"
          className="block p-3 rounded-lg hover:rounded-none border border-zinc-200 hover:bg-zinc-100 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-graphite">Download Sample</h3>
          </div>
          <p className="text-xs text-muted-foreground">Try our sample CSV file</p>
        </a>

        <div className="p-3 bg-zinc-100 rounded-lg border border-zinc-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-graphite rounded flex items-center justify-center dark:bg-zinc-700">
              <span className="text-white text-xs font-bold">@</span>
            </div>
            <h3 className="text-sm font-medium text-graphite">Email Required</h3>
          </div>
          <p className="text-xs text-muted-foreground">Must contain email addresses</p>
        </div>

        <div className="p-3 bg-zinc-100 rounded-lg border border-zinc-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-graphite rounded flex items-center justify-center dark:bg-zinc-700">
              <span className="text-white text-xs font-bold">
                {FIRE_ENRICH_CONFIG.FEATURES.IS_UNLIMITED ? '∞' : FIRE_ENRICH_CONFIG.CSV_LIMITS.MAX_ROWS}
              </span>
            </div>
            <h3 className="text-sm font-medium text-graphite ">
              {FIRE_ENRICH_CONFIG.FEATURES.IS_UNLIMITED ? 'Unlimited Mode' : 'Row Limit'}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {FIRE_ENRICH_CONFIG.FEATURES.IS_UNLIMITED
              ? 'Unlimited rows and columns'
              : (
                <>
                  Demo version limited to {FIRE_ENRICH_CONFIG.CSV_LIMITS.MAX_ROWS} rows and {FIRE_ENRICH_CONFIG.CSV_LIMITS.MAX_COLUMNS} columns
                  <br />
                  <span className="text-[10px] opacity-80">(Unlimited when self-hosted)</span>
                </>
              )
            }
          </p>
        </div>
      </div>
    </div>
  );
}