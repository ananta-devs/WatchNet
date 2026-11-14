"use client";

import React from "react";
import { Terminal, Code, BookOpen, ExternalLink } from "lucide-react";

export default function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text flex items-center gap-2">
            <Terminal className="w-6 h-6 text-accent" />
            API & Developer Tools
          </h1>
          <p className="text-sm text-muted">OpenAPI 3.1 Interactive Documentation and Integration Endpoints</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-text">Interactive Swagger UI</h2>
          </div>
          <p className="text-sm text-muted">
            Access the FastAPI generated Swagger UI to test live authenticated endpoints against the WatchNet engine.
          </p>
          <a
            href="/api/v1/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition"
          >
            Open Swagger UI <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-text">ReDoc Specification</h2>
          </div>
          <p className="text-sm text-muted">
            Read formatted technical documentation, schema definitions, and response envelopes.
          </p>
          <a
            href="/api/v1/redoc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text rounded-lg text-sm font-medium border border-border transition"
          >
            Open ReDoc <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
