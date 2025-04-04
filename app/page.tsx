"use client";

import { GmailProvider } from "../src/context/GmailContext";
import Layout from "../src/components/Layout";
import Script from "next/script";
import { useEffect } from "react";

export default function Home() {
  // Check if we should use mock data
  const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  return (
    <div>
      {/* Load the Google API client libraries only if not using mock data */}
      {!useMockData && (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="beforeInteractive"
            onLoad={() => {
              console.log("Google Identity Services loaded successfully");
            }}
            onError={(e) => {
              console.error("Error loading Google Identity Services:", e);
            }}
          />
          <Script
            src="https://apis.google.com/js/api.js"
            strategy="beforeInteractive"
            onLoad={() => {
              console.log("Google API client loaded successfully");
            }}
            onError={(e) => {
              console.error("Error loading Google API client:", e);
            }}
          />
        </>
      )}
      
      <GmailProvider>
        <Layout />
      </GmailProvider>
    </div>
  );
}
