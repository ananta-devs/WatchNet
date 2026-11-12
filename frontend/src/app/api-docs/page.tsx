"use client";

import React from "react";
import { Terminal, Code, BookOpen, ExternalLink } from "lucide-react";

export default function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Terminal className="w-6 h-6 text-indigo-400" />
            API & Developer Tools
          </h1>
          <p className="text-sm text-slate-400">OpenAPI 3.1 Interactive Documentation and Integration Endpoints</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Code className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Interactive Swagger UI</h2>
          </div>
          <p className="text-sm text-slate-400">
            Access the FastAPI generated Swagger UI to test live authenticated endpoints against the WatchNet engine.
          </p>
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition"
          >
            Open Swagger UI <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">ReDoc Specification</h2>
          </div>
          <p className="text-sm text-slate-400">
            Read formatted technical documentation, schema definitions, and response envelopes.
          </p>
          <a
            href="/redoc"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition"
          >
            Open ReDoc <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
