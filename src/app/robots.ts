import type { MetadataRoute } from "next";

/** Disallow crawling of unlisted shared-note URLs for search engines and AI bots. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/n/", "/n/*"],
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "GoogleOther",
          "anthropic-ai",
          "ClaudeBot",
          "Claude-Web",
          "Applebot-Extended",
          "Bytespider",
          "CCBot",
          "cohere-ai",
          "Diffbot",
          "FacebookBot",
          "meta-externalagent",
          "PerplexityBot",
          "YouBot",
        ],
        disallow: ["/n/", "/n/*"],
      },
    ],
  };
}
