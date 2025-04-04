"use client";

import { GmailProvider } from "../src/context/GmailContext";
import Layout from "../src/components/Layout";
import Script from "next/script";

export default function Home() {
  // Check if we should use mock data
  const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  return (
    <div>
      {/* Load the Google API client library only if not using mock data */}
      {!useMockData && (
        <Script
          src="https://apis.google.com/js/api.js"
          strategy="beforeInteractive"
        />
      )}
      
      <GmailProvider>
        <Layout />
      </GmailProvider>
    </div>
  );
}
