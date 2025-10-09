"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { CSVUploader } from "./csv-uploader";
import { UnifiedEnrichmentView } from "./unified-enrichment-view";
import { EnrichmentTable } from "./enrichment-table";
import { CSVRow, EnrichmentField } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Input from "@/components/ui/input";
import { toast } from "sonner";

export default function CSVEnrichmentPage() {
  const [step, setStep] = useState<"upload" | "setup" | "enrichment">("upload");
  const [csvData, setCsvData] = useState<{
    rows: CSVRow[];
    columns: string[];
  } | null>(null);
  const [emailColumn, setEmailColumn] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<EnrichmentField[]>([]);
  const [isCheckingEnv, setIsCheckingEnv] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [firecrawlApiKey, setFirecrawlApiKey] = useState<string>("");
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [firecrawlApiUrl, setFirecrawlApiUrl] = useState<string>("https://api.firecrawl.dev");
  const [firecrawlEnv, setFirecrawlEnv] = useState<{
    mode: "saas" | "self_hosted";
    requiresApiKey: boolean;
    hasEnvApiKey: boolean;
    hasEnvApiUrl: boolean;
  }>({
    mode: "saas",
    requiresApiKey: true,
    hasEnvApiKey: false,
    hasEnvApiUrl: false,
  });
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false);
  const [missingKeys, setMissingKeys] = useState<{
    firecrawl: boolean;
    openai: boolean;
  }>({ firecrawl: false, openai: false });
  const [pendingCSVData, setPendingCSVData] = useState<{
    rows: CSVRow[];
    columns: string[];
  } | null>(null);

  // Check environment status on component mount
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const response = await fetch("/api/check-env");
        if (!response.ok) {
          throw new Error("Failed to check environment");
        }
        const data = await response.json();
        const envStatus = data.environmentStatus ?? {};
        const envMode =
          envStatus.FIRECRAWL_MODE === "self_hosted" ? "self_hosted" : "saas";
        const requiresApiKey =
          typeof envStatus.FIRECRAWL_REQUIRES_API_KEY === "boolean"
            ? envStatus.FIRECRAWL_REQUIRES_API_KEY
            : envMode !== "self_hosted";
        const envApiUrl =
          typeof envStatus.FIRECRAWL_API_URL === "string" &&
          envStatus.FIRECRAWL_API_URL.length > 0
            ? envStatus.FIRECRAWL_API_URL
            : "";

        setFirecrawlEnv({
          mode: envMode,
          requiresApiKey,
          hasEnvApiKey: !!envStatus.FIRECRAWL_API_KEY,
          hasEnvApiUrl: envApiUrl.length > 0,
        });

        const savedFirecrawlUrl =
          typeof window !== "undefined"
            ? localStorage.getItem("firecrawl_api_url")
            : null;
        const initialFirecrawlUrl =
          savedFirecrawlUrl && savedFirecrawlUrl.trim().length > 0
            ? savedFirecrawlUrl
            : envApiUrl || "https://api.firecrawl.dev";
        setFirecrawlApiUrl(initialFirecrawlUrl);

        if (!envStatus.FIRECRAWL_API_KEY) {
          if (typeof window !== "undefined") {
            const savedKey = localStorage.getItem("firecrawl_api_key");
            if (savedKey) {
              setFirecrawlApiKey(savedKey);
            }
          }
        } else {
          setFirecrawlApiKey("");
        }

        if (!envStatus.OPENAI_API_KEY) {
          if (typeof window !== "undefined") {
            const savedOpenAI = localStorage.getItem("openai_api_key");
            if (savedOpenAI) {
              setOpenaiApiKey(savedOpenAI);
            }
          }
        } else {
          setOpenaiApiKey("");
        }
      } catch (error) {
        console.error("Error checking environment:", error);
      } finally {
        setIsCheckingEnv(false);
      }
    };

    checkEnvironment();
  }, []);

  const handleCSVUpload = async (rows: CSVRow[], columns: string[]) => {
    // Check if we have Firecrawl API key
    const response = await fetch("/api/check-env");
    const data = await response.json();
    const envStatus = data.environmentStatus ?? {};
    const envMode =
      envStatus.FIRECRAWL_MODE === "self_hosted" ? "self_hosted" : "saas";
    const requiresFirecrawlKey =
      typeof envStatus.FIRECRAWL_REQUIRES_API_KEY === "boolean"
        ? envStatus.FIRECRAWL_REQUIRES_API_KEY
        : envMode !== "self_hosted";
    const envApiUrl =
      typeof envStatus.FIRECRAWL_API_URL === "string" &&
      envStatus.FIRECRAWL_API_URL.length > 0
        ? envStatus.FIRECRAWL_API_URL
        : "";
    const hasFirecrawl = !!envStatus.FIRECRAWL_API_KEY;
    const hasOpenAI = !!envStatus.OPENAI_API_KEY;
    const savedFirecrawlKey =
      typeof window !== "undefined"
        ? localStorage.getItem("firecrawl_api_key")
        : null;
    const savedOpenAIKey =
      typeof window !== "undefined"
        ? localStorage.getItem("openai_api_key")
        : null;
    const needsFirecrawlKey =
      requiresFirecrawlKey && !hasFirecrawl && !savedFirecrawlKey;
    const needsOpenAI = !hasOpenAI && !savedOpenAIKey;

    setFirecrawlEnv({
      mode: envMode,
      requiresApiKey: requiresFirecrawlKey,
      hasEnvApiKey: hasFirecrawl,
      hasEnvApiUrl: envApiUrl.length > 0,
    });

    if (typeof window !== "undefined") {
      const savedUrl = localStorage.getItem("firecrawl_api_url");
      const updatedUrl =
        savedUrl && savedUrl.trim().length > 0
          ? savedUrl
          : envApiUrl || firecrawlApiUrl;
      setFirecrawlApiUrl(updatedUrl);
    } else if (envApiUrl) {
      setFirecrawlApiUrl(envApiUrl);
    }

    if (needsFirecrawlKey || needsOpenAI) {
      // Save the CSV data temporarily and show API key modal
      setPendingCSVData({ rows, columns });
      setMissingKeys({
        firecrawl: needsFirecrawlKey,
        openai: needsOpenAI,
      });
      setShowApiKeyModal(true);
    } else {
      setCsvData({ rows, columns });
      setStep("setup");
    }
  };

  const handleStartEnrichment = (email: string, fields: EnrichmentField[]) => {
    setEmailColumn(email);
    setSelectedFields(fields);
    setStep("enrichment");
  };

  const handleBack = () => {
    if (step === "setup") {
      setStep("upload");
    } else if (step === "enrichment") {
      setStep("setup");
    }
  };

  const resetProcess = () => {
    setStep("upload");
    setCsvData(null);
    setEmailColumn("");
    setSelectedFields([]);
  };

  const openFirecrawlWebsite = () => {
    window.open("https://www.firecrawl.dev", "_blank");
  };

  const handleApiKeySubmit = async () => {
    const response = await fetch("/api/check-env");
    const data = await response.json();
    const envStatus = data.environmentStatus ?? {};
    const envMode =
      envStatus.FIRECRAWL_MODE === "self_hosted" ? "self_hosted" : "saas";
    const requiresFirecrawlKey =
      typeof envStatus.FIRECRAWL_REQUIRES_API_KEY === "boolean"
        ? envStatus.FIRECRAWL_REQUIRES_API_KEY
        : envMode !== "self_hosted";
    const envApiUrl =
      typeof envStatus.FIRECRAWL_API_URL === "string" &&
      envStatus.FIRECRAWL_API_URL.length > 0
        ? envStatus.FIRECRAWL_API_URL
        : "";
    const hasEnvFirecrawl = !!envStatus.FIRECRAWL_API_KEY;
    const hasEnvOpenAI = !!envStatus.OPENAI_API_KEY;
    const hasSavedFirecrawl = localStorage.getItem("firecrawl_api_key");
    const hasSavedOpenAI = localStorage.getItem("openai_api_key");

    const needsFirecrawlKey =
      requiresFirecrawlKey && !hasEnvFirecrawl && !hasSavedFirecrawl;
    const needsOpenAI = !hasEnvOpenAI && !hasSavedOpenAI;

    setFirecrawlEnv({
      mode: envMode,
      requiresApiKey: requiresFirecrawlKey,
      hasEnvApiKey: hasEnvFirecrawl,
      hasEnvApiUrl: envApiUrl.length > 0,
    });

    const normalizedUrlRaw =
      firecrawlApiUrl.trim() || envApiUrl || "https://api.firecrawl.dev";
    const normalizedUrl = normalizedUrlRaw
      .replace(/\s+$/g, "")
      .replace(/\/+$/, "");
    setFirecrawlApiUrl(normalizedUrl);

    if (needsFirecrawlKey && !firecrawlApiKey.trim()) {
      toast.error("Please enter a valid Firecrawl API key");
      return;
    }

    if (needsOpenAI && !openaiApiKey.trim()) {
      toast.error("Please enter a valid OpenAI API key");
      return;
    }

    setIsValidatingApiKey(true);

    try {
      if (firecrawlApiKey.trim()) {
        const validationResponse = await fetch("/api/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Firecrawl-API-Key": firecrawlApiKey,
            "X-Firecrawl-API-Url": normalizedUrl,
          },
          body: JSON.stringify({ url: "https://example.com" }),
        });

        if (!validationResponse.ok) {
          throw new Error("Invalid Firecrawl API key");
        }

        localStorage.setItem("firecrawl_api_key", firecrawlApiKey);
      } else {
        localStorage.removeItem("firecrawl_api_key");
      }

      if (normalizedUrl) {
        localStorage.setItem("firecrawl_api_url", normalizedUrl);
      }

      if (openaiApiKey.trim()) {
        localStorage.setItem("openai_api_key", openaiApiKey);
      } else {
        localStorage.removeItem("openai_api_key");
      }

      toast.success("Firecrawl connection saved successfully!");
      setShowApiKeyModal(false);

      if (pendingCSVData) {
        setCsvData(pendingCSVData);
        setStep("setup");
        setPendingCSVData(null);
      }
    } catch (error) {
      toast.error(
        "Could not validate Firecrawl settings. Please check and try again."
      );
      console.error("API key validation error:", error);
    } finally {
      setIsValidatingApiKey(false);
    }
  };

  const requiresFirecrawlKeyInput =
    missingKeys.firecrawl && firecrawlEnv.requiresApiKey;
  const requiresOpenAIKeyInput = missingKeys.openai;
  const shouldShowFirecrawlSettings =
    missingKeys.firecrawl ||
    firecrawlEnv.mode === "self_hosted" ||
    (!firecrawlEnv.hasEnvApiUrl && !firecrawlEnv.hasEnvApiKey);
  const isSubmitDisabled =
    isValidatingApiKey ||
    (requiresFirecrawlKeyInput && !firecrawlApiKey.trim()) ||
    (requiresOpenAIKeyInput && !openaiApiKey.trim());

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto font-inter">
      <div className="flex justify-between items-center">
        <Link
          href="https://www.firecrawl.dev/?utm_source=tool-csv-enrichment"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/firecrawl-logo-with-fire.png"
            alt="Firecrawl Logo"
            width={113}
            height={24}
          />
        </Link>
        <Button
          asChild
          variant="code"
          className="font-medium flex items-center gap-2"
        >
          <a
            href="https://github.com/mendableai/firecrawl/tree/main/examples"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Use this template
          </a>
        </Button>
      </div>

      <div className="text-center pt-8 pb-6">
        <h1 className="text-[2.5rem] lg:text-[3.8rem] text-[#36322F] dark:text-white font-semibold tracking-tight leading-[0.9] opacity-0 animate-fade-up [animation-duration:500ms] [animation-delay:200ms] [animation-fill-mode:forwards]">
          <span className="relative px-1 text-transparent bg-clip-text bg-gradient-to-tr from-red-600 to-yellow-500 inline-flex justify-center items-center">
            Fire Enrich v2
          </span>
          <span className="block leading-[1.1] opacity-0 animate-fade-up [animation-duration:500ms] [animation-delay:400ms] [animation-fill-mode:forwards]">
            Drag, Drop, Enrich.
          </span>
        </h1>
      </div>

      {/* Main Content */}
      {isCheckingEnv ? (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Initializing...</p>
        </div>
      ) : (
        <div className="bg-[#FBFAF9] p-4 sm:p-6 rounded-lg shadow-sm">
          {step === "setup" && (
            <Button
              variant="code"
              size="sm"
              onClick={handleBack}
              className="mb-4 flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
          )}

          {step === "upload" && <CSVUploader onUpload={handleCSVUpload} />}

          {step === "setup" && csvData && (
            <UnifiedEnrichmentView
              rows={csvData.rows}
              columns={csvData.columns}
              onStartEnrichment={handleStartEnrichment}
            />
          )}

          {step === "enrichment" && csvData && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-1">
                  Enrichment Results
                </h2>
                <p className="text-sm text-muted-foreground">
                  Click on any row to view detailed information
                </p>
              </div>
              <EnrichmentTable
                rows={csvData.rows}
                fields={selectedFields}
                emailColumn={emailColumn}
              />
              <div className="mt-6 text-center">
                <Button variant="orange" onClick={resetProcess}>
                  Start New Enrichment
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <footer className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>
          Powered by{" "}
          <Link
            href="https://www.firecrawl.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
          >
            Firecrawl
          </Link>
          {" and "}
          <Link
            href="https://openai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
          >
            OpenAI
          </Link>
        </p>
      </footer>

      {/* API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle>API Keys Required</DialogTitle>
            <DialogDescription>
              This tool requires API keys for Firecrawl and OpenAI to enrich
              your CSV data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {shouldShowFirecrawlSettings && (
              <div className="flex flex-col gap-3 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Firecrawl connection</h3>
                  <p className="text-xs text-muted-foreground">
                    Point to the managed Firecrawl API or your self-hosted
                    deployment.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="firecrawl-url" className="text-sm font-medium">
                    Firecrawl Base URL
                  </label>
                  <Input
                    id="firecrawl-url"
                    type="text"
                    placeholder="https://api.firecrawl.dev"
                    value={firecrawlApiUrl}
                    onChange={(e) => setFirecrawlApiUrl(e.target.value)}
                    disabled={isValidatingApiKey}
                  />
                  <p className="text-xs text-muted-foreground">
                    Example self-hosted URL: http://localhost:3002
                  </p>
                </div>
                {requiresFirecrawlKeyInput ? (
                  <>
                    <Button
                      onClick={openFirecrawlWebsite}
                      variant="outline"
                      size="sm"
                      className="flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Get Firecrawl API Key
                    </Button>
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="firecrawl-key"
                        className="text-sm font-medium"
                      >
                        Firecrawl API Key
                      </label>
                      <Input
                        id="firecrawl-key"
                        type="password"
                        placeholder="fc-..."
                        value={firecrawlApiKey}
                        onChange={(e) => setFirecrawlApiKey(e.target.value)}
                        disabled={isValidatingApiKey}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    API key optional when self-hosting.
                  </p>
                )}
              </div>
            )}

            {missingKeys.openai && (
              <>
                <Button
                  onClick={() =>
                    window.open(
                      "https://platform.openai.com/api-keys",
                      "_blank",
                    )
                  }
                  variant="outline"
                  size="sm"
                  className="flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Get OpenAI API Key
                </Button>
                <div className="flex flex-col gap-2">
                  <label htmlFor="openai-key" className="text-sm font-medium">
                    OpenAI API Key
                  </label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isValidatingApiKey) {
                        handleApiKeySubmit();
                      }
                    }}
                    disabled={isValidatingApiKey}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApiKeyModal(false)}
              disabled={isValidatingApiKey}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApiKeySubmit}
              disabled={isSubmitDisabled}
              variant="code"
            >
              {isValidatingApiKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Save settings"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
