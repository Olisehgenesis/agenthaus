/**
 * OASF skills and domains mapping for AgentHaus template types.
 * Per https://best-practices.8004scan.io/docs/01-agent-metadata-standard.html
 * - Skills: hierarchical category/subcategory/skill (e.g. tool_interaction/api_schema_understanding)
 * - Domains: industry/sector/specialization (e.g. technology/blockchain/cryptocurrency)
 * - At least one of skills or domains required. Use verified slugs from OASF Schema Browser.
 * @see https://schema.oasf.outshift.com/0.8.0
 */

import type { AgentTemplate } from "@/lib/types";

export const OASF_VERSION = "0.8.0";

/** Map templateType to OASF skills slugs (OASF 0.8.0 verified) */
export const OASF_SKILLS_BY_TEMPLATE: Record<AgentTemplate, string[]> = {
  payment: [
    "tool_interaction/api_schema_understanding",
    "tool_interaction/workflow_automation",
    "natural_language_processing/information_retrieval_synthesis/search",
    "natural_language_processing/natural_language_generation/summarization",
  ],
  trading: [
    "analytical_skills/data_analysis/blockchain_analysis",
    "analytical_skills/pattern_recognition/anomaly_detection",
    "tool_interaction/api_schema_understanding",
    "tool_interaction/workflow_automation",
    "natural_language_processing/information_retrieval_synthesis/search",
  ],
  forex: [
    "analytical_skills/data_analysis/financial_analysis",
    "analytical_skills/pattern_recognition/trend_analysis",
    "tool_interaction/api_schema_understanding",
    "tool_interaction/workflow_automation",
    "natural_language_processing/information_retrieval_synthesis/search",
  ],
  social: [
    "natural_language_processing/natural_language_generation/dialogue_generation",
    "natural_language_processing/natural_language_generation/summarization",
    "natural_language_processing/information_retrieval_synthesis/search",
    "tool_interaction/api_schema_understanding",
  ],
  custom: [
    "natural_language_processing/information_retrieval_synthesis/search",
    "tool_interaction/api_schema_understanding",
    "tool_interaction/workflow_automation",
  ],
};

/** Map templateType to OASF domain slugs */
export const OASF_DOMAINS_BY_TEMPLATE: Record<AgentTemplate, string[]> = {
  payment: [
    "technology/blockchain/cryptocurrency",
    "finance_and_business/finance",
    "technology/blockchain",
  ],
  trading: [
    "technology/blockchain/cryptocurrency",
    "finance_and_business/investment_services",
    "technology/blockchain",
  ],
  forex: [
    "finance_and_business/finance",
    "finance_and_business/investment_services",
    "technology/blockchain/cryptocurrency",
  ],
  social: [
    "media_and_entertainment/content_creation",
    "technology/software_engineering/apis_integration",
  ],
  custom: [
    "technology/software_engineering/apis_integration",
    "technology/blockchain",
  ],
};

export function getOASFSkills(templateType: string): string[] {
  return OASF_SKILLS_BY_TEMPLATE[templateType as AgentTemplate] ?? OASF_SKILLS_BY_TEMPLATE.custom;
}

export function getOASFDomains(templateType: string): string[] {
  return OASF_DOMAINS_BY_TEMPLATE[templateType as AgentTemplate] ?? OASF_DOMAINS_BY_TEMPLATE.custom;
}
