"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CSVRow, EnrichmentField } from "@/lib/types";
import { detectEmailColumn, EMAIL_REGEX } from "@/lib/utils/email-detection";
import { generateVariableName } from "@/lib/utils/field-utils";
import { X, Plus, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UnifiedEnrichmentViewProps {
  rows: CSVRow[];
  columns: string[];
  onStartEnrichment: (emailColumn: string, fields: EnrichmentField[]) => void;
}

const PRESET_FIELDS: EnrichmentField[] = [
  { name: 'companyName', displayName: 'Company Name', description: 'The name of the company', type: 'string', required: false },
  { name: 'companyDescription', displayName: 'Company Description', description: 'A brief description of what the company does', type: 'string', required: false },
  { name: 'industry', displayName: 'Industry', description: 'The primary industry the company operates in', type: 'string', required: false },
  { name: 'employeeCount', displayName: 'Employee Count', description: 'The number of employees at the company', type: 'number', required: false },
  { name: 'yearFounded', displayName: 'Year Founded', description: 'The year the company was founded', type: 'number', required: false },
  { name: 'headquarters', displayName: 'Headquarters', description: 'The location of the company headquarters', type: 'string', required: false },
  { name: 'revenue', displayName: 'Revenue', description: 'The annual revenue of the company', type: 'string', required: false },
  { name: 'fundingRaised', displayName: 'Funding Raised', description: 'Total funding raised by the company', type: 'string', required: false },
  { name: 'fundingStage', displayName: 'Funding Stage', description: 'The current funding stage (e.g., Pre-seed, Seed, Series A, Series B, Series C, Series D+, IPO)', type: 'string', required: false },
];

export function UnifiedEnrichmentView({ rows, columns, onStartEnrichment }: UnifiedEnrichmentViewProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [emailColumn, setEmailColumn] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<EnrichmentField[]>([
    // Default selected fields (3 fields)
    PRESET_FIELDS.find(f => f.name === 'companyName')!,
    PRESET_FIELDS.find(f => f.name === 'companyDescription')!,
    PRESET_FIELDS.find(f => f.name === 'industry')!
  ]);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [showNaturalLanguage, setShowNaturalLanguage] = useState(false);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [suggestedFields, setSuggestedFields] = useState<EnrichmentField[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [showEmailDropdownStep1, setShowEmailDropdownStep1] = useState(false);
  const [customField, setCustomField] = useState<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array';
  }>({
    name: '',
    description: '',
    type: 'string'
  });

  // Auto-detect email column but stay on step 1 for confirmation
  useEffect(() => {
    if (rows && columns && Array.isArray(rows) && Array.isArray(columns)) {
      const detection = detectEmailColumn(rows, columns);
      if (detection.columnName && detection.confidence > 50) {
        setEmailColumn(detection.columnName);
        // Stay on step 1 to let user confirm or change
      }
    }
  }, [rows, columns]);

  // Safety check for undefined props
  if (!rows || !columns || !Array.isArray(rows) || !Array.isArray(columns)) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No data available. Please upload a CSV file.</p>
      </div>
    );
  }

  const handleAddField = (field: EnrichmentField) => {
    if (selectedFields.length >= 10) {
      toast.error("Maximum 10 fields allowed");
      return;
    }
    if (!selectedFields.find(f => f.name === field.name)) {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleRemoveField = (fieldName: string) => {
    setSelectedFields(selectedFields.filter(f => f.name !== fieldName));
  };

  const handleGenerateFields = async () => {
    if (!naturalLanguageInput.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: naturalLanguageInput })
      });

      if (!response.ok) throw new Error('Failed to generate fields');

      const result = await response.json();

      // Convert API response format to frontend format
      if (result.success && result.data && result.data.fields) {
        const convertedFields = result.data.fields.map((field: { displayName: string; description: string; type: string }) => ({
          name: generateVariableName(field.displayName, selectedFields.map(f => f.name)),
          displayName: field.displayName,
          description: field.description,
          type: field.type === 'text' ? 'string' : field.type === 'array' ? 'string' : field.type as 'string' | 'number' | 'boolean' | 'array',
          required: false
        }));
        setSuggestedFields(convertedFields);
      } else {
        throw new Error('Invalid response format');
      }

      setShowNaturalLanguage(false);
      setNaturalLanguageInput('');
    } catch (error) {
      console.error('Error generating fields:', error);
      toast.error('Failed to generate fields. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddCustomField = () => {
    if (!customField.name || !customField.description) {
      toast.error("Please fill in all fields");
      return;
    }

    const fieldName = generateVariableName(customField.name, selectedFields.map(f => f.name));
    const newField: EnrichmentField = {
      name: fieldName,
      displayName: customField.name,
      description: customField.description,
      type: customField.type,
      required: false
    };

    handleAddField(newField);
    setCustomField({ name: '', description: '', type: 'string' });
    setShowManualAdd(false);
  };

  const displayRows = showAllRows ? rows : rows.slice(0, 3);
  const maxVisibleFields = 5;
  const startFieldIndex = Math.max(0, selectedFields.length - maxVisibleFields);
  const visibleFields = selectedFields.slice(startFieldIndex);

  return (
    <div className="space-y-6">
      {/* Table Preview at the top */}
      <div className="w-full">
        <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm ">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-orange-100">
                {/* All columns - highlight email column */}
                {columns.map((col, idx) => {
                  const isEmailCol = col === emailColumn;
                  return (
                    <TableHead
                      key={idx}
                      className={cn(
                        "transition-all duration-700 relative",
                        isEmailCol
                          ? "sticky left-0 z-10 bg-orange-500 text-white font-bold "
                          : "bg-zinc-50 font-medium",
                        !isEmailCol && step >= 2 && "opacity-30"
                      )}
                    >
                      <span>{col}</span>
                    </TableHead>
                  );
                })}
                {/* Preview columns for selected fields */}
                {step >= 2 && visibleFields.map((field, idx) => (
                  <TableHead
                    key={`new-${idx}`}
                    className={cn(
                      "font-semibold transition-all duration-700 bg-orange-50 text-orange-900  ",
                      "animate-in fade-in slide-in-from-right-2"
                    )}
                    style={{
                      animationDelay: `${idx * 100}ms`,
                      animationFillMode: 'backwards'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500">✨</span>
                      <span>{field.displayName}</span>
                    </div>
                  </TableHead>
                ))}
                {step >= 2 && selectedFields.length > maxVisibleFields && (
                  <TableHead className="text-center text-gray-500 animate-in fade-in duration-700">
                    +{selectedFields.length - maxVisibleFields} more
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, rowIdx) => (
                <TableRow key={rowIdx} className="group">
                  {/* All columns data - highlight email column */}
                  {columns.map((col, colIdx) => {
                    const isEmailCol = col === emailColumn;
                    const cellValue = row[col] || '';

                    if (isEmailCol) {
                      const email = cellValue.trim();
                      const isValidEmail = email && EMAIL_REGEX.test(email);
                      return (
                        <TableCell
                          key={colIdx}
                          className={cn(
                            "sticky left-0 z-10 bg-orange-50 transition-all duration-700",
                            "text-zinc-900 ",
                            rowIdx === displayRows.length - 1 && "email-column-rounded-bottom"
                          )}
                        >
                          <span className={cn(
                            "text-sm truncate block max-w-[200px] font-mono font-bold",
                            isValidEmail ? "text-zinc-900 " : email ? "text-red-600" : "text-gray-400"
                          )}>
                            {email || '-'}
                          </span>
                        </TableCell>
                      );
                    }

                    return (
                      <TableCell
                        key={colIdx}
                        className={cn(
                          "transition-all duration-700 bg-white",
                          step >= 2 && "opacity-30"
                        )}
                      >
                        <span className="text-sm truncate block max-w-[150px] text-gray-600">
                          {cellValue || '-'}
                        </span>
                      </TableCell>
                    );
                  })}
                  {/* Preview cells for selected fields */}
                  {step >= 2 && visibleFields.map((field, idx) => (
                    <TableCell
                      key={`new-${idx}`}
                      className={cn(
                        "transition-all duration-700",
                        "animate-in fade-in slide-in-from-right-2"
                      )}
                      style={{
                        animationDelay: `${(idx * 100) + (rowIdx * 50)}ms`,
                        animationFillMode: 'backwards'
                      }}
                    >
                      <div className="h-5 rounded-full bg-gradient-to-r from-zinc-200 to-zinc-300 animate-pulse  " />
                    </TableCell>
                  ))}
                  {step >= 2 && selectedFields.length > maxVisibleFields && (
                    <TableCell className="text-center text-gray-400 animate-in fade-in duration-700">
                      ...
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!showAllRows && rows.length > 3 && (
          <button
            onClick={() => setShowAllRows(true)}
            className="text-sm text-orange-600 hover:text-orange-700   mt-2 font-medium"
          >
            Show {rows.length - 3} more rows →
          </button>
        )}
        {showAllRows && (
          <button
            onClick={() => setShowAllRows(false)}
            className="text-sm text-orange-600 hover:text-orange-700   mt-2 font-medium"
          >
            Show less
          </button>
        )}
      </div>

      {/* Step content below */}
      <div className="w-full">
        {/* Step 1: Email column selection */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-5 border-zinc-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left Section */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                  <h3 className="text-lg font-bold text-graphite">
                    {emailColumn ? 'Email Column Detected:' : 'Select Email Column:'}
                  </h3>

                  {emailColumn ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                      <span className="font-mono text-sm bg-orange-100 px-3 py-1 rounded-full border border-orange-300 text-orange-700 font-medium w-fit">
                        {emailColumn}
                      </span>

                      {!showEmailDropdownStep1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowEmailDropdownStep1(true)}
                          className="w-fit"
                        >
                          Change
                        </Button>
                      )}

                      {showEmailDropdownStep1 && (
                        <Select
                          value={emailColumn}
                          onValueChange={(value) => {
                            setEmailColumn(value);
                            setShowEmailDropdownStep1(false);
                          }}
                        >
                          <SelectTrigger className="w-full sm:w-48 bg-white border-zinc-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-60">
                            {columns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : (
                    <Select value={emailColumn} onValueChange={(value) => setEmailColumn(value)}>
                      <SelectTrigger className="w-full sm:w-64 bg-white border-orange-300">
                        <SelectValue placeholder="Select email column" />
                      </SelectTrigger>
                      <SelectContent className="bg-white max-h-60">
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Right Section */}
                <Button
                  variant="orange"
                  onClick={() => setStep(2)}
                  disabled={!emailColumn}
                  className="px-6 w-full sm:w-auto"
                >
                  Next
                </Button>
              </div>
            </Card>

            {/* Skip List Warning */}
            {emailColumn && (() => {
              const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
              const skippableEmails = rows.filter(row => {
                const email = row[emailColumn]?.toLowerCase();
                if (!email) return false;
                const domain = email.split('@')[1];
                return domain && commonDomains.includes(domain);
              });

              if (skippableEmails.length === 0) return null;

              return (
                <Alert className="border-zinc-200 bg-orange-50 ">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-sm text-heat">
                    <strong>{skippableEmails.length} emails</strong> from common providers (Gmail, Yahoo, etc.) will be automatically skipped to save API calls.
                    These are typically personal emails without company information.
                  </AlertDescription>
                </Alert>
              );
            })()}
          </div>
        )}

        {/* Email column info for step 2+ */}
        {step >= 2 && (
          <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex flex-row  sm:items-center gap-2">
              <span className="text-sm font-medium text-zinc-700">Email Column:</span>
              <span className="font-mono text-sm bg-white px-3 py-1 rounded-full border border-orange-300 text-orange-700 w-fit">
                {emailColumn}
              </span>
            </div>

            {/* Right: Change / Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              {!showEmailDropdown && (
                <Button
                  variant="orange"
                  size="sm"
                  onClick={() => setShowEmailDropdown(true)}
                  className="w-full sm:w-auto"
                >
                  Change
                </Button>
              )}

              {showEmailDropdown && (
                <Select
                  value={emailColumn}
                  onValueChange={(value) => {
                    setEmailColumn(value);
                    setShowEmailDropdown(false);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48 bg-white border-orange-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-60">
                    {columns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Field Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="p-4 border-zinc-200 ">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#36322F] ">
                  Select fields to enrich ({selectedFields.length}/10)
                </h3>
                {/* Selected fields counter */}
                {selectedFields.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>

              {/* Preset fields */}
              <div className="space-y-3 mb-6">
                <Label>Quick add fields</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_FIELDS.map((field) => {
                    const isSelected = selectedFields.find(f => f.name === field.name);
                    return (
                      <button
                        key={field.name}
                        disabled={selectedFields.length >= 10 && !isSelected}
                        onClick={() => isSelected ? handleRemoveField(field.name) : handleAddField(field)}
                        className={cn(
                          "px-2 py-1 text-xs rounded-full transition-all duration-200 font-medium",
                          isSelected
                            ? "bg-zinc-900 text-white hover:bg-zinc-800   "
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200   ",
                          selectedFields.length >= 10 && !isSelected && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span className="flex items-center gap-1">
                          {field.displayName}
                          {isSelected && <X size={12} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add additional fields section */}
              <div className="border-t pt-6">
                <Label className="mb-4 block text-base font-semibold">Add additional fields</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Natural Language Card */}
                  <Card className="p-4 border-orange-200 hover:border-orange-300 transition-all duration-300  ">
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 hover:bg-transparent"
                      onClick={() => setShowNaturalLanguage(!showNaturalLanguage)}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Sparkles size={18} className="text-orange-500" />
                        Add with natural language
                      </span>
                      <ChevronDown size={16} className={`transition-transform ${showNaturalLanguage ? "rotate-180" : ""}`} />
                    </Button>

                    {showNaturalLanguage && (
                      <div className="mt-4 space-y-3">
                        <Textarea
                          placeholder="Describe the fields you want to add (e.g., 'I need the CEO name, company mission statement, and main product categories')"
                          value={naturalLanguageInput}
                          onChange={(e) => setNaturalLanguageInput(e.target.value)}
                          rows={3}
                          className=""
                        />
                        <Button
                          onClick={handleGenerateFields}
                          disabled={!naturalLanguageInput.trim() || isGenerating}
                          variant="orange"
                          className="w-full"
                        >
                          {isGenerating ? "Generating..." : "Generate Fields"}
                        </Button>
                      </div>
                    )}
                  </Card>

                  {/* Manual Add Card */}
                  <Card className="p-4 border-orange-200 hover:border-orange-300 transition-all duration-300  ">
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-0 hover:bg-transparent"
                      onClick={() => setShowManualAdd(!showManualAdd)}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Plus size={18} className="text-orange-500" />
                        Add manually
                      </span>
                      <ChevronDown size={16} className={`transition-transform ${showManualAdd ? "rotate-180" : ""}`} />
                    </Button>

                    {showManualAdd && (
                      <div className="mt-4 space-y-3">
                        <Input
                          placeholder="Field name"
                          value={customField.name}
                          onChange={(e) => setCustomField({ ...customField, name: e.target.value })}
                          className="w-full"
                        />
                        <Textarea
                          placeholder="Field description"
                          value={customField.description}
                          onChange={(e) => setCustomField({ ...customField, description: e.target.value })}
                          rows={2}
                          className="w-full"
                        />
                        <Select
                          value={customField.type}
                          onValueChange={(value: 'string' | 'number' | 'boolean' | 'array') =>
                            setCustomField({ ...customField, type: value })
                          }
                        >
                          <SelectTrigger className="w-full ">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="array">List</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleAddCustomField}
                          variant="orange"
                          className="w-full"
                        >
                          Add Field
                        </Button>
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              {/* Suggested fields */}
              {suggestedFields.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label>Suggested fields</Label>
                  {suggestedFields.map((field, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{field.displayName}</p>
                          <p className="text-sm text-muted-foreground">{field.description}</p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="orange"
                            onClick={() => {
                              handleAddField(field);
                              setSuggestedFields(suggestedFields.filter((_, i) => i !== idx));
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            className="bg-zinc-900 text-white hover:bg-zinc-800   "
                            onClick={() => setSuggestedFields(suggestedFields.filter((_, i) => i !== idx))}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <Button
                variant="orange"
                className="w-full mt-6 h-10 text-base"
                onClick={() => onStartEnrichment(emailColumn, selectedFields)}
                disabled={selectedFields.length === 0}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Start Enrichment
                </span>
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}