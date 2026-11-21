import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PostHogErrorBoundary, PostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import { App } from "./features/prototype/app";
import "./app/globals.css";

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (posthogToken && posthogHost) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    defaults: "2026-08-30",
    autocapture: {
      dom_event_allowlist: ["click"],
      element_allowlist: ["button"],
      css_selector_allowlist: ["[data-ph-autocapture-safe]"],
      css_selector_ignorelist: [".ph-no-autocapture", "[data-ph-no-autocapture]"],
    },
    capture_pageview: true,
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    mask_personal_data_properties: true,
    before_send: (event) => {
      if (event.event !== "$autocapture") return event;
      const { token, distinct_id, $event_type, $session_id, $window_id, $device_id } =
        event.properties;
      return {
        ...event,
        properties: {
          token,
          distinct_id,
          $event_type,
          $session_id,
          $window_id,
          $device_id,
          autocapture_target: "public_build_tab",
        },
      };
    },
    persistence: "memory",
    disable_surveys: true,
    advanced_disable_flags: true,
    logs: {
      serviceName: "doroboty-ai-web",
      environment: import.meta.env.MODE,
    },
  });
} else if (import.meta.env.DEV) {
  if (!posthogToken) {
    console.error(
      "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
    );
  }

  if (!posthogHost) {
    console.error(
      "VITE_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_HOST is configured",
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <PostHogErrorBoundary>
        <App />
      </PostHogErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
