/**
 * @file enums.js
 * @description Centralized Business Enums and Const Objects for ATS 3.0.
 * Eliminates magic strings across Frontend UI and Backend Server Actions.
 */

/**
 * Standard Candidate Recruitment Pipeline Stages.
 */
export const CANDIDATE_STAGES = Object.freeze({
  RECEIVED_CV: "Received CV",
  TALENT_MAPPING: "Talent Mapping",
  CONTACT: "Contact",
  WAITING_FOR_CV: "Waiting for CV",
  SEND_CV_TO_CLIENT: "Send CV To AH/Client",
  SENDING_TEST: "Sending Test",
  SUBMIT_TEST: "Submit Test",
  FIRST_INTERVIEW: "1st Interview",
  SECOND_INTERVIEW: "2nd Interview",
  ADDITIONAL_INTERVIEW: "Additional Interview",
  FINAL_INTERVIEW: "Final Interview",
  FEEDBACK: "Feedback",
  CHASING_FEEDBACK: "Chasing Feedback",
  OFFER: "Offer",
  ONBOARD: "Onboard"
});

/**
 * Standard Candidate Stages List.
 */
export const CANDIDATE_STAGES_LIST = Object.freeze([
  CANDIDATE_STAGES.RECEIVED_CV,
  CANDIDATE_STAGES.TALENT_MAPPING,
  CANDIDATE_STAGES.CONTACT,
  CANDIDATE_STAGES.WAITING_FOR_CV,
  CANDIDATE_STAGES.SEND_CV_TO_CLIENT,
  CANDIDATE_STAGES.SENDING_TEST,
  CANDIDATE_STAGES.SUBMIT_TEST,
  CANDIDATE_STAGES.FIRST_INTERVIEW,
  CANDIDATE_STAGES.SECOND_INTERVIEW,
  CANDIDATE_STAGES.ADDITIONAL_INTERVIEW,
  CANDIDATE_STAGES.FINAL_INTERVIEW,
  CANDIDATE_STAGES.FEEDBACK,
  CANDIDATE_STAGES.CHASING_FEEDBACK,
  CANDIDATE_STAGES.OFFER,
  CANDIDATE_STAGES.ONBOARD
]);

/**
 * Standard Job Order Statuses.
 */
export const JOB_STATUSES = Object.freeze({
  OPEN: "Open",
  ON_HOLD: "On Hold",
  CLOSED: "Closed"
});

export const JOB_STATUSES_LIST = Object.freeze([
  JOB_STATUSES.OPEN,
  JOB_STATUSES.ON_HOLD,
  JOB_STATUSES.CLOSED
]);

/**
 * Standard Client Company Statuses.
 */
export const CLIENT_STATUSES = Object.freeze({
  ACTIVE: "Active",
  LEAD: "Lead",
  INACTIVE: "Inactive"
});

/**
 * Standard Working Modes for Job Orders.
 */
export const WORKING_MODES = Object.freeze({
  ON_SITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote"
});

export const WORKING_MODES_LIST = Object.freeze([
  WORKING_MODES.ON_SITE,
  WORKING_MODES.HYBRID,
  WORKING_MODES.REMOTE
]);

/**
 * Standard Contact Point Channel Types.
 */
export const CONTACT_TYPES = Object.freeze({
  LINKEDIN: "LinkedIn",
  PHONE: "Phone",
  EMAIL: "Email",
  FACEBOOK: "Facebook",
  ZALO: "Zalo",
  GITHUB: "Github",
  SKYPE: "Skype",
  WEBSITE: "Personal Website",
  OTHER: "Other"
});

export const CONTACT_TYPES_LIST = Object.freeze([
  { value: CONTACT_TYPES.LINKEDIN, label: "LinkedIn URL" },
  { value: CONTACT_TYPES.PHONE, label: "Phone Number" },
  { value: CONTACT_TYPES.EMAIL, label: "Email Address" },
  { value: CONTACT_TYPES.FACEBOOK, label: "Facebook URL" },
  { value: CONTACT_TYPES.ZALO, label: "Zalo Phone/URL" },
  { value: CONTACT_TYPES.GITHUB, label: "GitHub URL" },
  { value: CONTACT_TYPES.SKYPE, label: "Skype ID" },
  { value: CONTACT_TYPES.WEBSITE, label: "Website/Blog" },
  { value: CONTACT_TYPES.OTHER, label: "Other Link/ID" }
]);

/**
 * Candidate Name Honorific Prefixes.
 */
export const PREFIXES = Object.freeze({
  MR: "Mr.",
  MS: "Ms.",
  MRS: "Mrs.",
  DR: "Dr."
});

export const PREFIXES_LIST = Object.freeze([
  PREFIXES.MR,
  PREFIXES.MS,
  PREFIXES.MRS,
  PREFIXES.DR
]);

/**
 * Master Application Pipeline Activity Statuses.
 */
