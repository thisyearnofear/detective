/**
 * Research / payments platform — gated behind RESEARCH_PLATFORM_ENABLED.
 * Consumer spine (cases, inbox, tick, inference) must not import this package
 * except via dynamic import when the flag is on.
 */

export function isResearchPlatformEnabled(): boolean {
  return process.env.RESEARCH_PLATFORM_ENABLED === "true";
}
