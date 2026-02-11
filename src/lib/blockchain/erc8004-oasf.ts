/**
 * OASF skills and domains mapping for AgentHaus template types.
 * @see https://schema.oasf.outshift.com/
 * @see https://github.com/agntcy/oasf
 */

import type { AgentTemplate } from "@/lib/types";

export const OASF_VERSION = "0.8.0";

/** Map templateType to OASF skills slugs */
export const OASF_SKILLS_BY_TEMPLATE: Record<AgentTemplate, string[]> = {
  payment: [
    "tool_interaction/api_schema_understanding",
    "natural_language_processing/information_retrieval_synthesis/search",
    "analytical_skills/pattern_recognition/anomaly_detection",
  ],
  trading: [
    "analytical_skills/data_analysis/blockchain_analysis",
    "analytical_skills/pattern_recognition/anomaly_detection",
    "tool_interaction/workflow_automation",
  ],
  forex: [
    "analytical_skills/data_analysis/financial_analysis",
    "analytical_skills/pattern_recognition/trend_analysis",
    "tool_interaction/api_schema_understanding",
  ],
  social: [
    "natural_language_processing/natural_language_generation/summarization",
    "natural_language_processing/information_retrieval_synthesis/search",
    "media_and_entertainment/content_creation/text_generation",
  ],
  custom: [
    "natural_language_processing/information_retrieval_synthesis/search",
    "tool_interaction/api_schema_understanding",
    "analytical_skills/pattern_recognition/anomaly_detection",
  ],
};

/** Map templateType to OASF domain slugs */
export const OASF_DOMAINS_BY_TEMPLATE: Record<AgentTemplate, string[]> = {
  payment: [
    "finance_and_business/payment_services",
    "technology/blockchain/cryptocurrency",
  ],
  trading: [
    "finance_and_business/investment_services",
    "technology/blockchain/cryptocurrency",
  ],
  forex: [
    "finance_and_business/finance",
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