export const ACTIVITY_STATUSES = Object.freeze({
  ACTIVE: "Active",
  PLACED: "Placed",
  DROPPED: "Dropped"
});

/**
 * Standard Stage Badge Color Mapping.
 */
export const STAGE_COLOR_MAP = Object.freeze({
  [CANDIDATE_STAGES.RECEIVED_CV]: "bg-sky-950 text-sky-300 border-sky-800",
  [CANDIDATE_STAGES.TALENT_MAPPING]: "bg-indigo-950 text-indigo-300 border-indigo-800",
  [CANDIDATE_STAGES.CONTACT]: "bg-blue-950 text-blue-300 border-blue-800",
  [CANDIDATE_STAGES.WAITING_FOR_CV]: "bg-amber-950 text-amber-300 border-amber-800",
  [CANDIDATE_STAGES.SEND_CV_TO_CLIENT]: "bg-cyan-950 text-cyan-300 border-cyan-800",
  [CANDIDATE_STAGES.SENDING_TEST]: "bg-purple-950 text-purple-300 border-purple-800",
  [CANDIDATE_STAGES.SUBMIT_TEST]: "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800",
  [CANDIDATE_STAGES.FIRST_INTERVIEW]: "bg-violet-950 text-violet-300 border-violet-800",
  [CANDIDATE_STAGES.SECOND_INTERVIEW]: "bg-purple-950 text-purple-300 border-purple-800",
  [CANDIDATE_STAGES.ADDITIONAL_INTERVIEW]: "bg-indigo-950 text-indigo-300 border-indigo-800",
  [CANDIDATE_STAGES.FINAL_INTERVIEW]: "bg-amber-950 text-amber-300 border-amber-800",
  [CANDIDATE_STAGES.FEEDBACK]: "bg-yellow-950 text-yellow-300 border-yellow-800",
  [CANDIDATE_STAGES.CHASING_FEEDBACK]: "bg-orange-950 text-orange-300 border-orange-800",
  [CANDIDATE_STAGES.OFFER]: "bg-teal-950 text-teal-300 border-teal-800",
  [CANDIDATE_STAGES.ONBOARD]: "bg-emerald-950 text-emerald-300 border-emerald-800"
});

/**
 * Application Final Result (tách riêng khỏi Stage để phục vụ báo cáo funnel).
 */
export const APPLICATION_RESULTS = Object.freeze({
  PASSED: "Passed",
  FAILED: "Failed"
});

export const APPLICATION_RESULTS_LIST = Object.freeze([
  APPLICATION_RESULTS.PASSED,
  APPLICATION_RESULTS.FAILED
]);

/**
 * Standard Failure Reasons — đồng bộ 1:1 với Notion property "Reason (if failed)".
 * Chỉ áp dụng khi Result = Failed.
 */
export const FAILURE_REASONS = Object.freeze({
  HEADCOUNT_CLOSED: "Headcount Closed/On Hold",
  WITHDRAWN_PERSONAL: "Withdrawn - Personal reasons",
  WITHDRAWN_LOCATION: "Withdrawn - Location/Commute",
  WITHDRAWN_GHOSTED: "Withdrawn - Ghosted/No show",
  WITHDRAWN_ACCEPTED_OFFER: "Withdrawn - Accepted another offer",
  WITHDRAWN_SALARY: "Withdrawn - Salary/C&B",
  TECH_SKILL: "Tech/Skill",
  EXPERIENCE: "Experience",
  CULTURE_FIT: "Culture Fit",
  LANGUAGE: "English/Language",
  OVERQUALIFIED: "Overqualified",
  OVERBUDGET: "Overbudget",
  DUPLICATED: "Duplicated - Candidate has been sent by other recruiter recently",
  UNABLE_TO_CONTACT: "Unable To Contact",
  WITHDRAWN_NA: "Withdrawn - N/A"
});

export const FAILURE_REASONS_LIST = Object.freeze(Object.values(FAILURE_REASONS));

/**
 * Standard Candidate Sourcing Channels.
 */
export const SOURCE_CHANNELS = Object.freeze({
  LINKEDIN: "LinkedIn",
  LINKEDIN_JOB_POST: "LinkedIn Jobs",
  FACEBOOK: "Facebook",
  TOPCV: "TopCV",
  VIETNAMWORKS: "VietnamWorks",
  CAREERBUILDER: "CareerBuilder",
  ITVIEC: "ITViec",
  REFERRAL: "Referral",
  DIRECT_SOURCING: "Direct Sourcing",
  COMPANY_WEBSITE: "Company Website",
  OTHER: "Other"
});

export const SOURCE_CHANNELS_LIST = Object.freeze([
  "LinkedIn",
  "LinkedIn Jobs",
  "Facebook",
  "TopCV",
  "VietnamWorks",
  "CareerBuilder",
  "ITViec",
  "Referral",
  "Direct Sourcing",
  "Company Website",
  "Other"
]);
